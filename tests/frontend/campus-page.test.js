const test = require('node:test');
const assert = require('node:assert/strict');
const {page,turn,response,flush} = require('./campus-fixture.cjs');
const fs = require('node:fs');
const path = require('node:path');

test('real entry styles retain responsive stage, composer and reduced-motion rules',()=>{
    const root=path.resolve(__dirname,'../../src/main/resources/static');
    const html=fs.readFileSync(path.join(root,'campus.html'),'utf8');
    const href=html.match(/<link[^>]+href="([^"]+)"/)[1];const css=fs.readFileSync(path.join(root,href),'utf8');
    assert.match(css,/\.campus-stage\s*\{/);assert.match(css,/\.composer\s*\{/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/@media \(max-width: 650px\)/);
});

test('real entry starts with a central greeting and reveals input automatically', async () => {
    const p=page(); assert.equal(p.nodes.get('conversation').hidden,true); await flush(); p.tick(1800);
    assert.equal(p.nodes.get('conversation').hidden,false); assert.equal(p.nodes.get('campusControls').hidden,false);
    assert.equal(p.nodes.get('campusStage').classList.contains('has-scene'),false);
    assert.equal(p.context.document.getElementById('missing'),null);
});
test('library scene uses actual catalog, bounded choices, safe CSRF and no invented arrival', async () => {
    const p=page(); await flush();p.tick(1800);p.send('我想去平乐园图书馆');await flush();
    const req=p.chats()[0]; assert.equal(req.options.credentials,'same-origin');assert.equal(req.options.headers['X-XSRF-TOKEN'],'csrf-test');
    req.resolve(response(turn(1)));await flush();
    assert.match(p.nodes.get('sceneContent').textContent,/逸夫图书馆/);assert.equal(p.nodes.get('campusChoices').children.length,4);
    assert.equal(p.nodes.get('campusStage').classList.contains('has-scene'),true);
    assert.match(p.nodes.get('positionStatus').textContent,/未确认/);
    assert.equal(p.nodes.get('conversation').hidden,false);
});
test('new conversation isolates late responses and photo callbacks', async () => {
    const p=page();await flush();p.send('图书馆');await flush();p.chats()[0].resolve(response(turn(1)));await flush();
    const oldImage=p.images[0], oldLoad=oldImage.onload;
    p.send('月亮湖');await flush();const pending=p.chats()[1];p.click('newConversation');await flush();
    p.requests.find(r=>r.url==='/api/campus/new').resolve(response({conversationId:'conversation-2',contextRevision:0}));await flush();
    pending.resolve(response(turn(2,'pingleyuan-moon-lake')));oldLoad();await flush();
    assert.equal(p.nodes.get('campusStage').classList.contains('has-scene'),false);assert.equal(p.nodes.get('sceneContent').textContent,'');
    assert.equal(p.nodes.get('sceneBackdrop').style.backgroundImage,'');
});
test('network retry reuses exact payload and preserves a newer draft', async () => {
    const p=page();await flush();p.send('校园卡丢了');await flush();const first=p.chats()[0];
    p.nodes.get('campusInput').value='我还想问图书馆';p.nodes.get('campusInput').fire('input');first.reject(Error('offline'));await flush();
    assert.equal(p.nodes.get('campusInput').value,'我还想问图书馆');p.click('retryRequest');await flush();
    assert.equal(p.chats()[1].options.body,first.options.body);
    p.chats()[1].resolve(response(turn(1)));await flush();assert.equal(p.nodes.get('campusInput').value,'我还想问图书馆');
});
test('simulation goes through two real companion samples and acceptance alone sends chat', async () => {
    const p=page();await flush();p.tick(1800);p.click('demoToggle');p.click('demoDining');await flush();
    assert.equal(p.nodes.get('proactiveOffer').hidden,true);assert.equal(p.chats().length,0);
    p.tick(1000);await flush();assert.equal(p.nodes.get('proactiveOffer').hidden,false);assert.match(p.nodes.get('environmentStatus').textContent,/模拟/);
    p.click('acceptOffer');await flush();assert.equal(p.chats().length,1);assert.equal(p.chats()[0].body.origin,'proactive_accept');
    assert.equal(p.chats()[0].body.context.simulated,true);
});
test('leaving simulation invalidates pending turn and clears position in next payload', async () => {
    const p=page();await flush();p.click('demoDining');await flush();p.tick(1000);p.click('acceptOffer');await flush();
    const old=p.chats()[0];p.click('exitDemo');await flush();
    const cancel=p.requests.find(r=>r.url==='/api/campus/cancel');cancel.resolve(response({conversationId:'conversation-1',contextRevision:1}));await flush();
    old.resolve(response(turn(1)));await flush();p.send('看看月亮湖');await flush();
    assert.equal(p.chats()[1].body.context.simulated,false);assert.equal(p.chats()[1].body.context.position,null);assert.ok(p.geo.length+p.watches.length>=1);
});
test('cancel tombstone forces a new attempt ID and synced revision on retry',async()=>{
    const p=page();await flush();p.send('校园卡丢了');await flush();const old=p.chats()[0];
    p.click('cancelRequest');await flush();assert.equal(old.options.signal.aborted,true);
    p.requests.find(r=>r.url==='/api/campus/cancel').resolve(response({conversationId:'conversation-1',contextRevision:1}));await flush();
    p.click('retryRequest');await flush();const next=p.chats()[1];
    assert.notEqual(next.body.requestId,old.body.requestId);assert.equal(next.body.contextRevision,1);assert.equal(next.body.message,old.body.message);
    old.resolve(response(turn(1)));await flush();assert.equal(p.nodes.get('scenePanel').hidden,true);
    next.resolve(response(turn(2,'pingleyuan-card-service',{sceneAction:{type:'SHOW_SERVICE_TASK',taskId:'campus-card',placeIds:['pingleyuan-card-service']}})));await flush();
    assert.match(p.nodes.get('sceneContent').textContent,/学综楼4层/);
});
test('draft suppresses companion offer and keeps suggestions from overwriting input',async()=>{
    const p=page();await flush();p.click('demoDining');await flush();p.nodes.get('campusInput').value='还没写完';p.nodes.get('campusInput').fire('input');p.tick(1000);
    assert.equal(p.nodes.get('proactiveOffer').hidden,true);p.click('acceptOffer');await flush();assert.equal(p.chats().length,0);
    p.nodes.get('campusInput').value='';p.nodes.get('campusInput').fire('input');assert.equal(p.nodes.get('proactiveOffer').hidden,false);
    p.click('companionToggle');assert.equal(p.nodes.get('proactiveOffer').hidden,true);
});
test('recognition uses normal submit, while manual edits and background cancel delayed sending',async()=>{
    const p=page();await flush();p.click('voiceInput');let r=p.recognitions[0];
    r.onresult({results:[Object.assign([{transcript:'去图书馆'}],{isFinal:true})]});p.tick(200);await flush();
    assert.equal(p.chats()[0].body.message,'去图书馆');assert.equal(p.chats()[0].body.origin,'user');
    p.chats()[0].resolve(response(turn(1)));await flush();p.click('voiceInput');r=p.recognitions[1];
    r.onresult({results:[Object.assign([{transcript:'去四教'}],{isFinal:true})]});p.nodes.get('campusInput').value='我自己修改';p.nodes.get('campusInput').fire('input');p.tick(200);await flush();
    assert.equal(p.chats().length,1);assert.equal(p.nodes.get('campusInput').value,'我自己修改');
    p.click('voiceInput');r=p.recognitions[2];r.onresult({results:[Object.assign([{transcript:'去月亮湖'}],{isFinal:true})]});p.hide();p.tick(200);await flush();assert.equal(p.chats().length,1);
});
test('library destination does not mute but confirmed physical arrival immediately stops audio',async()=>{
    const p=page();await flush();p.send('想去图书馆');await flush();p.chats()[0].resolve(response(turn(1)));await flush();
    const speaking=p.utterances.at(-1);speaking.onstart();assert.equal(p.nodes.get('soundToggle').textContent,'声音已开');
    p.send('我在图书馆');await flush();p.chats()[1].resolve(response(turn(2,'pingleyuan-library',{context:{campusId:'pingleyuan',placeId:'pingleyuan-library',position:{placeId:'pingleyuan-library',source:'confirmed',timestamp:Date.now()}}})));await flush();
    assert.equal(p.nodes.get('avatar').classList.contains('speaking'),false);assert.equal(p.nodes.get('soundToggle').textContent,'安静环境已静音');
});
test('old photo load and error cannot replace newer photo, floorplan never becomes backdrop',async()=>{
    const p=page();await flush();p.send('图书馆');await flush();p.chats()[0].resolve(response(turn(1)));await flush();
    const old=p.images[0];p.send('月亮湖');await flush();p.chats()[1].resolve(response(turn(2,'pingleyuan-moon-lake')));await flush();
    p.images[1].onload();const background=p.nodes.get('sceneBackdrop').style.backgroundImage;old.onload();old.onerror();
    assert.equal(p.nodes.get('sceneBackdrop').style.backgroundImage,background);assert.match(background,/moon-lake/);assert.equal(p.images.length,2);
});
test('new conversation and tab background clear simulated offers and stale sampling',async()=>{
    const p=page();await flush();p.click('demoDining');await flush();p.hide();p.tick(1000);p.show();assert.equal(p.nodes.get('proactiveOffer').hidden,true);
    p.click('demoDining');await flush();p.tick(1000);assert.equal(p.nodes.get('proactiveOffer').hidden,false);
    p.click('newConversation');await flush();assert.equal(p.nodes.get('proactiveOffer').hidden,true);assert.match(p.nodes.get('environmentStatus').textContent,/真实/);
});
test('zero configured volume remains silent and campus identity ignores legacy display config',async()=>{
    const p=page({config:{name:'旧景区',welcomeMessage:'旧欢迎',primaryColor:'#ff0000',volume:0,speechRate:0.75,voiceType:'auto'}});await flush();p.tick(1800);
    assert.equal(p.utterances.length,0);assert.equal(p.nodes.get('soundToggle').textContent,'声音已关');
    p.send('图书馆');await flush();p.chats()[0].resolve(response(turn(1)));await flush();assert.equal(p.utterances.length,0);assert.doesNotMatch(p.nodes.get('campusReply').textContent,/旧景区/);
});
test('replay sends no chat and old speech callbacks cannot revive speaking after mute',async()=>{
    const p=page();await flush();p.tick(1800);p.send('图书馆');await flush();p.chats()[0].resolve(response(turn(1)));await flush();
    p.click('replaySpeech');const count=p.chats().length;const utterance=p.utterances.at(-1),start=utterance.onstart;
    start();assert.equal(p.nodes.get('avatar').classList.contains('speaking'),true);p.click('soundToggle');start();
    assert.equal(p.nodes.get('avatar').classList.contains('speaking'),false);assert.equal(p.chats().length,count);
});
test('anonymous local voice 401 falls back to system Chinese through the existing lifecycle',async()=>{
    const p=page({config:{voiceType:'local:character',volume:1,speechRate:0.8}});await flush();
    p.send('图书馆');await flush();p.chats()[0].resolve(response(turn(1)));await flush();
    assert.ok(p.calls.some(c=>c.url==='/api/speech/synthesize'));
    const utterance=p.utterances.at(-1);assert.equal(utterance.text,'图书馆介绍');assert.equal(utterance.rate,0.8);
    utterance.onstart();assert.match(p.nodes.get('speechStatus').textContent,/系统声音/);
});
test('editing a listening draft stops recognition and returns to idle',async()=>{
    const p=page();await flush();p.click('voiceInput');assert.equal(p.nodes.get('speechStatus').textContent,'正在听你说');
    p.nodes.get('campusInput').value='自己输入';p.nodes.get('campusInput').fire('input');
    assert.equal(p.nodes.get('speechStatus').textContent,'我在这里');
});
test('stale server context resyncs before a new retry attempt',async()=>{
    const p=page({context:{conversationId:'conversation-1',contextRevision:5,campusId:'pingleyuan'}});await flush();p.send('图书馆');await flush();const old=p.chats()[0];
    old.resolve(response({code:'STALE_CONTEXT'},409));await flush();p.click('retryRequest');await flush();
    assert.notEqual(p.chats()[1].body.requestId,old.body.requestId);assert.equal(p.chats()[1].body.contextRevision,5);
});
test('a destination on another campus is not submitted as the demo physical location',async()=>{
    const p=page({context:{conversationId:'conversation-1',contextRevision:2,campusId:'tongzhou',placeId:'tongzhou-jixue-library'}});await flush();
    p.click('demoDining');await flush();p.tick(1000);p.click('acceptOffer');await flush();
    assert.equal(p.chats()[0].body.campusId,'pingleyuan');assert.equal(p.chats()[0].body.placeId,null);assert.equal(p.chats()[0].body.context.position.placeId,'pingleyuan-north-dining');
});
test('failed cancellation keeps sends blocked until cancellation is acknowledged',async()=>{
    const p=page();await flush();p.send('图书馆');await flush();p.click('cancelRequest');await flush();
    p.requests.find(r=>r.url==='/api/campus/cancel').reject(Error('offline'));await flush();
    assert.equal(p.nodes.get('sendMessage').disabled,true);assert.equal(p.nodes.get('reloadContext').hidden,false);
    p.click('reloadContext');await flush();const cancels=p.requests.filter(r=>r.url==='/api/campus/cancel');assert.equal(cancels.length,2);
    cancels[1].resolve(response({conversationId:'conversation-1',contextRevision:1}));await flush();assert.equal(p.nodes.get('sendMessage').disabled,false);
});
test('exiting during asynchronous demo entry cannot resurrect its sampling after cancellation',async()=>{
    const p=page();await flush();p.send('图书馆');await flush();p.click('demoDining');await flush();p.click('exitDemo');await flush();
    p.requests.find(r=>r.url==='/api/campus/cancel').resolve(response({conversationId:'conversation-1',contextRevision:1}));await flush();p.tick(1000);
    assert.match(p.nodes.get('environmentStatus').textContent,/真实/);assert.equal(p.nodes.get('proactiveOffer').hidden,true);
});
test('Shanghai clock prefers server offset, advances and refreshes on foreground',async()=>{
    const p=page({context:{conversationId:'conversation-1',contextRevision:0,serverTime:'2026-11-09T07:21:00Z'}});await flush();
    assert.match(p.nodes.get('environmentStatus').textContent,/15:21.*服务器校时/);p.tick(60000);assert.match(p.nodes.get('environmentStatus').textContent,/15:22/);
    p.hide();p.tick(60000);p.show();assert.match(p.nodes.get('environmentStatus').textContent,/15:23/);
    const fallback=page();await flush();assert.match(fallback.nodes.get('environmentStatus').textContent,/12:00.*设备时间/);
});
test('autoplay rejection uses a replay prompt without exposing device error codes',async()=>{
    const p=page();await flush();p.utterances.at(-1).onerror({error:'not-allowed'});
    assert.equal(p.nodes.get('speechStatus').textContent,'点击回听，让我讲给你听');assert.equal(p.nodes.get('avatar').classList.contains('speaking'),false);
});
test('a new question after an uncertain failure cancels the old attempt before sending',async()=>{
    const p=page();await flush();p.send('图书馆');await flush();p.chats()[0].reject(Error('offline'));await flush();
    p.send('看看四教');await flush();assert.equal(p.chats().length,1);
    p.requests.find(r=>r.url==='/api/campus/cancel').resolve(response({conversationId:'conversation-1',contextRevision:1}));await flush();
    assert.equal(p.chats()[1].body.message,'看看四教');assert.equal(p.chats()[1].body.contextRevision,1);
});
test('foreground companionship keeps one GPS watcher and rejects old callbacks across all boundaries',async()=>{
    const p=page();await flush();p.click('companionToggle');assert.equal(p.watches.length,1);
    const first=p.watches[0],fix={coords:{latitude:39.874,longitude:116.477,accuracy:10},timestamp:Date.parse('2026-11-09T04:00:00Z')};
    first.ok(fix);assert.match(p.nodes.get('positionStatus').textContent,/已获取设备位置/);
    p.hide();assert.ok(p.clearedWatches.includes(first.id));first.ok(fix);assert.match(p.nodes.get('positionStatus').textContent,/未确认/);
    p.show();assert.equal(p.watches.length,2);p.click('companionToggle');assert.ok(p.clearedWatches.includes(1));
    p.watches[1].ok(fix);assert.match(p.nodes.get('positionStatus').textContent,/未确认/);
    p.click('companionToggle');const third=p.watches[2];p.click('demoDining');await flush();assert.ok(p.clearedWatches.includes(third.id));
    third.ok(fix);assert.match(p.nodes.get('positionStatus').textContent,/模拟位置/);assert.equal(p.nodes.get('demoPanel').hidden,true);
    p.click('exitDemo');await flush();const fourth=p.watches[3];p.pagehide();assert.ok(p.clearedWatches.includes(fourth.id));
});
test('continuous GPS uses each real sample timestamp and weather exposes time and provider',async()=>{
    const p=page({weather:{status:'available',label:'北京市区参考天气',temperatureC:6,dataTime:'2026-11-09T12:00',fetchedAt:'2026-11-09T04:01:00Z',provider:'Open-Meteo',sourceUrl:'https://open-meteo.com/en/docs',stale:false}});await flush();
    assert.match(p.nodes.get('weatherEvidence').textContent,/观测时间 2026-11-09T12:00/);assert.match(p.nodes.get('weatherEvidence').textContent,/获取时间 2026-11-09 12:01:00/);assert.match(p.nodes.get('weatherEvidence').textContent,/Open-Meteo/);
    p.click('companionToggle');const watch=p.watches[0];const first=Date.parse('2026-11-09T04:00:00Z');
    watch.ok({coords:{latitude:39.874,longitude:116.477,accuracy:10},timestamp:first});p.tick(30000);
    watch.ok({coords:{latitude:39.874,longitude:116.477,accuracy:10},timestamp:first+30000});p.send('图书馆');await flush();
    assert.equal(p.chats()[0].body.context.position.timestamp,first+30000);assert.equal(p.chats()[0].body.context.position.source,'geolocation');assert.equal(p.chats()[0].body.context.position.placeId,undefined);
});
