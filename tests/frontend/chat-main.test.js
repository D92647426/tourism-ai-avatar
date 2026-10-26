const { test } = require('node:test');
const assert = require('node:assert/strict');
const { page, flush, response } = require('./chat-fixture.cjs');

test('all busy entry points preserve the draft, one bubble, one request and one typing indicator', async () => {
    const p = page(); await flush(); p.send('first'); await flush();
    const messages = p.nodes.get('chatMessages').children;
    assert.equal(messages[messages.length - 1].id, 'typingIndicator');
    assert.match(messages[messages.length - 2].innerHTML, /first/);
    const stops = p.stops; p.nodes.get('chatInput').value = 'draft';
    p.nodes.get('chatSendBtn').fire('click');
    p.nodes.get('chatInput').fire('keydown', { key: 'Enter' });
    p.nodes.get('quickActions').fire('click', { target: p.quick });
    p.context.onSpeechStart(); p.context.onSpeechPartial('late'); p.context.onSpeechResult('late');
    p.nodes.get('voiceBtn').fire('click');
    p.recognitions[0].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'late' }], { isFinal: true })] });
    p.time.tick(500); await flush();
    assert.equal(p.requests.length, 1); assert.equal(p.typing().length, 1);
    assert.equal(p.nodes.get('chatInput').value, 'draft'); assert.equal(p.stops, stops);
    assert.equal(p.quick.disabled, true); assert.equal(p.nodes.get('chatCancelBtn').hidden, false);
    p.requests[0].resolve(response({ reply: 'answer' })); await flush();
    assert.equal(p.spoken.length, 1); assert.equal(p.typing().length, 0);
    assert.equal(p.nodes.get('chatSendBtn').disabled, false); assert.equal(p.quick.disabled, false);
    assert.equal(p.nodes.get('chatInput').value, 'draft');
});

test('manual retry retains question, avoids duplicate bubbles and preserves edited draft', async () => {
    const p = page(); await flush(); p.send('first'); await flush();
    p.requests[0].reject(new Error('offline')); await flush();
    assert.equal(p.nodes.get('chatRetryBtn').hidden, false); assert.equal(p.typing().length, 0);
    const count = p.nodes.get('chatMessages').children.length;
    p.nodes.get('chatInput').value = 'draft'; p.nodes.get('chatRetryBtn').fire('click'); await flush();
    assert.equal(p.requests[1].body.message, 'first'); assert.equal(p.nodes.get('chatInput').value, 'draft');
    assert.equal(p.nodes.get('chatMessages').children.length, count + 1); // only typing added
    p.requests[1].resolve(response({ reply: 'recovered' })); await flush();
    assert.equal(p.nodes.get('chatMessages').children.length, count + 1); // only answer added
    assert.equal(p.nodes.get('chatRetryBtn').hidden, true);
});

for (const action of ['cancel', 'close', 'timeout']) test(action + ' drops obsolete replies and permits a new question', async () => {
    const p = page(); await flush(); p.send('old'); await flush();
    if (action === 'cancel') p.nodes.get('chatCancelBtn').fire('click');
    else if (action === 'close') p.nodes.get('chatPanelClose').fire('click');
    else p.time.tick(30000);
    assert.equal(p.typing().length, 0); assert.equal(p.nodes.get('chatSendBtn').disabled, false);
    assert.equal(p.requests[0].options.signal.aborted, true);
    p.send('new'); await flush(); p.requests[0].resolve(response({ reply: 'old' })); await flush();
    assert.equal(p.spoken.length, 0); assert.equal(p.typing().length, 1);
    p.requests[1].resolve(response({ reply: 'new' })); await flush();
    assert.deepEqual(p.spoken, ['new']); assert.equal(p.typing().length, 0);
});

test('native and web speech results enter the same send flow', async () => {
    const p = page(); await flush(); p.startNative(); p.context.onSpeechResult('native');
    p.time.tick(200); await flush(); assert.equal(p.requests[0].body.message, 'native');
    p.requests[0].resolve(response({ reply: 'one' })); await flush();
    delete p.context.AndroidSpeech;
    p.nodes.get('voiceBtn').fire('click');
    p.recognitions[0].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'web' }], { isFinal: true })] });
    p.time.tick(200); await flush(); assert.equal(p.requests[1].body.message, 'web');
    p.nodes.get('chatCancelBtn').fire('click');
});

test('late scheduled speech cannot replace an edited draft or send after panel close', async () => {
    const p = page(); await flush(); p.startNative(); p.context.onSpeechResult('recognized');
    p.nodes.get('chatInput').value = 'edited draft'; p.time.tick(200); await flush();
    assert.equal(p.requests.length, 0); assert.equal(p.nodes.get('chatInput').value, 'edited draft');
    p.startNative(); p.context.onSpeechResult('next'); p.nodes.get('chatPanelClose').fire('click');
    p.time.tick(200); await flush(); assert.equal(p.requests.length, 0);
    p.context.onSpeechStart(); p.context.onSpeechResult('stale after close');
    p.time.tick(200); await flush(); assert.equal(p.requests.length, 0);
});

test('failed HTTP clears waiting and shows a retryable error without speaking', async () => {
    const p = page(); await flush(); p.send('one'); await flush();
    p.requests[0].resolve({ ok: false, status: 500 }); await flush();
    assert.equal(p.typing().length, 0); assert.equal(p.nodes.get('chatSendBtn').disabled, false);
    assert.equal(p.nodes.get('chatRetryBtn').hidden, false); assert.ok(p.nodes.get('chatRequestStatus').textContent);
    assert.equal(p.spoken.length, 0);
});

test('starting a new voice session invalidates the prior delayed send', async () => {
    for (const native of [true, false]) {
        const p = page(); await flush();
        const result = text => {
            if (native) p.context.onSpeechResult(text);
            else p.recognitions[0].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });
        };
        const start = () => native ? p.startNative() : p.nodes.get('voiceBtn').fire('click');
        start(); result('old recognized'); start();
        p.time.tick(200); await flush();
        assert.equal(p.requests.length, 0);
        assert.equal(p.nodes.get('voiceBtn').textContent, '🔴');
        result('new recognized'); p.time.tick(200); await flush();
        assert.equal(p.requests.length, 1); assert.equal(p.requests[0].body.message, 'new recognized');
        p.nodes.get('chatCancelBtn').fire('click');
    }
});

test('exploration handoff protects busy requests and existing drafts and never automatically sends', async () => {
    const p = page(); await flush();
    p.nodes.get('chatInput').value = 'existing draft';
    assert.equal(p.context.GuideChatDraft('exploration question').accepted, false);
    assert.equal(p.nodes.get('chatInput').value, 'existing draft');
    p.send('busy'); await flush();
    assert.equal(p.context.GuideChatDraft('exploration question').accepted, false);
    p.nodes.get('chatCancelBtn').fire('click');
    assert.equal(p.context.GuideChatDraft('exploration question').accepted, true);
    assert.equal(p.nodes.get('chatInput').value, 'exploration question');
    assert.equal(p.requests.length, 1);
    assert.equal(p.context.GuideChatDraft('').accepted, false);
});
