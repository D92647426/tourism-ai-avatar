const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const coaches = require('../../src/main/resources/static/js/coach-request.js');
const {deferred,clock,flush,response} = require('./chat-fixture.cjs');
const pack = JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/main/resources/static/exploration/lingshan-demo.json')));
const context = () => ({packId:pack.id,packVersion:pack.version,task:structuredClone(pack.tasks[0]),observation:'我看到双手的姿态不同',mode:'demo'});
const result = ctx => ({reply:'可以把观察与推测分开讲。',followUp:'左右手各有什么不同？',mode:'local-coach',fallback:true,reference:ctx.task.reference,source:structuredClone(ctx.task.source),notice:'资料由内容包提供，尚未独立核验，不进行判分。'});
function fixture() {
    const time=clock(), calls=[], results=[], states=[];
    const client=coaches.create({setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,
        transport:(body,signal)=>{const job=deferred();calls.push({...job,body:JSON.parse(body),signal});return job.promise;},
        onState:s=>states.push(s),onSuccess:r=>results.push(r)});
    return {time,calls,results,states,client};
}
test('coach request takes a deep immutable context snapshot and accepts only one pending call',async()=>{
    const p=fixture(), input=context(), expected=structuredClone(input);
    assert.equal(p.client.send(input),true);assert.equal(p.client.send(input),false);
    input.task.reference='edited';input.task.source.title='edited';await flush();
    assert.deepEqual(p.calls[0].body,expected);
    p.calls[0].resolve(response(result(expected)));await flush();
    assert.equal(p.results.length,1);assert.equal(p.client.isPending(),false);
});
for(const [name,mutate] of [
    ['changed source',r=>r.source.url='https://other.example/'],
    ['changed reference',r=>r.reference='other text'],
    ['false model label',r=>r.mode='model-coach'],
    ['missing follow-up',r=>delete r.followUp],
    ['oversized reply',r=>r.reply='x'.repeat(2401)]
]) test(name+' is rejected before rendering',async()=>{
    const p=fixture(), input=context(), data=result(input);mutate(data);
    p.client.send(input);await flush();p.calls[0].resolve(response(data));await flush();
    assert.equal(p.results.length,0);assert.equal(p.states.at(-1).reason,'invalid-response');assert.equal(p.client.isPending(),false);
});
for(const action of ['cancel','timeout']) test(action+' invalidates a late body while a new request runs',async()=>{
    const p=fixture(), input=context(), body=deferred();p.client.send(input);await flush();
    p.calls[0].resolve({ok:true,json:()=>body.promise});await flush();
    if(action==='cancel')p.client.cancel();else p.time.tick(20000);
    assert.equal(p.calls[0].signal.aborted,true);assert.equal(p.client.isPending(),false);
    p.client.send(input);await flush();body.resolve(result(input));await flush();
    assert.equal(p.results.length,0);assert.equal(p.client.isPending(),true);
    p.calls[1].resolve(response(result(input)));await flush();assert.equal(p.results.length,1);
});
test('HTTP and network failures recover without automatic model requests',async()=>{
    const p=fixture();p.client.send(context());await flush();p.calls[0].resolve({ok:false,status:400});await flush();
    assert.equal(p.states.at(-1).reason,'http');assert.equal(p.client.isPending(),false);
    p.client.send(context());await flush();p.calls[1].reject(Error('offline'));await flush();
    assert.equal(p.states.at(-1).reason,'network');p.time.tick(60000);await flush();assert.equal(p.calls.length,2);
});
