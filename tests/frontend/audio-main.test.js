const test = require('node:test');
const assert = require('node:assert/strict');
const {page, flush, response} = require('./chat-fixture.cjs');
const state = p => p.nodes.get('avatarState').dataset.state;
const cards = p => p.nodes.get('chatMessages').children.flatMap(message => message.children.filter(child => child.className === 'chat-audio'));
async function answer(p, text = '第一段完整文字\n\n第二段完整文字') {
    await flush(); p.send('介绍一下'); await flush();
    p.requests.at(-1).resolve(response({reply: text, narrationMode: 'family'})); await flush();
    return cards(p).at(-1);
}
const playPart = (card, index) => card.children[2].children[index].children[0].fire('click');
const full = card => card.children[1].children[0].fire('click');

test('replaying a paragraph preserves draft, mode and context, and creates no chat request', async () => {
    const p = page(), card = await answer(p), context = p.nodes.get('chatContext').textContent;
    const oldStart = p.utterances[0].onstart, oldEnd = p.utterances[0].onend;
    p.nodes.get('chatInput').value = '未发送的草稿'; playPart(card, 1);
    assert.equal(p.requests.length, 1); assert.equal(p.spoken.at(-1), '第二段完整文字');
    assert.equal(p.nodes.get('chatInput').value, '未发送的草稿');
    assert.equal(p.nodes.get('chatContext').textContent, context); assert.equal(p.nodes.get('chatNarrationMode').value, 'family');
    assert.equal(state(p), 'queued'); oldStart(); oldEnd(); assert.equal(state(p), 'queued');
    p.utterances.at(-1).onstart(); assert.equal(state(p), 'speaking');
    assert.match(card.children[3].textContent, /正在播放.*第 2 段/);
    p.utterances.at(-1).onend(); assert.equal(card.children[1].children[1].disabled, true);
});

test('history replay replaces current card ownership and old end cannot reset the new card', async () => {
    const p = page(), first = await answer(p), oldEnd = p.utterances[0].onend;
    const second = await answer(p, '后一条回答');
    full(first); const current = p.utterances.at(-1); current.onstart(); oldEnd();
    assert.equal(state(p), 'speaking'); assert.equal(first.children[1].children[0].attributes['aria-pressed'], 'true');
    assert.equal(second.children[1].children[1].disabled, true);
    first.children[1].children[1].fire('click'); assert.equal(state(p), 'idle');
    assert.equal(first.children[1].children[1].disabled, true);
});

for (const action of ['close', 'hide', 'pagehide', 'new-question']) test(action + ' clears replay and rejects old callbacks', async () => {
    const p = page(), card = await answer(p); playPart(card, 0);
    const current = p.utterances.at(-1), end = current.onend; current.onstart();
    if (action === 'close') p.nodes.get('chatPanelClose').fire('click');
    else if (action === 'new-question') p.send('新的问题');
    else p[action]();
    const expected = action === 'new-question' ? 'thinking' : 'idle';
    assert.equal(state(p), expected); assert.equal(card.children[1].children[1].disabled, true);
    end(); assert.equal(state(p), expected);
});

test('busy refusal keeps thinking and draft, while unavailable voice leaves text and retry controls', async () => {
    const p = page(), card = await answer(p); p.send('第二个问题'); await flush();
    p.nodes.get('chatInput').value = '保留草稿'; full(card);
    assert.equal(p.requests.length, 2); assert.equal(state(p), 'thinking');
    assert.equal(p.nodes.get('chatInput').value, '保留草稿'); assert.match(card.children[3].textContent, /当前提问/);
    const missing = page({voices: [{lang: 'en-US'}]}), missingCard = await answer(missing);
    missing.time.tick(1500); assert.equal(state(missing), 'error');
    assert.match(missingCard.children[3].textContent, /中文语音/); assert.equal(missingCard.children[1].children[1].disabled, true);
    missing.voicesChanged([{lang: 'zh-CN'}]); full(missingCard); assert.equal(state(missing), 'queued');
});

test('replay cancels scheduled voice submission but keeps recognized text', async () => {
    const p = page(), card = await answer(p); p.nodes.get('voiceBtn').fire('click');
    const result = [{transcript: '识别到的问题'}]; result.isFinal = true;
    p.recognitions[0].onresult({resultIndex: 0, results: [result]});
    full(card); p.time.tick(300);
    assert.equal(p.requests.length, 1); assert.equal(p.nodes.get('chatInput').value, '识别到的问题');
});


test('a title-only paragraph is refused before interrupting current speech', async () => {
    const p = page(), card = await answer(p, '【灵山大佛】\n\n第二段介绍');
    p.utterances[0].onstart(); const count = p.spoken.length, stops = p.stops;
    playPart(card, 0);
    assert.equal(p.spoken.length, count); assert.equal(p.stops, stops); assert.equal(state(p), 'speaking');
    assert.match(card.children[3].textContent, /没有可播报正文/);
    assert.equal(card.children[1].children[0].attributes['aria-pressed'], 'true');
});

test('a whole reply cleaned to empty has a visible replay refusal', async () => {
    const p = page(), card = await answer(p, '【灵山大佛】');
    assert.equal(p.spoken.length, 0); full(card);
    assert.equal(p.spoken.length, 0); assert.match(card.children[2].textContent, /没有可播报正文/);
    assert.equal(card.children[1].children[1].disabled, true); assert.equal(state(p), 'idle');
});
