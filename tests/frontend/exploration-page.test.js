const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../../src/main/resources/static/js/exploration-core.js');
const {createStore, mount} = require('../../src/main/resources/static/js/exploration.js');
const coachRequests = require('../../src/main/resources/static/js/coach-request.js');
const {clock, deferred, flush, response} = require('./chat-fixture.cjs');
const pack = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/main/resources/static/exploration/lingshan-demo.json')));
const campus = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/main/resources/static/exploration/campus-demo.json')));
function storage() {
    const values = new Map([['userId','alice']]);
    return {values, getItem:key=>values.get(key)||null, setItem:(key,value)=>values.set(key,value)};
}
function fixture(localStorage=storage()) {
    class Node {
        constructor(tag='div') { this.tag=tag; this.children=[]; this.events={}; this.dataset={}; this.value=''; this.hidden=false; this.textContent=''; this.disabled=false; }
        addEventListener(name,fn) { (this.events[name] ||= []).push(fn); }
        async fire(name) { for (const fn of this.events[name] || []) await fn.call(this, {preventDefault(){},stopPropagation(){}}); }
        appendChild(n) {this.children.push(n);n.parent=this;return n;}
        replaceChildren() {this.children=[];}
        remove() {if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
        click() {}
        setAttribute(key,value) {this[key]=value;}
        set innerHTML(value) {throw new Error('Unsafe HTML rendering: '+value);}
    }
    const nodes=new Map();
    const html=fs.readFileSync(path.join(__dirname,'../../src/main/resources/static/index.html'),'utf8');
    for(const match of html.matchAll(/id="([^"]+)"/g)) nodes.set(match[1],new Node());
    nodes.get('exploreMode').value='demo';
    const drafts=[], downloads=[], coachCalls=[], time=clock();
    nodes.get('exploreCoachResult').hidden=true;
    const win={document:{getElementById:id=>nodes.get(id),createElement:tag=>new Node(tag),body:new Node()},localStorage,
        fetch:async(url,options)=>{if(url!=='/api/exploration/coach')return {ok:true,json:async()=>pack}; const call=deferred();coachCalls.push({...call,body:JSON.parse(options.body),signal:options.signal});return call.promise;},
        Blob, URL:{createObjectURL:b=>{downloads.push(b);return 'blob:test';},revokeObjectURL(){}},setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,GuideCoachRequest:coachRequests,
        GuideChatDraft:text=>{drafts.push(text);return {accepted:true};}};
    return {nodes,win,drafts,downloads,coachCalls,time};
}
test('storage separates users, pack IDs and versions; corrupt or unavailable storage is recoverable',()=>{
    const disk=storage(), warnings=[];
    const a=createStore(disk,'alice',x=>warnings.push(x)), b=createStore(disk,'bob');
    const journal=core.record(pack,core.createJournal(pack),pack.tasks[0].id,{text:'我观察到双手不同',mode:'demo'},'2026-10-26T08:00:00.000Z');
    assert.equal(a.saveJournal(pack,journal),true);
    assert.equal(Object.keys(b.journal(pack).entries).length,0);
    assert.equal(Object.keys(a.journal({...pack,version:'2.0'}).entries).length,0);
    assert.equal(Object.keys(a.journal(campus).entries).length,0);
    assert.equal(Object.keys(a.journal(pack).entries).length,1);
    disk.values.set('tourism-explore:v1:alice','{broken'); assert.equal(a.current(),null); assert.equal(warnings.length,1);
    const denied=createStore({getItem(){throw Error('denied');},setItem(){throw Error('quota');}},'alice',x=>warnings.push(x));
    assert.equal(denied.current(),null);assert.equal(denied.saveCurrent({}),false);assert.equal(warnings.length,3);
});
test('page saves a real observation once, safely renders text, restores and exports only actual records',async()=>{
    const p=fixture();await mount(p.win);
    assert.equal(p.nodes.get('exploreStations').children.length,3);
    p.nodes.get('exploreObservation').value='我看到双手不同，<img src=x onerror=alert(1)> 是原话';
    await p.nodes.get('exploreForm').fire('submit');
    await p.nodes.get('exploreForm').fire('submit');
    assert.equal(p.nodes.get('exploreEntries').children.length,1);
    assert.match(p.nodes.get('exploreProgress').textContent,/1 \/ 3/);
    assert.equal(p.nodes.get('exploreExportJournal').disabled,false);
    await p.nodes.get('exploreExportJournal').fire('click');
    const md=await p.downloads[0].text(); assert.match(md,/课堂演示/); assert.doesNotMatch(md,/<img/);
    const restored=fixture(p.win.localStorage);await mount(restored.win);
    assert.equal(restored.nodes.get('exploreEntries').children.length,1);
});
test('page import previews before activation, rejects invalid files and restores the previous pack journal',async()=>{
    const p=fixture();await mount(p.win);
    p.nodes.get('exploreObservation').value='  我看到双手的不同之处  ';await p.nodes.get('exploreForm').fire('submit');
    assert.equal(p.nodes.get('exploreObservation').value,'我看到双手的不同之处');
    const file=p.nodes.get('exploreImportFile');
    file.files=[{size:20,text:async()=>'{bad'}];await file.fire('change');
    assert.match(p.nodes.get('explorePackTitle').textContent,/灵山/);
    assert.match(p.nodes.get('exploreStatus').textContent,/导入失败/);
    file.files=[{size:131073,text:async()=>{throw Error('should not read');}}];await file.fire('change');
    assert.match(p.nodes.get('exploreStatus').textContent,/128 KiB/);
    file.files=[{size:2000,text:async()=>JSON.stringify(campus)}];await file.fire('change');
    assert.equal(p.nodes.get('exploreImportPreview').hidden,false);
    assert.match(p.nodes.get('explorePackTitle').textContent,/灵山/);
    await p.nodes.get('exploreUsePack').fire('click');
    assert.equal(p.nodes.get('explorePackTitle').textContent,campus.title);
    assert.equal(p.nodes.get('exploreEntries').children.length,0);
    file.files=[{size:2000,text:async()=>JSON.stringify(pack)}];await file.fire('change');await p.nodes.get('exploreUsePack').fire('click');
    assert.equal(p.nodes.get('exploreEntries').children.length,1);
});
test('unsaved observations at other stations prevent losing drafts during a pack switch',async()=>{
    const p=fixture();await mount(p.win);
    p.nodes.get('exploreObservation').value='这一站还没保存的发现';
    await p.nodes.get('exploreStations').children[1].fire('click');
    const file=p.nodes.get('exploreImportFile');file.files=[{size:2000,text:async()=>JSON.stringify(campus)}];
    await file.fire('change');await p.nodes.get('exploreUsePack').fire('click');
    assert.equal(p.nodes.get('explorePackTitle').textContent,pack.title);
    assert.match(p.nodes.get('exploreStatus').textContent,/未保存/);
    await p.nodes.get('exploreStations').children[0].fire('click');
    assert.equal(p.nodes.get('exploreObservation').value,'这一站还没保存的发现');
});
test('ask guide uses the visible observation and prepares a draft without saving or sending',async()=>{
    const p=fixture();await mount(p.win);
    p.nodes.get('exploreObservation').value='我想知道左右手为什么不同';await p.nodes.get('exploreAsk').fire('click');
    assert.equal(p.drafts.length,1);assert.ok(p.drafts[0].includes('我想知道左右手为什么不同'));
    assert.equal(p.nodes.get('exploreEntries').children.length,0);
    p.win.GuideChatDraft=()=>({accepted:false,reason:'busy test'});await p.nodes.get('exploreAsk').fire('click');
    assert.match(p.nodes.get('exploreStatus').textContent,/busy test/);
});
test('storage failures leave a working temporary notebook and a visible warning',async()=>{
    const disk={getItem:key=>key==='userId'?'alice':null,setItem(){throw Error('quota');}};
    const p=fixture(disk);await mount(p.win);
    p.nodes.get('exploreObservation').value='我记录了一段自己的观察';await p.nodes.get('exploreForm').fire('submit');
    assert.equal(p.nodes.get('exploreEntries').children.length,1);assert.match(p.nodes.get('exploreStatus').textContent,/无法在刷新后保留/);
    const file=p.nodes.get('exploreImportFile');
    file.files=[{size:2000,text:async()=>JSON.stringify(campus)}];await file.fire('change');await p.nodes.get('exploreUsePack').fire('click');
    file.files=[{size:2000,text:async()=>JSON.stringify(pack)}];await file.fire('change');await p.nodes.get('exploreUsePack').fire('click');
    assert.equal(p.nodes.get('exploreEntries').children.length,1);
    assert.match(p.nodes.get('exploreStatus').textContent,/无法在刷新后保留/);
});

test('valid task IDs matching Object prototype names do not create phantom records',async()=>{
    const p=fixture();
    const unusual=JSON.parse(JSON.stringify(campus));unusual.tasks[0].id='constructor';unusual.tasks[1].id='toString';
    p.win.fetch=async()=>({ok:true,json:async()=>unusual});await mount(p.win);
    assert.equal(p.nodes.get('exploreEntries').children.length,0);
    assert.equal(p.nodes.get('exploreFeedback').hidden,true);
    p.nodes.get('exploreObservation').value='这是一条实际的观察记录';await p.nodes.get('exploreForm').fire('submit');
    assert.equal(p.nodes.get('exploreEntries').children.length,1);
    await p.nodes.get('exploreStations').children[1].fire('click');
    assert.equal(p.nodes.get('exploreFeedback').hidden,true);
});

function coachingReply(call) {
    return {reply:'<b>这只是一段建议</b>',followUp:'你还能看到哪个细节？',mode:'local-coach',fallback:true,reference:call.body.task.reference,source:call.body.task.source,notice:'来源由内容包提供，尚未独立核验，不判分。'};
}
test('coach feedback uses the current draft without saving or speaking and renders returned text safely',async()=>{
    const p=fixture();await mount(p.win);p.nodes.get('exploreObservation').value='这是一段尚未保存的观察';
    await p.nodes.get('exploreCoachAsk').fire('click');await flush();
    assert.equal(p.coachCalls[0].body.observation,'这是一段尚未保存的观察');
    assert.equal(p.nodes.get('exploreCoachAsk').disabled,true);
    await p.nodes.get('exploreCoachAsk').fire('click');await flush();assert.equal(p.coachCalls.length,1);
    p.coachCalls[0].resolve(response(coachingReply(p.coachCalls[0])));await flush();
    assert.equal(p.nodes.get('exploreCoachResult').hidden,false);assert.equal(p.nodes.get('exploreCoachMode').textContent,'本地观察提示');
    assert.equal(p.nodes.get('exploreCoachReply').textContent,'<b>这只是一段建议</b>');
    assert.equal(p.nodes.get('exploreEntries').children.length,0);assert.equal(p.drafts.length,0);
    await p.nodes.get('exploreObservation').fire('input');assert.equal(p.nodes.get('exploreCoachResult').hidden,true);
});
for(const change of ['input','mode','station','pack']) test(change+' invalidates pending coach feedback',async()=>{
    const p=fixture();await mount(p.win);p.nodes.get('exploreObservation').value='这一条发现已经保存了';await p.nodes.get('exploreForm').fire('submit');
    await p.nodes.get('exploreCoachAsk').fire('click');await flush();
    if(change==='input')await p.nodes.get('exploreObservation').fire('input');
    if(change==='mode'){p.nodes.get('exploreMode').value='onsite';await p.nodes.get('exploreMode').fire('change');}
    if(change==='station')await p.nodes.get('exploreStations').children[1].fire('click');
    if(change==='pack') {const file=p.nodes.get('exploreImportFile');file.files=[{size:2000,text:async()=>JSON.stringify(campus)}];await file.fire('change');await p.nodes.get('exploreUsePack').fire('click');}
    p.coachCalls[0].resolve(response(coachingReply(p.coachCalls[0])));await flush();
    assert.equal(p.coachCalls[0].signal.aborted,true);assert.equal(p.nodes.get('exploreCoachResult').hidden,true);assert.equal(p.nodes.get('exploreCoachAsk').disabled,false);
});
test('coach cancellation, invalid input and failed HTTP preserve observation and permit a deliberate retry',async()=>{
    const p=fixture();await mount(p.win);p.nodes.get('exploreObservation').value='ab';await p.nodes.get('exploreCoachAsk').fire('click');await flush();assert.equal(p.coachCalls.length,0);
    p.nodes.get('exploreObservation').value='观察到一个特别的细节';await p.nodes.get('exploreCoachAsk').fire('click');await flush();
    await p.nodes.get('exploreCoachCancel').fire('click');assert.equal(p.nodes.get('exploreCoachAsk').disabled,false);
    await p.nodes.get('exploreCoachAsk').fire('click');await flush();p.coachCalls[1].resolve({ok:false,status:500});await flush();
    assert.equal(p.nodes.get('exploreObservation').value,'观察到一个特别的细节');assert.equal(p.nodes.get('exploreCoachAsk').disabled,false);assert.match(p.nodes.get('exploreCoachStatus').textContent,/重试/);
});
