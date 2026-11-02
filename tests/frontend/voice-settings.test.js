const test=require('node:test');
const assert=require('node:assert/strict');
const settings=require('../../src/main/resources/static/js/voice-settings.js');
test('finite numeric boundaries preserve zero; Chinese URI choice and unavailable fallback are explicit',()=>{
    assert.deepEqual(settings.normalize({volume:0,speechRate:2,voiceType:'zh-device'}),{volume:0,speechRate:2,voiceType:'zh-device'});
    assert.equal(settings.normalize({volume:NaN,speechRate:0}).speechRate,1);
    assert.equal(settings.normalize({volume:'0'}).volume,1);
    const voices=[{lang:'en-US',voiceURI:'english'},{lang:'zh-CN',voiceURI:'a',name:'中文甲'},{lang:'zh-TW',voiceURI:'b',name:'中文乙',default:true}];
    assert.equal(settings.choose({voiceType:'b'},voices).voice,voices[2]);
    assert.equal(settings.choose({voiceType:'auto'},voices).voice,voices[2]);
    assert.match(settings.choose({voiceType:'missing'},voices).notice,/不可用/);
    assert.match(settings.choose({voiceType:'female'},voices).notice,/不保证男女/);
    assert.equal(settings.choose({voiceType:'a'},[]).voice,null);
});
test('configured utterance applies rate and muted volume and still uses genuine lifecycle events',()=>{
    const speech=require('../../src/main/resources/static/js/speech-lifecycle.js');
    let utterance;const mouths=[];
    const engine=speech.create({synthesis:{getVoices:()=>[{lang:'zh-CN',voiceURI:'a'}],speak:u=>{utterance=u;},cancel(){}},
        Utterance:function(text){this.text=text;},getSettings:()=>({speechRate:0.75,volume:0}),
        onMouth:value=>mouths.push(value)});
    engine.speak('测试');assert.equal(utterance.rate,0.75);assert.equal(utterance.volume,0);
    assert.equal(engine.getState().status,'queued');utterance.onstart();assert.equal(engine.getState().status,'speaking');
    const staleEnd=utterance.onend;engine.stop();assert.equal(mouths.at(-1),false);staleEnd();assert.equal(engine.getState().status,'idle');
});


test('public config reaches real page playback with selected device URI, rate and volume zero', async()=>{
    const {page,flush,response}=require('./chat-fixture.cjs');
    const p=page({config:{volume:0,speechRate:1.75,voiceType:'b'},voices:[{lang:'zh-CN',voiceURI:'a'},{lang:'zh-CN',voiceURI:'b'}]});
    await flush();p.send('问题');await flush();p.requests[0].resolve(response({reply:'回答'}));await flush();
    assert.equal(p.utterances[0].volume,0);assert.equal(p.utterances[0].rate,1.75);assert.equal(p.utterances[0].voice.voiceURI,'b');
    p.nodes.get('chatPanelClose').fire('click');
});
