const test = require('node:test');
const assert = require('node:assert/strict');
const {createEnv} = require('./harness');
const followups = require('../../src/main/resources/static/js/chat-followups');
const click = node => node.dispatch('click', {stopPropagation() {}});

test('follow-up card snapshots the station, uses plain text and only prepares fixed questions', () => {
    const env = createEnv(), parent = env.document.createElement('div'), calls = [];
    const spot = {id: 11, name: '<img src=x onerror=alert(1)>'};
    const card = followups.append(env.document, parent, spot, (text, id) => {
        calls.push({text, id}); return {accepted: true};
    });
    spot.id = 99; spot.name = 'changed';
    assert.equal(card.tagName, 'DETAILS');
    assert.equal(card.children[0].textContent, '继续了解 <img src=x onerror=alert(1)>');
    assert.match(card.children[0].innerHTML, /&lt;img/);
    assert.equal(calls.length, 0);
    card.children[2].children.forEach(click);
    assert.equal(calls.length, 3);
    assert.ok(calls.every(call => call.id === 11 && call.text.startsWith('关于【<img')));
    assert.match(calls[0].text, /三句/);
    assert.match(calls[1].text, /区分比喻与史实/);
    assert.match(calls[2].text, /资料不足/);
    assert.match(card.children[3].textContent, /确认后发送/);
});

test('invalid or unknown station never creates a card or invokes preparation', () => {
    const env = createEnv(), parent = env.document.createElement('div');
    for (const spot of [null, {}, {id: 0, name: 'x'}, {id: 1.2, name: 'x'}, {id: 1, name: ' '}, {id: 1, name: 'x'.repeat(201)}]) {
        assert.equal(followups.append(env.document, parent, spot, () => assert.fail()), null);
    }
    assert.equal(parent.children.length, 0);
});

test('rejected preparation reports its reason in the same card as safe live feedback', () => {
    const env = createEnv(), parent = env.document.createElement('div');
    const card = followups.append(env.document, parent, {id: 2, name: '本站'}, () => ({accepted: false, reason: '<草稿保留>'}));
    click(card.children[2].children[0]);
    assert.equal(card.children[3].textContent, '<草稿保留>');
    assert.equal(card.children[3].role, 'status');
    assert.equal(card.children[3]['aria-live'], 'polite');
    assert.equal(card.children[3].innerHTML, '&lt;草稿保留&gt;');
});
