// REQ-036: execute the actual page adapter with controllable engine events.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { page, flush, response } = require('./chat-fixture.cjs');

const status = p => p.nodes.get('avatarState').dataset.state;
const model = p => { p.context._paramTarget = { setParamFloat() {} }; p.context._mouthParam = 'PARAM_MOUTH_OPEN_Y'; };
async function answer(p, text = '欢迎参观') {
    p.send('介绍一下'); await flush();
    p.requests[p.requests.length - 1].resolve(response({ reply: text })); await flush();
    return p.utterances[p.utterances.length - 1];
}

test('thinking → queued → real start → end updates both labels, stop control and mouth', async () => {
    const p = page(); model(p); await flush();
    p.send('问题'); await flush();
    assert.equal(status(p), 'thinking');
    p.requests[0].resolve(response({ reply: '回答文字' })); await flush();
    const u = p.utterances[0];
    assert.equal(status(p), 'queued'); assert.ok(!p.context._mouthSpeaking);
    assert.equal(p.nodes.get('stopSpeakBtn').disabled, false);
    u.onstart(); assert.equal(status(p), 'speaking'); assert.equal(p.context._mouthSpeaking, true);
    assert.equal(p.nodes.get('avatarState').textContent, p.nodes.get('avatarChatState').textContent);
    u.onend(); assert.equal(status(p), 'idle'); assert.equal(p.context._mouthSpeaking, false);
    assert.equal(p.nodes.get('stopSpeakBtn').disabled, true); assert.equal(p.time.size, 0);
    assert.ok(p.nodes.get('chatMessages').children.some(x => x.innerHTML.includes('回答文字')));
});

test('missing Chinese voice preserves answer and visibly fails without moving mouth', async () => {
    const p = page({ voices: [{ lang: 'en-US' }] }); model(p); await flush();
    await answer(p, '保留的回答');
    assert.equal(status(p), 'queued'); p.time.tick(1500);
    assert.equal(status(p), 'error'); assert.match(p.nodes.get('avatarState').textContent, /中文语音/);
    assert.equal(p.spoken.length, 0); assert.ok(!p.context._mouthSpeaking); assert.equal(p.time.size, 0);
    assert.ok(p.nodes.get('chatMessages').children.some(x => x.innerHTML.includes('保留的回答')));
});

for (const action of ['stop', 'close', 'hide', 'pagehide']) test(action + ' closes mouth and clears timers; old callbacks stay inert', async () => {
    const p = page(); model(p); await flush();
    const u = await answer(p), oldStart = u.onstart, oldEnd = u.onend;
    u.onstart(); p.time.tick(60);
    if (action === 'stop') { p.nodes.get('stopSpeakBtn').fire('click'); p.nodes.get('stopSpeakBtn').fire('click'); }
    else if (action === 'close') p.nodes.get('chatPanelClose').fire('click');
    else p[action]();
    assert.equal(status(p), 'idle'); assert.equal(p.context._mouthSpeaking, false);
    oldStart(); oldEnd(); p.time.tick(10000);
    assert.equal(status(p), 'idle'); assert.equal(p.time.size, 0);
});

test('new question stops old speech and late old end cannot erase thinking/new speech', async () => {
    const p = page(); model(p); await flush();
    const u = await answer(p), oldEnd = u.onend; u.onstart();
    p.send('新问题'); await flush(); oldEnd();
    assert.equal(status(p), 'thinking'); assert.equal(p.context._mouthSpeaking, false);
    p.requests[1].resolve(response({ reply: '新回答' })); await flush();
    p.utterances[1].onstart(); oldEnd();
    assert.equal(status(p), 'speaking'); assert.equal(p.context._mouthSpeaking, true);
    p.nodes.get('stopSpeakBtn').fire('click');
});

test('recognition shows listening only after real start, does not restart on end, rejects late error', async () => {
    const p = page({ manualRecognition: true }); model(p); await flush();
    const u = await answer(p); u.onstart();
    p.nodes.get('voiceBtn').fire('click');
    assert.equal(p.context._mouthSpeaking, false); assert.equal(status(p), 'idle');
    p.recognitions[0].onstart(); assert.equal(status(p), 'listening');
    p.recognitions[0].onend(); assert.equal(status(p), 'idle');
    p.recognitions[0].onerror({ error: 'network' }); assert.equal(status(p), 'idle');
    p.nodes.get('voiceBtn').fire('click'); p.recognitions[0].onerror({ error: 'not-allowed' });
    assert.equal(status(p), 'error'); assert.match(p.nodes.get('voiceStatus').textContent, /麦克风/);
});

test('protocol 2 native events require exact task ID, including pause/close races', async () => {
    const calls = [], bridge = { getTtsProtocolVersion: () => 2, isTtsReady: () => true,
        speakWithId: (text, id) => calls.push({ text, id }), stopSpeaking() {}, startListening() {}, stopListening() {} };
    const p = page({ bridge }); model(p); await flush(); await answer(p);
    assert.equal(p.spoken.length, 0); assert.equal(status(p), 'queued');
    p.context.onTtsStart(); assert.equal(status(p), 'queued');
    const id = calls[0].id; p.context.onTtsStart(id); assert.equal(status(p), 'speaking');
    p.send('新问题'); await flush(); p.context.onTtsEnd(id); assert.equal(status(p), 'thinking');
    p.nodes.get('chatPanelClose').fire('click'); p.context.onTtsStart(id); assert.equal(status(p), 'idle');
});

test('failed request is visible and exploration draft handoff safely stops current speech', async () => {
    const p = page(); model(p); await flush();
    p.send('失败'); await flush(); p.requests[0].reject(new Error('offline')); await flush();
    assert.equal(status(p), 'error');
    const u = await answer(p); u.onstart();
    assert.equal(p.context.GuideChatDraft('我的观察草稿').accepted, true);
    assert.equal(p.context._mouthSpeaking, false); assert.equal(status(p), 'idle');
    assert.equal(p.nodes.get('chatInput').value, '我的观察草稿');
    p.nodes.get('chatPanelClose').fire('click'); assert.equal(p.time.size, 0);
});

test('closing a failed request or backgrounding a recognition error restores idle labels', async () => {
    const p = page(); await flush();
    p.send('失败'); await flush(); p.requests[0].reject(new Error('offline')); await flush();
    assert.equal(status(p), 'error');
    p.nodes.get('chatPanelClose').fire('click');
    assert.equal(status(p), 'idle');
    assert.equal(p.nodes.get('avatarState').textContent, p.nodes.get('avatarChatState').textContent);
    p.nodes.get('voiceBtn').fire('click');
    p.recognitions[0].onerror({ error: 'not-allowed' });
    assert.equal(status(p), 'error');
    p.hide(); assert.equal(status(p), 'idle');
    assert.equal(p.nodes.get('voiceStatus').textContent, '');
    assert.equal(p.time.size, 0);
});
