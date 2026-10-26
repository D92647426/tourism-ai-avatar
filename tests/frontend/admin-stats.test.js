const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const stats = require('../../src/main/resources/static/js/admin-stats.js');
const root = path.resolve(__dirname,'../..');
const flush = () => new Promise(resolve=>setImmediate(resolve));
function deferred() {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function data(changes={}) {
    return {todayInteractions:0,last7DaysInteractions:0,sentimentSampleCount:0,positiveQuestionRate:null,totalKnowledgeItems:16,
        periodStart:'2026-10-20',periodEnd:'2026-10-26',timezone:'Asia/Shanghai',estimated:true,
        todayVisitors:null,weekVisitors:null,satisfactionRate:null,avgResponseTime:null,
        hotQuestions:[],sentimentTrend:[],spotRanking:[],hourlyDistribution:[],...changes};
}
function fixture({charts=true}={}) {
    class Element {
        constructor(){this.events={};this.dataset={};this.style={};this.value='';this.textContent='';this.html='';const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};}
        addEventListener(type,fn){(this.events[type]||=[]).push(fn);}
        fire(type){for(const fn of this.events[type]||[])fn.call(this,{preventDefault(){}});}
        set innerHTML(v){this.html=v;}
        get innerHTML(){return this.html||this.textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    }
    const nodes=new Map(), nav=[], calls=[], options=new Map();
    for(const match of fs.readFileSync(path.join(root,'src/main/resources/static/admin.html'),'utf8').matchAll(/id="([^"]+)"/g))nodes.set(match[1],new Element());
    nodes.get('tab-dashboard').classList.add('active');
    for(const tab of ['dashboard','knowledge','digital-human','reports','users']){const node=new Element();node.dataset.tab=tab;nav.push(node);}
    const context={document:{getElementById:id=>nodes.get(id),createElement:()=>new Element(),querySelector:()=>new Element(),querySelectorAll:selector=>selector==='.nav-item'?nav:selector==='.tab-content'?[...nodes].filter(([id])=>id.startsWith('tab-')).map(([,n])=>n):[]},
        fetch:url=>{const job=deferred();calls.push({...job,url});return job.promise;},setInterval(){},setTimeout(){},addEventListener(){},console:{error(){},log(){}}};
    if(charts)context.echarts={init:dom=>({setOption:o=>options.set(dom,o),dispose(){options.delete(dom);},resize(){}}),graphic:{LinearGradient:function(){}}};
    context.window=context;vm.createContext(context);
    for(const name of ['admin-stats.js','admin.js'])vm.runInContext(fs.readFileSync(path.join(root,'src/main/resources/static/js',name),'utf8'),context,{filename:name});
    return {nodes,nav,calls,options};
}
function resolve(call,body,ok=true){call.resolve({ok,json:async()=>body});}
test('empty metrics have no invented satisfaction or sample while actual zero remains zero',()=>{
    const empty=stats.dashboard(data({satisfactionRate:95,todayVisitors:999}));
    assert.equal(empty.today,'0');assert.equal(empty.rate,'暂无样本');assert.match(empty.sample,/0 条/);
    const zero=stats.dashboard(data({todayInteractions:2,last7DaysInteractions:3,sentimentSampleCount:2,positiveQuestionRate:0}));
    assert.equal(zero.rate,'0%');assert.match(zero.sample,/2 条/);
    assert.match(zero.period,/2026-10-20.*2026-10-26.*Asia\/Shanghai/);
});
test('malformed metrics are rejected rather than quietly treated as empty data',()=>{
    for(const change of [{positiveQuestionRate:95},{todayInteractions:'0'},{sentimentSampleCount:-1},{timezone:'UTC'},{estimated:false},{last7DaysInteractions:1,sentimentSampleCount:2,positiveQuestionRate:0},{todayInteractions:3,last7DaysInteractions:2}])assert.throws(()=>stats.dashboard(data(change)));
});
test('real admin page shows empty cards and chart empty states without synthetic bars or pie samples',async()=>{
    const p=fixture();resolve(p.calls[0],data());await flush();
    assert.equal(p.nodes.get('statToday').textContent,'0');assert.equal(p.nodes.get('statPositiveRate').textContent,'暂无样本');
    assert.match(p.nodes.get('statSentimentSample').textContent,/0 条/);
    for(const id of ['chartHotQuestions','chartSpots','chartHourly','chartSentiment'])assert.equal(p.options.get(p.nodes.get(id)).series.length,0);
    assert.doesNotMatch(p.nodes.get('dashboardStatus').textContent,/失败/);
});
test('zero positive share survives page rendering; repeated questions remain separate interactions and unknown labels are charted',async()=>{
    const p=fixture();resolve(p.calls[0],data({todayInteractions:3,last7DaysInteractions:3,sentimentSampleCount:2,positiveQuestionRate:0,
        sentimentTrend:[{date:'10-26',positive:0,neutral:1,negative:1,unclassified:1,total:3}],
        hotQuestions:[{question:'同一个会话再次提问',count:3}],hourlyDistribution:[{hour:'10:00',count:3}]}));await flush();
    assert.equal(p.nodes.get('statPositiveRate').textContent,'0%');assert.equal(p.nodes.get('statToday').textContent,'3');
    const series=p.options.get(p.nodes.get('chartSentiment')).series;
    assert.equal(series.find(x=>x.name==='未分类').data[0],1);
});
test('HTTP failures clear old numbers and charts and are visibly different from an empty dataset',async()=>{
    const p=fixture();resolve(p.calls[0],data({todayInteractions:1,last7DaysInteractions:1,sentimentSampleCount:1,positiveQuestionRate:100}));await flush();
    p.nav[0].fire('click');resolve(p.calls[1],{error:'server unavailable'},false);await flush();
    assert.equal(p.nodes.get('statToday').textContent,'--');assert.equal(p.nodes.get('statPositiveRate').textContent,'--');
    assert.match(p.nodes.get('dashboardStatus').textContent,/加载失败/);assert.match(p.nodes.get('chartSentiment').textContent,/不可用/);
});
test('a stale dashboard response cannot overwrite the latest refresh',async()=>{
    const p=fixture();p.nav[0].fire('click');resolve(p.calls[1],data({todayInteractions:2,last7DaysInteractions:2,sentimentSampleCount:1,positiveQuestionRate:0}));await flush();
    p.calls[0].reject(Error('late network failure'));await flush();assert.equal(p.nodes.get('statToday').textContent,'2');assert.equal(p.nodes.get('statPositiveRate').textContent,'0%');
});
test('CDN chart failure still leaves verified card values and an explicit chart warning',async()=>{
    const p=fixture({charts:false});resolve(p.calls[0],data());await flush();assert.equal(p.nodes.get('statToday').textContent,'0');
    assert.match(p.nodes.get('dashboardStatus').textContent,/数值已更新/);assert.match(p.nodes.get('chartSpots').textContent,/组件暂不可用/);
});
test('report uses the same zero share, sample and window labels; HTML in suggestion text is escaped',async()=>{
    const p=fixture();resolve(p.calls[0],data());await flush();p.nav[3].fire('click');
    resolve(p.calls[1],{...data({sentimentSampleCount:2,positiveQuestionRate:0}),trend:[{date:'10-26',positive:0,neutral:2,negative:0,unclassified:0,total:2}],topics:[],suggestions:[{level:'evil"',title:'<img src=x>',detail:'<script>bad</script>'}]});await flush();
    assert.equal(p.calls.length,2); // one dashboard and one atomic report request
    assert.match(p.nodes.get('reportSample').textContent,/2 条.*0%/);assert.match(p.nodes.get('reportPeriod').textContent,/Asia\/Shanghai/);
    assert.match(p.nodes.get('suggestionsList').innerHTML,/&lt;img/);assert.doesNotMatch(p.nodes.get('suggestionsList').innerHTML,/<script>/);
});
test('report network failures render unavailable without leaving old charts',async()=>{
    const p=fixture();resolve(p.calls[0],data());await flush();p.nav[3].fire('click');
    p.calls[1].reject(Error('offline'));await flush();
    assert.match(p.nodes.get('reportStatus').textContent,/加载失败/);assert.equal(p.nodes.get('reportSample').textContent,'样本数不可用');
    assert.match(p.nodes.get('suggestionsList').textContent,/加载失败/);
});
