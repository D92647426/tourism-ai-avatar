const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../../src/main/resources/static/js/chat-request');
const { deferred, clock, flush, response } = require('./chat-fixture.cjs');

function fixture() {
    const time = clock(), jobs = [], states = [], successes = [], starts = [];
    const controller = create({ timeoutMs: 30, setTimeout: time.setTimeout, clearTimeout: time.clearTimeout,
        request(payload, signal) { const job = deferred(); jobs.push({ ...job, payload, signal }); return job.promise; },
        onStart: (...args) => starts.push(args), onState: s => states.push(s), onSuccess: r => successes.push(r) });
    return { controller, time, jobs, states, successes, starts };
}

test('single flight rejects duplicates, takes immutable snapshots and succeeds once', async () => {
    const f = fixture(), payload = { message: 'one', interest: 'history' };
    assert.equal(f.controller.send(payload), true); payload.message = 'mutated';
    assert.equal(f.controller.send({ message: 'two' }), false);
    await flush(); assert.equal(f.jobs.length, 1); assert.equal(f.jobs[0].payload.message, 'one');
    f.jobs[0].resolve(response({ reply: 'answer' })); await flush();
    assert.equal(f.successes.length, 1); assert.equal(f.time.size, 0);
    assert.deepEqual(f.controller.getState(), { status: 'succeeded', reason: '', canRetry: false });
});

for (const [label, resolve, reason] of [
    ['HTTP 401', () => ({ ok: false, status: 401 }), 'http'],
    ['HTTP 500', () => ({ ok: false, status: 500 }), 'http'],
    ['invalid JSON', () => ({ ok: true, json: () => Promise.reject(new SyntaxError()) }), 'invalid-response'],
    ['empty reply', () => response({ reply: ' ' }), 'invalid-response'],
    ['missing reply', () => response({ fallback: true }), 'invalid-response']
]) test(label + ' ends waiting and enables explicit retry', async () => {
    const f = fixture(); f.controller.send({ message: 'question' }); await flush();
    f.jobs[0].resolve(resolve()); await flush();
    assert.equal(f.controller.getState().reason, reason); assert.equal(f.controller.getState().canRetry, true);
    assert.equal(f.controller.isPending(), false); assert.equal(f.successes.length, 0); assert.equal(f.time.size, 0);
});

test('network failure does not automatically retry; manual retry retains original interest', async () => {
    const f = fixture(); f.controller.send({ message: 'one', interest: 'history' }); await flush();
    f.jobs[0].reject(new Error('offline')); await flush(); assert.equal(f.jobs.length, 1);
    assert.equal(f.controller.retry(), true); assert.equal(f.controller.retry(), false); await flush();
    assert.deepEqual(f.jobs[1].payload, { message: 'one', interest: 'history' }); assert.equal(f.starts[1][1], true);
    f.jobs[1].resolve(response({ reply: 'ok' })); await flush(); assert.equal(f.successes.length, 1);
});

for (const end of ['timeout', 'cancel']) for (const late of ['success', 'failure', 'parsing']) {
    test(end + ' fences late ' + late + ' even when transport ignores abort', async () => {
        const f = fixture(), body = deferred(); f.controller.send({ message: 'old' }); await flush();
        if (late === 'parsing') { f.jobs[0].resolve({ ok: true, json: () => body.promise }); await flush(); }
        if (end === 'timeout') f.time.tick(30); else f.controller.cancel();
        assert.equal(f.jobs[0].signal.aborted, true); assert.equal(f.controller.isPending(), false);
        f.controller.send({ message: 'new' }); await flush();
        if (late === 'failure') f.jobs[0].reject(new Error('old failure'));
        else if (late === 'parsing') body.resolve({ reply: 'old answer' });
        else f.jobs[0].resolve(response({ reply: 'old answer' }));
        await flush(); assert.equal(f.controller.isPending(), true); assert.equal(f.successes.length, 0);
        f.jobs[1].resolve(response({ reply: 'new answer' })); await flush();
        assert.deepEqual(f.successes, [{ reply: 'new answer' }]); assert.equal(f.time.size, 0);
    });
}

test('cancel before transport dispatch does not send and new question clears old retry', async () => {
    const f = fixture(); f.controller.send({ message: 'old' }); f.controller.cancel();
    await flush(); assert.equal(f.jobs.length, 0);
    f.controller.send({ message: 'new' }); assert.equal(f.controller.getState().canRetry, false);
    await flush(); f.jobs[0].resolve(response({ reply: 'ok' })); await flush(); assert.equal(f.controller.retry(), false);
});

test('empty questions are ignored without side effects', () => {
    const f = fixture(); assert.equal(f.controller.send({ message: ' ' }), false);
    assert.equal(f.states.length, 0); assert.equal(f.starts.length, 0); assert.equal(f.time.size, 0);
});
