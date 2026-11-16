// REQ-060: execute the real page and keep browser snapshot callbacks independently controllable.
const test = require('node:test');
const assert = require('node:assert/strict');
const {page, turn, response, flush} = require('./campus-fixture.cjs');

async function answer(p, revision, place, extra = {}) {
    p.send('第' + revision + '个地点'); await flush();
    p.chats().at(-1).resolve(response(turn(revision, place, extra))); await flush();
}
function descendants(node, tag) {
    return node.children.flatMap(child => [child, ...descendants(child, tag)]).filter(child => child.tagName === tag);
}
function visibleBackgrounds(p) {
    return p.nodes.get('sceneBackdrop').children.filter(node => node.style.opacity === '1');
}

test('scene and reply commit together while the composer stays interactive', async () => {
    const p = page({viewTransitions:true}); await flush();
    const input = p.nodes.get('campusInput'); input.focus();
    await answer(p, 1, 'pingleyuan-library', {reply:'第一轮图书馆说明'});
    assert.equal(p.transitions.length, 1);
    assert.equal(p.nodes.get('scenePanel').hidden, true);
    assert.doesNotMatch(p.nodes.get('campusReply').textContent, /第一轮/);
    assert.equal(p.nodes.get('sendMessage').disabled, false);
    p.transitions[0].commit(); await flush();
    assert.match(p.nodes.get('sceneContent').textContent, /逸夫图书馆/);
    assert.equal(p.nodes.get('campusReply').textContent, '第一轮图书馆说明');
    assert.equal(p.nodes.get('scenePanel').dataset.motion, 'view');
    assert.equal(p.context.document.documentElement.style['--scene-clip-top'], '70px');
    assert.equal(p.context.document.documentElement.style['--scene-clip-bottom'], '385px');
    assert.equal(p.context.document.activeElement, input);
    assert.equal(p.nodes.get('campusChoices').children.length, 4);
});

test('interrupting an uncaptured turn rejects its delayed scene and dialogue update', async () => {
    const p = page({viewTransitions:true}); await flush();
    await answer(p, 1, 'pingleyuan-library', {reply:'旧回复'});
    const old = p.transitions[0];
    await answer(p, 2, 'pingleyuan-moon-lake', {reply:'新的月亮湖回复'});
    assert.equal(old.skipped, true);
    p.transitions[1].commit(); old.commit(); await flush();
    assert.match(p.nodes.get('sceneContent').textContent, /月亮湖/);
    assert.equal(p.nodes.get('campusReply').textContent, '新的月亮湖回复');
    assert.equal(p.images.length, 1);
    p.transitions[1].finish(); await flush();
    assert.equal(p.nodes.get('scenePanel').dataset.motion, 'view');
});

test('a new conversation owns its return transition over a delayed previous response', async () => {
    const p = page({viewTransitions:true}); await flush();
    await answer(p, 1, 'pingleyuan-library');
    const old = p.transitions[0]; p.click('newConversation'); await flush();
    p.transitions[1].commit(); old.commit(); await flush();
    assert.equal(p.nodes.get('scenePanel').hidden, true);
    assert.equal(p.nodes.get('sceneContent').children.length, 0);
    assert.match(p.nodes.get('campusReply').textContent, /想去哪里/);
    assert.equal(p.nodes.get('campusChoices').children.length, 0);
    assert.equal(p.images.length, 0);
});

test('page exit invalidates an outstanding browser snapshot callback', async () => {
    const p = page({viewTransitions:true}); await flush();
    await answer(p, 1, 'pingleyuan-library'); p.pagehide();
    p.transitions[0].commit(); await flush();
    assert.equal(p.nodes.get('scenePanel').hidden, true);
    assert.equal(p.images.length, 0);
});

test('KEEP_SCENE updates dialogue without rebuilding, scrolling or capturing the scene', async () => {
    const p = page({viewTransitions:true}); await flush();
    await answer(p, 1, 'pingleyuan-library'); p.transitions[0].commit(); p.transitions[0].finish(); await flush();
    const heading = p.nodes.get('sceneContent').children[0]; p.nodes.get('campusStage').scrollTop = 150;
    await answer(p, 2, 'pingleyuan-library', {reply:'可以继续追问', sceneAction:{type:'KEEP_SCENE'}});
    assert.equal(p.transitions.length, 1);
    assert.equal(p.nodes.get('sceneContent').children[0], heading);
    assert.equal(p.nodes.get('campusStage').scrollTop, 150);
    assert.equal(p.nodes.get('campusReply').textContent, '可以继续追问');
});

test('RETURN_STAGE fades back to the central avatar and clears image ownership', async () => {
    const p = page({viewTransitions:true}); await flush();
    await answer(p, 1, 'pingleyuan-library'); p.transitions[0].commit(); p.transitions[0].finish(); await flush();
    const old = p.images[0]; old.onload(); p.tick(16);
    await answer(p, 2, null, {sceneAction:{type:'RETURN_STAGE'}});
    assert.equal(p.nodes.get('scenePanel').hidden, false);
    p.transitions[1].commit(); old.onload(); p.tick(16); await flush();
    assert.equal(p.nodes.get('scenePanel').hidden, true);
    assert.equal(p.nodes.get('campusStage').classList.contains('has-scene'), false);
    assert.equal(visibleBackgrounds(p).length, 0);
});

for (const [name, options] of [
    ['reduced motion', {viewTransitions:true, reducedMotion:true}],
    ['older browser', {}],
    ['snapshot failure', {viewTransitions:true, transitionThrows:true}]
]) test(name + ' renders complete content through the immediate fallback', async () => {
    const p = page(options); await flush(); await answer(p, 1, 'pingleyuan-library');
    assert.equal(p.transitions.length, 0);
    assert.equal(p.nodes.get('scenePanel').hidden, false);
    assert.equal(p.nodes.get('scenePanel').dataset.motion, 'fallback');
    assert.match(p.nodes.get('sceneContent').textContent, /逸夫图书馆/);
    assert.equal(p.nodes.get('campusReply').children[0].className, 'reply-text');
});

test('failed capture falls back without losing a committed response', async () => {
    const p = page({viewTransitions:true}); await flush(); await answer(p, 1, 'pingleyuan-library');
    p.transitions[0].skipTransition(); p.transitions[0].commit(); await flush();
    assert.equal(p.nodes.get('scenePanel').dataset.motion, 'fallback');
    assert.match(p.nodes.get('sceneContent').textContent, /逸夫图书馆/);
});

test('capture rejection before the browser update keeps the CSS fallback', async () => {
    const p = page({viewTransitions:true}); await flush(); await answer(p, 1, 'pingleyuan-library');
    p.transitions[0].skipTransition(); await flush(); p.transitions[0].commit(); await flush();
    assert.equal(p.nodes.get('scenePanel').dataset.motion, 'fallback');
    assert.match(p.nodes.get('sceneContent').textContent, /逸夫图书馆/);
});

test('late photo fades after snapshot removal and retained photos still load after KEEP_SCENE', async () => {
    const p = page({viewTransitions:true}); await flush(); await answer(p, 1, 'pingleyuan-library');
    p.transitions[0].commit();
    const image = descendants(p.nodes.get('sceneContent'), 'IMG')[0]; image.fire('load');
    assert.equal(image.classList.contains('is-ready'), false);
    p.transitions[0].finish(); await flush();
    assert.equal(image.classList.contains('is-ready'), true);
    image.classList.remove('is-ready');
    await answer(p, 2, 'pingleyuan-library', {sceneAction:{type:'KEEP_SCENE'}}); image.fire('load');
    assert.equal(image.classList.contains('is-ready'), true);
    image.fire('error'); assert.equal(image.hidden, true);
    assert.match(p.nodes.get('sceneContent').textContent, /实景暂时未能加载/);
});

test('two fixed background layers crossfade only the newest image and clear on failure', async () => {
    const p = page(); await flush(); await answer(p, 1, 'pingleyuan-library');
    const old = p.images[0]; old.onload();
    await answer(p, 2, 'pingleyuan-moon-lake'); p.images[1].onload();
    old.onload(); old.onerror(); p.tick(16);
    const layers = p.nodes.get('sceneBackdrop').children;
    assert.equal(layers.length, 2); assert.equal(visibleBackgrounds(p).length, 1);
    assert.match(visibleBackgrounds(p)[0].style.backgroundImage, /moon-lake/);
    await answer(p, 3, 'pingleyuan-library'); p.images[2].onerror(); p.tick(16);
    assert.equal(visibleBackgrounds(p).length, 0); assert.equal(layers.length, 2);
});

test('retained scene can finish loading its background during a question and KEEP_SCENE', async () => {
    const p = page(); await flush(); await answer(p, 1, 'pingleyuan-library');
    const loader = p.images[0];
    p.send('再说说'); await flush(); loader.onload(); p.tick(16);
    assert.match(visibleBackgrounds(p)[0].style.backgroundImage, /library/);
    p.chats().at(-1).resolve(response(turn(2, 'pingleyuan-library', {sceneAction:{type:'KEEP_SCENE'}}))); await flush();
    loader.onload(); p.tick(16);
    assert.equal(p.images.length, 1);
    assert.match(visibleBackgrounds(p)[0].style.backgroundImage, /library/);
});

test('page exit suppresses committed photo loaders and queued background frames', async () => {
    const p = page(); await flush(); await answer(p, 1, 'pingleyuan-library');
    p.images[0].onload(); p.pagehide(); p.tick(16); p.images[0].onload(); p.tick(16);
    assert.equal(visibleBackgrounds(p).length, 0);
});
