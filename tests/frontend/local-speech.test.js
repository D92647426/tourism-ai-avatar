const test=require('node:test');const assert=require('node:assert/strict');
const local=require('../../src/main/resources/static/js/local-speech.js');
const speech=require('../../src/main/resources/static/js/speech-lifecycle.js');
const {deferred,flush}=require('./chat-fixture.cjs');
function fixture(){
 const requests=[],audios=[],revoked=[],events=[];
 class Audio{constructor(){audios.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}load(){}}
 const engine=local.create({Audio,AbortController,URL:{createObjectURL:()=>`blob:${audios.length}`,revokeObjectURL:u=>revoked.push(u)},
  fetch:(url,options)=>{const d=deferred();requests.push({...d,url,options});return d.promise;}});
 const hooks={start:()=>events.push('start'),pause:()=>events.push('pause'),wait:()=>events.push('wait'),end:()=>events.push('end'),fallback:t=>events.push(t),error:e=>events.push(e)};
 const resolve=i=>requests[i].resolve({ok:true,blob:async()=>new Blob(['wav'],{type:'audio/wav'})});
 return {engine,requests,audios,revoked,events,hooks,resolve};
}
test('sentence splitting preserves content and bounds Unicode codepoints',()=>{
 assert.deepEqual(local.split('阿弥陀佛！我是您的AI导游灵灵，很高兴为您服务！'),['阿弥陀佛！','我是您的AI导游灵灵，','很高兴为您服务！']);
 for(const text of ['你好呀，这是测试。下一句！','鲸鱼🐳'.repeat(80),'English words '.repeat(30)]){
  const parts=local.split(text);assert.equal(parts.join(''),text.trim());assert.ok(parts.every(p=>Array.from(p).length<=32));
 }
});
test('prefetch one sentence, real playing callbacks, cancel aborts and stale events do nothing',async()=>{
 const f=fixture();const cancel=f.engine.speak('第一句。第二句。',{volume:0,speechRate:0.75},f.hooks);await flush();
 assert.equal(f.requests.length,1);f.resolve(0);await flush();assert.equal(f.requests.length,2);
 assert.deepEqual(f.events,[]);assert.equal(f.audios[0].volume,0);f.audios[0].onplaying();assert.deepEqual(f.events,['start']);
 const stale=f.audios[0].onended;cancel();assert.equal(f.requests[1].options.signal.aborted,true);stale();f.resolve(1);await flush();
 assert.equal(f.audios.length,1);assert.deepEqual(f.events,['start']);assert.equal(f.revoked.length,1);
});
test('middle failure falls back from unfinished sentence without replaying completed speech',async()=>{
 const f=fixture();f.engine.speak('第一句。第二句。第三句。',{},f.hooks);await flush();f.resolve(0);await flush();
 f.audios[0].onplaying();f.requests[1].reject(Error('down'));await flush();f.audios[0].onended();await flush();
 assert.deepEqual(f.events,['start','wait','第二句。第三句。']);
});
test('autoplay refusal is actionable and never retries through another voice',async()=>{
 const f=fixture();f.engine.speak('一句。',{},f.hooks);await flush();
 f.resolve(0);await flush(); // emulate an asynchronous media rejection
 f.audios[0].onerror({error:{name:'NotAllowedError'}});await flush();
 assert.deepEqual(f.events,['playback-blocked']);
});
test('local engine shares lifecycle, keeps mouth closed while queued and rejects old callbacks',()=>{
 let hooks,cancels=0,web;const mouths=[];
 const controller=speech.create({getSettings:()=>({voiceType:'local:character',volume:0,speechRate:1}),
  localEngine:{speak:(text,settings,h)=>{hooks=h;return ()=>cancels++;}},
  synthesis:{getVoices:()=>[{lang:'zh-CN'}],speak:u=>web=u,cancel(){}},Utterance:function(t){this.text=t;},onMouth:m=>mouths.push(m)});
 controller.speak('一句。二句。');assert.equal(controller.getState().status,'queued');assert.deepEqual(mouths,[]);
 hooks.start();assert.equal(mouths.at(-1),true);hooks.pause();assert.equal(controller.getState().status,'paused');assert.equal(mouths.at(-1),false);
 hooks.start();assert.equal(controller.getState().status,'speaking');assert.equal(mouths.at(-1),true);hooks.wait();assert.equal(mouths.at(-1),false);
 hooks.fallback('二句。');assert.equal(web.text,'二句。');web.onstart();assert.equal(mouths.at(-1),true);
 const old=hooks;controller.stop();old.start();old.end();assert.equal(controller.getState().status,'idle');assert.equal(mouths.at(-1),false);assert.ok(cancels>=1);
});
test('native media pause reaches lifecycle and cleanup silences old pause callbacks',async()=>{
 const f=fixture();const cancel=f.engine.speak('一句。',{},f.hooks);await flush();f.resolve(0);await flush();
 const audio=f.audios[0];audio.onplaying();const oldPause=audio.onpause;audio.onpause();audio.onplaying();
 assert.deepEqual(f.events,['start','pause','start']);cancel();assert.equal(audio.onpause,null);oldPause();assert.deepEqual(f.events,['start','pause','start']);
});
test('real page shows text before audio, uses configured voice and aborts on close',async()=>{
 const {page,response}=require('./chat-fixture.cjs');const audios=[];
 class Audio{constructor(){audios.push(this);}play(){return Promise.resolve();}pause(){}load(){}}
 const p=page({config:{voiceType:'local:character',volume:0,speechRate:0.9},Audio,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}}});
 await flush();p.send('介绍');await flush();p.requests[0].resolve(response({reply:'景区第一句。第二句。'}));await flush();
 assert.ok(p.nodes.get('chatMessages').children.some(n=>n.html&&n.html.includes('景区第一句')));
 assert.equal(p.audioRequests.length,1);assert.equal(p.utterances.length,0);assert.equal(JSON.parse(p.audioRequests[0].options.body).speed,0.9);
 p.audioRequests[0].resolve({ok:true,blob:async()=>new Blob(['wav'])});await flush();assert.equal(audios[0].volume,0);
 assert.equal(p.nodes.get('avatarState').dataset.state,'queued');audios[0].onplaying();assert.equal(p.nodes.get('avatarState').dataset.state,'speaking');
 p.nodes.get('chatPanelClose').fire('click');assert.equal(p.audioRequests[1].options.signal.aborted,true);assert.equal(p.nodes.get('avatarState').dataset.state,'idle');
});
test('local start timeout falls back once and old local events cannot start mouth during system queue',()=>{
 const {clock}=require('./chat-fixture.cjs');const time=clock();let hooks,web,cancel=0;
 const controller=speech.create({getSettings:()=>({voiceType:'local:character'}),setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,
 localEngine:{speak:(t,s,h)=>{hooks=h;return ()=>cancel++;}},synthesis:{getVoices:()=>[{lang:'zh-CN'}],speak:u=>web=u,cancel(){}},Utterance:function(t){this.text=t;}});
 controller.speak('整句');time.tick(8000);assert.equal(web.text,'整句');assert.ok(cancel);hooks.start();assert.equal(controller.getState().status,'queued');
 web.onstart();web.onend();assert.equal(controller.getState().status,'idle');
});
