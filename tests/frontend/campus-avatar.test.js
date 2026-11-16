// REQ-062 / TEST-062: normal campus entry and real voice lifecycle.
const test = require('node:test');
const assert = require('node:assert/strict');
const {page,turn,response,flush,deferred} = require('./campus-fixture.cjs');

function fixture(options = {}) {
    const states = [], frames = [], models = [];
    const renderer = {
        async createMeshAvatar(canvas, settings) {
            if (options.failure) throw Error('WebGL unavailable');
            if (options.pending) await options.pending.promise;
            if (options.modelLoad) await options.modelLoad(settings);
            canvas.width = 320;
            canvas.getBoundingClientRect = () => ({left:100,top:80,width:320,height:480});
            const model = {
                destroyed:false, parameters:{},assetsBase:settings.assetsBase,
                setAutoIdle(){},setAutoMotion(){},setAppendageGain(){},setSwayGain(){},
                setParameters(values){ this.parameters = {...values}; states.push(this.parameters); },
                getViewport(){ return {scale:0.3,offset:[6.4,9.6]}; },
                advance(delta){ frames.push(delta); },
                destroy(){ this.destroyed = true; }
            };
            models.push(model);
            return model;
        }
    };
    const p = page({...options,MeshAvatar:renderer});
    return {...p,states,frames,models,step(count = 30){ for (let i=0;i<count;i++) p.tick(16); }};
}

test('real page loads the movable character with a matching static fallback',async()=>{
    const p = fixture(); await flush(); p.step();
    assert.equal(p.nodes.get('avatarCanvas').dataset.avatarState,'ready');
    assert.equal(p.nodes.get('avatarCanvas').hidden,false);
    assert.equal(p.nodes.get('avatarFallback').hidden,true);
    assert.match(p.nodes.get('avatarFallback').getAttribute('src'),/yanxiaobei-v8\/overalls\/source.png$/);
    assert.ok(p.frames.length > 10);
    assert.equal(p.states.at(-1).mouthOpen,0);
});

test('pointer gaze eases towards both directions, ignores touch and returns to centre',async()=>{
    const p = fixture(); await flush();
    function move(x,y,type='mouse') {
        p.context.document.dispatchForTest('pointermove',{clientX:x,clientY:y,pointerType:type});
        p.step();
    }
    move(1000,0);
    assert.ok(p.states.at(-1).gazeX > 0.7);
    assert.ok(p.states.at(-1).gazeY > 0.2);
    assert.ok(p.states.at(-1).angleX <= 7);
    move(0,800);
    assert.ok(p.states.at(-1).gazeX < -0.5);
    assert.ok(p.states.at(-1).gazeY < -0.5);
    move(1000,0,'touch');
    assert.ok(p.states.at(-1).gazeX < 0);
    p.context.document.dispatchForTest('pointerleave'); p.step(60);
    assert.ok(Math.abs(p.states.at(-1).gazeX) < 0.001);
    assert.ok(Math.abs(p.states.at(-1).gazeY) < 0.001);
});

test('actual speech start drives mouth shapes, stop closes immediately and stale callbacks stay inert',async()=>{
    const p = fixture(); await flush(); p.step();
    assert.equal(p.states.at(-1).mouthOpen,0);
    p.click('replaySpeech');
    const utterance = p.utterances.at(-1), oldStart = utterance.onstart;
    utterance.onstart(); p.step(160);
    assert.ok(p.states.some(state=>state.mouthOpen > 0.4));
    assert.ok(new Set(p.states.filter(state=>state.mouthOpen > 0.05).map(state=>state.mouthForm)).size >= 3);
    p.click('stopSpeech');
    assert.equal(p.states.at(-1).mouthOpen,0);
    oldStart(); p.step();
    assert.equal(p.states.at(-1).mouthOpen,0);
    assert.equal(p.nodes.get('avatar').classList.contains('speaking'),false);
});

test('pause and natural completion close the mouth, resume reopens it and engine errors stay closed',async()=>{
    const p = fixture(); await flush();
    p.click('replaySpeech'); const first = p.utterances.at(-1);
    first.onstart(); p.step(25);
    first.onpause(); assert.equal(p.states.at(-1).mouthOpen,0);
    const beforeResume = p.states.length;
    first.onresume(); p.step(30); assert.ok(p.states.slice(beforeResume).some(state=>state.mouthOpen > 0.1));
    first.onend(); assert.equal(p.states.at(-1).mouthOpen,0);
    p.click('replaySpeech'); const second = p.utterances.at(-1);
    second.onstart(); p.step(25);
    second.onerror({error:'synthesis-failed'}); assert.equal(p.states.at(-1).mouthOpen,0);
});

test('mute, quiet library, background and new conversation close the active mouth',async()=>{
    for (const boundary of ['mute','quiet','hide','new']) {
        const p = fixture(); await flush();
        p.click('replaySpeech'); p.utterances.at(-1).onstart(); p.step(25);
        assert.ok(p.states.some(state=>state.mouthOpen > 0.1));
        if (boundary === 'mute') p.click('soundToggle');
        if (boundary === 'hide') p.hide();
        if (boundary === 'new') p.click('newConversation');
        if (boundary === 'quiet') {
            p.send('我在图书馆'); await flush();
            p.chats().at(-1).resolve(response(turn(1,'pingleyuan-library',{context:{campusId:'pingleyuan',position:{placeId:'pingleyuan-library',source:'confirmed',timestamp:p.context.Date.now()}}})));
            await flush();
        }
        assert.equal(p.states.at(-1).mouthOpen,0,boundary);
    }
});

test('blinks naturally and reduced motion preserves speech without gaze or idle movement',async()=>{
    const p = fixture(); await flush(); p.step(330);
    assert.ok(p.states.some(state=>state.eyeLOpen < 0.08));
    const quiet = fixture({reducedMotion:true}); await flush();
    quiet.context.document.dispatchForTest('pointermove',{clientX:1000,clientY:0,pointerType:'mouse'});
    quiet.click('replaySpeech'); quiet.utterances.at(-1).onstart(); quiet.step(80);
    assert.ok(quiet.states.some(state=>state.mouthOpen > 0.1));
    for (const state of quiet.states) {
        for (const key of ['angleX','angleY','angleZ','bodyAngleZ','breath','gazeX','gazeY']) assert.equal(state[key],0,key);
        assert.equal(state.eyeLOpen,1);
    }
});

test('hidden pages stop rendering and resume with a bounded delta, disposal releases the renderer',async()=>{
    const p = fixture(); await flush(); p.step();
    p.hide(); const count = p.frames.length; p.tick(60000);
    assert.equal(p.frames.length,count);
    p.show(); p.step();
    assert.ok(p.frames.length > count);
    assert.ok(p.frames.every(delta=>delta >= 0 && delta <= 0.05));
    p.pagehide(); const last = p.frames.length; p.step();
    assert.equal(p.frames.length,last); assert.equal(p.models[0].destroyed,true);
});

test('loading failure and context loss retain the new portrait and conversation controls',async()=>{
    const p = fixture({failure:true}); await flush();
    assert.equal(p.nodes.get('avatarCanvas').dataset.avatarState,'static');
    assert.equal(p.nodes.get('avatarFallback').hidden,false);
    assert.equal(p.nodes.get('sendMessage').disabled,false);
    const lost = fixture(); await flush(); lost.nodes.get('avatarCanvas').fire('webglcontextlost');
    assert.equal(lost.nodes.get('avatarFallback').hidden,false);
    const count = lost.frames.length; lost.hide(); lost.show(); lost.step();
    assert.equal(lost.frames.length,count);
});

test('a renderer that finishes after page disposal is destroyed without replacing the fallback',async()=>{
    const pending = deferred(), p = fixture({pending}); await flush(); p.pagehide();
    pending.resolve(); await flush();
    assert.equal(p.models[0].destroyed,true);
    assert.equal(p.nodes.get('avatarCanvas').hidden,true);
    assert.equal(p.nodes.get('avatarFallback').hidden,false);
});

test('local speech uses actual audio amplitude, silence closes the mouth and stop detaches media',async()=>{
    const audios = [], taps = [];
    let amplitude = 0.12, disconnected = 0, closed = false;
    class Audio {
        constructor(){ audios.push(this); }
        play(){ return Promise.resolve(); }
        pause(){} load(){} removeAttribute(){}
    }
    class AudioContext {
        constructor(){ this.state = 'running'; this.destination = {}; }
        createMediaElementSource(audio){ taps.push(audio); return {connect(){},disconnect(){disconnected++;}}; }
        createAnalyser(){ return {fftSize:1024,getFloatTimeDomainData(data){data.fill(amplitude);},disconnect(){}}; }
        close(){ closed = true; return Promise.resolve(); }
    }
    const p = fixture({Audio,AudioContext,speechFetch:()=>Promise.resolve({ok:true,blob:async()=>new Blob(['test audio'])})});
    await flush();
    p.context.document.dispatchForTest('pointerdown');
    p.nodes.get('voiceSelect').value = 'local:character'; p.nodes.get('voiceSelect').fire('change');
    p.click('replaySpeech'); await flush();
    assert.equal(taps.length,1); assert.equal(p.states.at(-1).mouthOpen,0);
    audios[0].onplaying(); p.step();
    assert.ok(p.states.at(-1).mouthOpen > 0.7);
    amplitude = 0; p.step();
    assert.ok(p.states.at(-1).mouthOpen < 0.001);
    amplitude = 0.12; p.step();
    p.click('stopSpeech');
    assert.equal(p.states.at(-1).mouthOpen,0); assert.equal(disconnected,1);
    p.pagehide(); assert.equal(closed,true);
});

function outfitButton(p,id) {
    return p.nodes.get('appearanceChoices').children.find(button=>button.dataset.appearance === id);
}

test('wardrobe switches all three v8 outfits, saves only a valid choice and restores it on refresh',async()=>{
    const values = new Map(), storage = {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
    const p = fixture({storage}); await flush();
    p.click('appearanceToggle');
    assert.equal(p.nodes.get('appearancePanel').hidden,false);
    for (const id of ['hoodie','tshirt','overalls']) {
        outfitButton(p,id).fire('click'); await flush();
        assert.equal(p.nodes.get('avatarCanvas').dataset.appearance,id);
        assert.equal(outfitButton(p,id).getAttribute('aria-pressed'),'true');
        assert.equal(values.get('campus.avatar.appearance.v1'),id);
        assert.equal(p.nodes.get('sendMessage').disabled,false);
    }
    outfitButton(p,'hoodie').fire('click'); await flush();
    const next = fixture({storage}); await flush();
    assert.equal(next.nodes.get('avatarCanvas').dataset.appearance,'hoodie');
    assert.match(next.models[0].assetsBase,/\/hoodie\/built\/$/);
    assert.ok(p.models.slice(0,-1).every(model=>model.destroyed));
});

test('latest rapid choice wins and delayed renderer resources are disposed',async()=>{
    const delayed = deferred();
    const p = fixture({modelLoad:settings=>settings.assetsBase.includes('/hoodie/') ? delayed.promise : Promise.resolve()});
    await flush(); const original = p.models[0];
    outfitButton(p,'hoodie').fire('click'); await flush();
    assert.equal(original.destroyed,false);
    outfitButton(p,'tshirt').fire('click'); await flush();
    assert.equal(p.nodes.get('avatarCanvas').dataset.appearance,'tshirt');
    delayed.resolve(); await flush();
    assert.equal(p.nodes.get('avatarCanvas').dataset.appearance,'tshirt');
    assert.equal(p.models.at(-1).destroyed,true);
    assert.equal(p.nodes.get('characterHost').children.length,2);
});

test('failed outfit retains the active model, portrait and preference and can be retried',async()=>{
    let fail = true;
    const p = fixture({modelLoad:settings=>{if (fail && settings.assetsBase.includes('/hoodie/')) throw Error('texture missing');}});
    await flush(); const original = p.models[0], portrait = p.nodes.get('avatarFallback').getAttribute('src');
    outfitButton(p,'hoodie').fire('click'); await flush();
    assert.equal(original.destroyed,false);
    assert.equal(p.nodes.get('avatarCanvas').dataset.appearance,'overalls');
    assert.equal(p.nodes.get('avatarFallback').getAttribute('src'),portrait);
    assert.match(p.nodes.get('appearanceStatus').textContent,/重试/);
    assert.equal(p.nodes.get('characterHost').children.length,2);
    fail = false; outfitButton(p,'hoodie').fire('click'); await flush();
    assert.equal(p.nodes.get('avatarCanvas').dataset.appearance,'hoodie');
});

test('switching during real speech retains mouth lifecycle, draft and conversation request identity',async()=>{
    const p = fixture(); await flush();
    p.nodes.get('campusInput').value = '没发送的草稿';
    p.click('replaySpeech'); p.utterances.at(-1).onstart(); p.step();
    const count = p.chats().length, before = p.models.length;
    outfitButton(p,'hoodie').fire('click'); await flush(); p.step();
    assert.ok(p.models.length > before); assert.ok(p.models.at(-1).parameters.mouthOpen > 0);
    assert.equal(p.nodes.get('campusInput').value,'没发送的草稿'); assert.equal(p.chats().length,count);
    p.click('stopSpeech'); assert.equal(p.models.at(-1).parameters.mouthOpen,0);
});

test('Escape and close restore focus, outside click dismisses, storage failure and corrupt values are safe',async()=>{
    const p = fixture({storage:{getItem:()=> '../../other',setItem(){throw Error('blocked');}}}); await flush();
    assert.equal(p.nodes.get('avatarCanvas').dataset.appearance,'overalls');
    p.click('appearanceToggle'); p.context.document.dispatchForTest('keydown',{key:'Escape'});
    assert.equal(p.nodes.get('appearancePanel').hidden,true); assert.equal(p.context.document.activeElement,p.nodes.get('appearanceToggle'));
    p.click('appearanceToggle'); p.context.document.dispatchForTest('pointerdown',{target:p.nodes.get('campusInput')});
    assert.equal(p.nodes.get('appearancePanel').hidden,true);
    p.click('appearanceToggle'); p.click('closeAppearance'); assert.equal(p.nodes.get('appearancePanel').hidden,true);
    outfitButton(p,'hoodie').fire('click'); await flush();
    assert.equal(p.nodes.get('avatarCanvas').dataset.appearance,'hoodie');
    assert.match(p.nodes.get('appearanceStatus').textContent,/未能保存/);
});

test('portrait failure does not alter selection, static fallback can switch and late load after disposal is inert',async()=>{
    const p = fixture({portraitDecode:url=>url.includes('/hoodie/') ? Promise.reject(Error('bad image')) : Promise.resolve()}); await flush();
    outfitButton(p,'hoodie').fire('click'); await flush();
    assert.equal(p.nodes.get('avatarCanvas').dataset.appearance,'overalls');
    const fallback = fixture({failure:true}); await flush();
    outfitButton(fallback,'tshirt').fire('click'); await flush();
    assert.equal(fallback.nodes.get('avatarCanvas').dataset.avatarState,'static');
    assert.match(fallback.nodes.get('avatarFallback').getAttribute('src'),/\/tshirt\/source.png$/);
    const delayed = deferred(), late = fixture({modelLoad:s=>s.assetsBase.includes('/hoodie/') ? delayed.promise : Promise.resolve()}); await flush();
    outfitButton(late,'hoodie').fire('click'); await flush(); late.pagehide(); delayed.resolve(); await flush();
    assert.ok(late.models.every(model=>model.destroyed));
});

test('mobile wardrobe closes after a successful choice to reveal the full character and speech controls',async()=>{
    const p = fixture({mobile:true}); await flush(); p.click('appearanceToggle');
    outfitButton(p,'hoodie').fire('click'); await flush();
    assert.equal(p.nodes.get('avatarCanvas').dataset.appearance,'hoodie');
    assert.equal(p.nodes.get('appearancePanel').hidden,true);
    assert.equal(p.nodes.get('appearanceToggle').getAttribute('aria-expanded'),'false');
    assert.equal(p.context.document.activeElement,p.nodes.get('appearanceToggle'));
});
