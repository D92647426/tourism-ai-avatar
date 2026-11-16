// REQ-061: real environment adapter with deterministic clock, browser and cancellation boundaries.
const test = require('node:test');
const assert = require('node:assert/strict');
const {page,flush,deferred} = require('./campus-fixture.cjs');

const plain = value => JSON.parse(JSON.stringify(value));
const dining = {campusId:'pingleyuan',placeId:'pingleyuan-north-dining',hour:12,minute:0};
const point = {campusId:'tongzhou',latitude:39.751,longitude:116.698,accuracy:5,hour:18,minute:20};

async function environment(settings = {}) {
    const p = page(); await flush();
    const notifications = [], quiet = [], accepted = [];
    let boundaries = 0;
    const env = p.context.CampusEnvironment.create({catalog:p.catalog,isBusy:()=>false,
        get:async()=>({status:'available',label:'测试天气',temperatureC:10,details:{version:1}}),
        onBoundary:()=>{boundaries++;return settings.onBoundary ? settings.onBoundary() : Promise.resolve(true);},
        onQuiet:value=>quiet.push(value),onAccept:message=>accepted.push(message),
        onEnvironment:snapshot=>{notifications.push(snapshot);if(settings.onEnvironment)settings.onEnvironment(snapshot);}});
    env.setContext({conversationId:'virtual-test',contextRevision:0,campusId:'pingleyuan'}); await flush();
    return {p,env,notifications,quiet,accepted,get boundaries(){return boundaries;}};
}

test('a selected virtual coordinate uses its campus without inventing a building', async () => {
    const {p,env,quiet} = await environment();
    assert.equal(await env.applyVirtualPosition(point),true);
    const snapshot = plain(env.snapshot());
    assert.equal(env.campusId(),'tongzhou'); assert.equal(snapshot.campusId,'tongzhou');
    assert.deepEqual(snapshot.position,{latitude:39.751,longitude:116.698,accuracy:5,source:'simulated',timestamp:Date.parse(snapshot.time)});
    assert.equal(snapshot.hour,18); assert.equal(new Date(snapshot.time).getUTCMinutes(),20);
    assert.equal(quiet.at(-1),false); assert.match(p.nodes.get('positionStatus').textContent,/模拟坐标/);
    env.advanceSimulation(); assert.equal(p.nodes.get('proactiveOffer').hidden,true);
    env.destroy();
});

test('known places and coordinates stay together across manual advances and server context echoes', async () => {
    const {env} = await environment();
    const input = {...point,placeId:'tongzhou-student-dining'};
    assert.equal(await env.applyVirtualPosition(input),true);
    const before = plain(env.snapshot());
    env.setContext({conversationId:'virtual-test',contextRevision:1,campusId:'pingleyuan',position:{placeId:'pingleyuan-library',source:'confirmed',timestamp:1}});
    assert.equal(env.campusId(),'tongzhou');
    assert.equal(env.advanceSimulation(),true);
    const after = plain(env.snapshot());
    assert.deepEqual(after.position,{...before.position,timestamp:before.position.timestamp+30000});
    assert.equal(Date.parse(after.time)-Date.parse(before.time),30000);
    env.destroy();
});

test('invalid virtual input rejects before cancellation and leaves active state intact', async () => {
    const f = await environment(); await f.env.applyVirtualPosition(dining);
    const before = plain(f.env.snapshot()), calls = f.boundaries;
    const invalid = [null,[],{}, {...dining,campusId:'missing'}, {...dining,placeId:'missing'},
        {...dining,campusId:'tongzhou'}, {...point,placeId:'pingleyuan-library'},
        {...dining,placeId:null}, {...point,longitude:undefined}, {...point,latitude:undefined},
        {...point,latitude:NaN}, {...point,longitude:Infinity}, {...point,latitude:90.01}, {...point,longitude:-180.01},
        {...point,accuracy:undefined}, {...point,accuracy:-1}, {...point,accuracy:NaN},
        {...dining,accuracy:-1}, {...dining,hour:undefined}, {...dining,hour:24}, {...dining,hour:-1},
        {...dining,hour:12.5}, {...dining,minute:undefined}, {...dining,minute:60}, {...dining,minute:-1}, {...dining,minute:'0'}];
    for (const input of invalid) {
        await assert.rejects(f.env.applyVirtualPosition(input),error=>typeof error.message==='string');
        assert.deepEqual(plain(f.env.snapshot()),before);
        assert.equal(f.boundaries,calls);
    }
    f.env.destroy();
});

test('the point is frozen before waiting for cancellation and the newest valid action wins', async () => {
    const first = deferred(); let calls = 0;
    const {env} = await environment({onBoundary:()=>++calls===1 ? first.promise : Promise.resolve(true)});
    const input = {...point}; const pending = env.applyVirtualPosition(input);
    input.latitude = 12; input.campusId = 'pingleyuan';
    await env.applyVirtualPosition(dining);
    first.resolve(true); assert.equal(await pending,false);
    assert.equal(env.campusId(),'pingleyuan'); assert.equal(env.snapshot().position.placeId,dining.placeId);
    env.destroy();
});

test('a pending virtual point keeps its validated values when its caller mutates the input', async () => {
    const gate = deferred(); const {env} = await environment({onBoundary:()=>gate.promise});
    const input = {...point}; const pending = env.applyVirtualPosition(input);
    input.latitude = 0; input.longitude = 0; input.hour = 1;
    gate.resolve(true); assert.equal(await pending,true);
    assert.equal(env.snapshot().position.latitude,point.latitude); assert.equal(env.snapshot().hour,18);
    env.destroy();
});

test('boundary refusal and rejection preserve the current scene and virtual clock', async () => {
    let result = true;
    const f = await environment({onBoundary:()=>result==='reject' ? Promise.reject(Error('cancel failed')) : Promise.resolve(result)});
    await f.env.applyVirtualPosition(dining); const before = plain(f.env.snapshot());
    result = false; assert.equal(await f.env.applyVirtualPosition(point),false);
    assert.deepEqual(plain(f.env.snapshot()),before);
    result = 'reject'; assert.equal(await f.env.applyVirtualPosition(point),false);
    assert.deepEqual(plain(f.env.snapshot()),before); f.env.destroy();
});

for (const scenario of [
    {hour:12,minute:0,placeId:'pingleyuan-north-dining',offer:true},
    {hour:18,minute:10,placeId:'pingleyuan-north-dining',offer:true},
    {hour:9,minute:0,placeId:'pingleyuan-north-dining',offer:false},
    {hour:23,minute:15,placeId:'pingleyuan-library',offer:true},
    {hour:0,minute:30,placeId:'tongzhou-jixue-library',offer:true}
]) test('manual clock sampling works at '+scenario.hour+':'+scenario.minute+' in '+scenario.placeId, async () => {
    const {p,env,quiet} = await environment();
    env.setContext({conversationId:'virtual-test',contextRevision:0,campusId:'pingleyuan',serverTime:'2026-11-09T05:00:00Z'});
    assert.equal(env.snapshot().hour,13);
    const campusId = scenario.placeId.startsWith('tongzhou') ? 'tongzhou' : 'pingleyuan';
    await env.applyVirtualPosition({campusId,placeId:scenario.placeId,hour:scenario.hour,minute:scenario.minute});
    const before = plain(env.snapshot()); p.tick(5000);
    assert.equal(env.snapshot().time,before.time); assert.equal(p.nodes.get('proactiveOffer').hidden,true);
    assert.equal(env.advanceSimulation(),true);
    assert.equal(p.nodes.get('proactiveOffer').hidden,!scenario.offer);
    assert.equal(quiet.at(-1),scenario.placeId.includes('library'));
    assert.equal(env.snapshot().position.timestamp,before.position.timestamp+30000);
    env.destroy();
});

test('manual advancement rejects invalid steps and crosses Shanghai midnight without changing the point', async () => {
    const {env} = await environment(); assert.equal(env.advanceSimulation(),false);
    await env.applyVirtualPosition({...point,hour:23,minute:59}); const before = plain(env.snapshot());
    for (const seconds of [0,-1,3601,NaN,Infinity,1.5,'30',null,Number.MAX_SAFE_INTEGER]) {
        assert.equal(env.advanceSimulation(seconds),false); assert.deepEqual(plain(env.snapshot()),before);
    }
    assert.equal(env.advanceSimulation(60),true);
    assert.equal(env.snapshot().hour,0); assert.deepEqual(plain(env.snapshot().position),{...before.position,timestamp:before.position.timestamp+60000});
    assert.equal(env.advanceSimulation(3600),true); assert.equal(env.snapshot().hour,1); env.destroy();
});

test('entering simulation stops real GPS and late success or failure cannot replace the virtual point', async () => {
    const {p,env} = await environment();
    await env.applyVirtualPosition(dining); await env.exitSimulation();
    const watch = p.watches.at(-1); assert.ok(watch);
    const fix = {coords:{latitude:39.9,longitude:116.4,accuracy:10},timestamp:p.context.Date.now()};
    watch.ok(fix); assert.equal(env.snapshot().position.source,'geolocation');
    await env.applyVirtualPosition(point); assert.ok(p.clearedWatches.includes(watch.id));
    const before = plain(env.snapshot()); watch.ok(fix); watch.bad();
    assert.deepEqual(plain(env.snapshot()),before); env.destroy();
});

test('exit clears virtual coordinates and cancellation echoes before starting fresh real GPS', async () => {
    const gate = deferred(); let calls = 0;
    const {p,env} = await environment({onBoundary:()=>++calls===2 ? gate.promise : Promise.resolve(true)});
    await env.applyVirtualPosition(point); const exiting = env.exitSimulation();
    assert.equal(env.snapshot().simulated,false); assert.equal(env.snapshot().position,null);
    env.setContext({conversationId:'virtual-test',contextRevision:1,campusId:'pingleyuan',position:{placeId:'pingleyuan-library',source:'confirmed',timestamp:10}});
    gate.resolve(true); assert.equal(await exiting,true);
    assert.equal(env.snapshot().position,null); assert.equal(env.campusId(),'pingleyuan');
    assert.ok(p.watches.length>0); assert.equal(env.advanceSimulation(),false); env.destroy();
});

test('an older exit cannot clear a newer virtual position or restart its GPS watch', async () => {
    const gate = deferred(); let calls = 0;
    const {p,env} = await environment({onBoundary:()=>++calls===2 ? gate.promise : Promise.resolve(true)});
    await env.applyVirtualPosition(dining); const exiting = env.exitSimulation();
    await env.applyVirtualPosition(point); const before = plain(env.snapshot()), watches = p.watches.length;
    gate.resolve(true); assert.equal(await exiting,false);
    assert.deepEqual(plain(env.snapshot()),before); assert.equal(p.watches.length,watches); env.destroy();
});

test('a background roundtrip during exit rejects cancellation echoes and preserves a fresh GPS fix', async () => {
    const gate = deferred(); let calls = 0;
    const {p,env} = await environment({onBoundary:()=>++calls===2 ? gate.promise : Promise.resolve(true)});
    await env.applyVirtualPosition(point); const exiting = env.exitSimulation();
    p.hide(); p.show();
    env.setContext({conversationId:'virtual-test',contextRevision:1,campusId:'pingleyuan',position:{placeId:'pingleyuan-library',source:'confirmed',timestamp:10}});
    assert.equal(env.snapshot().position,null);
    const watch = p.watches.at(-1);
    watch.ok({coords:{latitude:39.9,longitude:116.4,accuracy:3},timestamp:p.context.Date.now()});
    gate.resolve(true); assert.equal(await exiting,false);
    assert.equal(env.snapshot().position.source,'geolocation'); assert.equal(env.snapshot().position.latitude,39.9);
    env.destroy();
});

test('a new conversation may establish its own confirmation while an old exit is pending', async () => {
    const gate = deferred(); let calls = 0;
    const {env} = await environment({onBoundary:()=>++calls===2 ? gate.promise : Promise.resolve(true)});
    await env.applyVirtualPosition(point); const exiting = env.exitSimulation(); env.reset();
    env.setContext({conversationId:'new-conversation',contextRevision:0,campusId:'pingleyuan',position:{placeId:'pingleyuan-library',source:'confirmed',timestamp:10}});
    gate.resolve(true); assert.equal(await exiting,false);
    assert.equal(env.snapshot().position.placeId,'pingleyuan-library'); env.destroy();
});

for (const boundary of ['reset','hide','destroy']) test(boundary+' invalidates an asynchronous entry and blocks old sampling', async () => {
    const gate = deferred(); const {p,env} = await environment({onBoundary:()=>gate.promise});
    const pending = env.applyVirtualPosition(point);
    if (boundary==='hide') p.hide(); else env[boundary]();
    gate.resolve(true); assert.equal(await pending,false);
    assert.equal(env.snapshot().simulated,false); assert.equal(env.snapshot().position,null);
    assert.equal(env.advanceSimulation(),false); env.destroy();
});

test('backgrounding clears virtual coordinates until a new visible application', async () => {
    const {p,env} = await environment(); await env.applyVirtualPosition(point);
    p.hide(); assert.equal(env.snapshot().position,null); assert.equal(env.advanceSimulation(),false);
    assert.equal(await env.applyVirtualPosition(dining),false);
    p.show(); assert.equal(env.snapshot().position,null); assert.equal(env.advanceSimulation(),false);
    await env.applyVirtualPosition(dining); assert.equal(env.snapshot().position.placeId,dining.placeId);
    env.destroy();
});

test('destroy clears coordinates and suppresses later subscriptions, context echoes and boundary calls', async () => {
    const f = await environment(); await f.env.applyVirtualPosition(point); f.env.destroy();
    const count = f.notifications.length, boundaries = f.boundaries;
    f.env.setContext({position:{placeId:dining.placeId,source:'confirmed',timestamp:1},campusId:'pingleyuan'});
    f.env.reset(); f.env.update(); f.p.tick(60000);
    assert.equal(await f.env.applyVirtualPosition(dining),false); assert.equal(await f.env.exitSimulation(),false);
    assert.equal(f.env.snapshot().position,null); assert.equal(f.env.snapshot().simulated,false);
    assert.equal(f.notifications.length,count); assert.equal(f.boundaries,boundaries);
});

test('snapshot and environment notifications are detached including nested weather', async () => {
    const {env,notifications} = await environment(); env.update();
    const before = plain(env.snapshot()), observed = notifications.at(-1);
    assert.deepEqual(plain(observed),before); observed.weather.details.version = 999;
    const fetched = env.snapshot(); fetched.weather.details.version = 888;
    assert.deepEqual(plain(env.snapshot()),before);
    await env.applyVirtualPosition(point); const virtual = notifications.at(-1);
    assert.deepEqual(plain(virtual),plain(env.snapshot())); virtual.position.latitude = 0; virtual.weather.label = 'changed';
    assert.equal(env.snapshot().position.latitude,point.latitude); assert.equal(env.snapshot().weather.label,'晴');
    env.destroy();
});
