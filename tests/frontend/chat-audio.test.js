const test = require('node:test');
const assert = require('node:assert/strict');
const {createEnv} = require('./harness');
const audio = require('../../src/main/resources/static/js/chat-audio');
const click = node => node.dispatch('click', {stopPropagation() {}});

test('blank-line splitting normalizes newlines and preserves overflow in the final part', () => {
    assert.deepEqual(audio.paragraphs(null), []); assert.deepEqual(audio.paragraphs('  '), []);
    assert.deepEqual(audio.paragraphs('甲\r\n\r\n乙\n丙'), ['甲', '乙\n丙']);
    const original = Array.from({length: 20}, (_, i) => '完整段落' + i).join('\n\n');
    const parts = audio.paragraphs(original);
    assert.equal(parts.length, 12); assert.equal(parts.join('\n\n'), original);
});

test('replay controls keep full snapshots, preview as text and follow actual playback state', () => {
    const env = createEnv(), parent = env.document.createElement('div'), calls = [];
    const text = '<img onerror=bad()>\n\n第二段完整文字';
    let stopped;
    const handle = audio.append(env.document, parent, text, {
        play(value, card, index) { calls.push({value, card, index}); return {accepted: true}; },
        stop(card) { stopped = card; }
    });
    const card = parent.children[0], actions = card.children[1], list = card.children[2];
    assert.equal(calls.length, 0); assert.equal(actions.children[1].disabled, true);
    assert.match(list.children[0].children[0].innerHTML, /&lt;img/);
    click(list.children[1].children[0]); assert.equal(calls[0].value, '第二段完整文字'); assert.equal(calls[0].index, 1);
    handle.render({status: 'queued'}, 1);
    assert.equal(list.children[1].children[0]['aria-pressed'], 'true');
    assert.equal(actions.children[0]['aria-pressed'], 'false'); assert.equal(actions.children[1].disabled, false);
    handle.render({status: 'speaking'}, 1); assert.match(card.children[3].textContent, /正在播放.*第 2 段/);
    click(actions.children[1]); assert.equal(stopped, handle);
    handle.render({status: 'idle'}, 1); assert.equal(actions.children[1].disabled, true);
    click(actions.children[0]); assert.equal(calls[1].value, text); assert.equal(calls[1].index, -1);
    handle.render({status: 'error', message: '<没有声音>'}, -1);
    assert.equal(card.children[3].textContent, '<没有声音>');
});

test('single paragraph offers full replay and refused requests report without changing pressed state', () => {
    const env = createEnv(), parent = env.document.createElement('div');
    assert.equal(audio.append(env.document, parent, '', {}), null);
    const handle = audio.append(env.document, parent, '只有一段', {
        play() { return {accepted: false, reason: '等待当前提问'}; }, stop() {}
    });
    const card = parent.children[0]; assert.equal(card.children.length, 3);
    click(card.children[1].children[0]); assert.match(card.children[2].textContent, /等待/);
    assert.equal(card.children[1].children[0]['aria-pressed'], 'false');
    handle.render({status: 'paused'}, -1); assert.match(card.children[2].textContent, /已暂停/);
});
