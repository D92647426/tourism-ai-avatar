const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../../src/main/resources/static/js/director-core.js');
const page=require('../../src/main/resources/static/js/director.js');
const {createEnv}=require('./harness');
const spots=['灵山大佛','九龙灌浴','灵山梵宫','佛教文化博览馆','菩提大道','祥符禅寺','五印坛城'].map((name,i)=>({id:i+1,name}));
const input={minutes:60,party:'solo',interest:'culture',weather:'fair'};
test('all valid plans respect estimates, available API spots and stop limits without mutating inputs',()=>{
    for(const minutes of [15,30,60,90,180])for(const party of ['solo','family','easy'])for(const interest of ['culture','art','nature']){
        const options={...input,minutes,party,interest};const snapshot=JSON.stringify(options);
        const result=core.plan(options,spots);assert.ok(result.total<=minutes);assert.ok(result.stops.length<=(party==='easy'?2:4));
        assert.equal(new Set(result.stops.map(s=>s.id)).size,result.stops.length);
        assert.ok(result.stops.every(s=>spots.some(x=>x.id===s.id)&&s.reason&&s.prompt));assert.equal(JSON.stringify(options),snapshot);
    }
    assert.equal(core.plan(input,[]).stops.length,0);
    assert.throws(()=>core.plan({...input,minutes:NaN},spots));assert.throws(()=>core.plan({...input,party:'unknown'},spots));
});
test('rain and half-time recuts report actual kept and removed stops, and remain reproducible',()=>{
    const baseline=core.plan(input,spots),rain=core.plan({...input,weather:'rain'},spots),half=core.plan({...input,minutes:30},spots);
    assert.ok(rain.stops.every(s=>['灵山梵宫','佛教文化博览馆'].includes(s.name)));
    assert.ok(half.total<=30);assert.deepEqual(core.plan(input,spots),baseline);
    const diff=core.difference(baseline,half);assert.ok(diff.removed.length>0);
    assert.ok(diff.kept.every(name=>half.stops.some(s=>s.name===name)&&baseline.stops.some(s=>s.name===name)));
    assert.match(rain.notice,/不含步行/);
});
test('page recuts locally and handoffs require explicit actions and preserve rejection reasons',()=>{
    const env=createEnv();env.GuideDirector=core;
    const el=id=>env.document.getElementById(id);
    el('directorTime').value='60';el('directorParty').value='solo';el('directorInterest').value='culture';
    let asked=0,observed=0;
    env.GuideChatDraft=()=>{asked++;return {accepted:false,reason:'聊天中有未发送草稿'};};
    env.GuideExploreSpot=()=>{observed++;return {accepted:false,reason:'当前内容包没有这个任务'};};
    page.mount(env,spots);assert.equal(asked,0);assert.equal(observed,0);
    el('directorHalf').dispatch('click');assert.match(el('directorSummary').textContent,/30 分钟/);assert.match(el('directorStatus').textContent,/移除/);
    const actions=el('directorStops').children[0].children.at(-1);
    actions.children[1].dispatch('click');assert.match(el('directorStatus').textContent,/当前内容包/);
    let stopped=false;actions.children[2].dispatch('click',{stopPropagation(){stopped=true;}});assert.equal(stopped,true);assert.equal(asked,1);assert.match(el('directorStatus').textContent,/草稿/);
    el('directorRain').dispatch('click');assert.match(el('directorSummary').textContent,/雨天/);
    el('directorRestore').dispatch('click');assert.match(el('directorSummary').textContent,/原始/);
});
