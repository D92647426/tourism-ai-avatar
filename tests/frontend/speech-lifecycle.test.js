// REQ-036 / #7: behaviour tests for the speech lifecycle module.
// Deterministic fake clock and hand-built synthesis/native mocks; no browser.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../../src/main/resources/static/js/speech-lifecycle');
const { clock } = require('./chat-fixture.cjs');

function Utterance(text) {
    this.text = text;
    this.lang = '';
    this.voice = null;
    this.rate = 0;
    this.pitch = 0;
    this.volume = 0;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
    this.onpause = null;
    this.onresume = null;
}

function createSynthesis() {
    const state = { voices: [], spoken: [], cancels: 0, listeners: new Set(), onCancel: null };
    const synthesis = {
        getVoices: () => state.voices.slice(),
        speak: utterance => state.spoken.push(utterance),
        cancel: () => { state.cancels += 1; if (state.onCancel) state.onCancel(); },
        addEventListener: (type, fn) => { if (type === 'voiceschanged') state.listeners.add(fn); },
        removeEventListener: (type, fn) => { if (type === 'voiceschanged') state.listeners.delete(fn); }
    };
    return {
        synthesis, state,
        emit(voices) { state.voices = voices.slice(); for (const fn of [...state.listeners]) fn(); }
    };
}

function createBridge(initial = {}) {
    const state = { calls: [], stops: 0, protocol: 2, ready: true,
        throwVersion: false, throwReady: false, throwSpeak: false, ...initial };
    const bridge = {
        getTtsProtocolVersion() { if (state.throwVersion) throw new Error('bridge version'); return state.protocol; },
        isTtsReady() { if (state.throwReady) throw new Error('bridge ready'); return state.ready; },
        speakWithId(text, id) { state.calls.push({ text, id }); if (state.throwSpeak) throw new Error('bridge speak'); },
        stopSpeaking() { state.stops += 1; }
    };
    return { bridge, state };
}

function harness(extra = {}) {
    const time = clock();
    const changes = [], mouths = [];
    const web = createSynthesis();
    const speech = create({
        synthesis: web.synthesis,
        Utterance,
        nativeBridge: extra.bridge || null,
        onChange: change => changes.push(change),
        onMouth: value => mouths.push(value),
        setTimeout: time.setTimeout,
        clearTimeout: time.clearTimeout
    });
    return {
        time, changes, mouths, web, speech,
        state: () => speech.getState(),
        last: () => changes[changes.length - 1],
        // Speak through Web with a ready Chinese voice; returns the utterance.
        webSpeak(text) {
            web.state.voices = [{ lang: 'en-US' }, { lang: 'zh-CN' }];
            speech.speak(text);
            return web.state.spoken[web.state.spoken.length - 1];
        }
    };
}

test('空白或非字符串文本被忽略，不产生任务、定时器或回调', () => {
    const h = harness();
    assert.equal(h.speech.speak(' \n\t '), false);
    assert.equal(h.speech.speak(null), false);
    assert.equal(h.speech.speak(42), false);
    assert.deepEqual(h.changes, []);
    assert.deepEqual(h.mouths, []);
    assert.equal(h.time.size, 0);
    assert.deepEqual(h.state(), { status: 'idle', message: '' });
});

test('Web 中文声线可用时立即提交，口型只在 onstart 后张开并保留原默认参数', () => {
    const h = harness();
    h.web.state.voices = [{ lang: 'en-US' }, { lang: 'zh-CN' }];
    assert.equal(h.speech.speak(' 你好，欢迎来到博物馆 '), true);
    assert.equal(h.last().status, 'queued');
    assert.equal(h.web.state.spoken.length, 1);
    const u = h.web.state.spoken[0];
    assert.equal(u.text, '你好，欢迎来到博物馆');
    assert.equal(u.lang, 'zh-CN');
    assert.equal(u.voice.lang, 'zh-CN');
    assert.equal(u.rate, 1.05);
    assert.equal(u.pitch, 1.1);
    assert.equal(u.volume, 1);
    assert.deepEqual(h.mouths, []);
    assert.equal(h.state().status, 'queued');
    u.onstart({});
    assert.deepEqual(h.state(), { status: 'speaking', message: '' });
    assert.deepEqual(h.mouths, [true]);
    u.onend({});
    assert.deepEqual(h.state(), { status: 'idle', message: '' });
    assert.deepEqual(h.mouths, [true, false]);
    assert.equal(h.time.size, 0);
});

test('Web 声线异步为空时等待 voiceschanged，加载后启动且监听被移除', () => {
    const h = harness();
    assert.equal(h.speech.speak('稍等'), true);
    assert.equal(h.web.state.spoken.length, 0);
    assert.equal(h.web.state.listeners.size, 1);
    assert.equal(h.time.size, 2); // 启动期限 + 声线等待
    h.time.tick(1499);
    assert.equal(h.state().status, 'queued');
    h.web.emit([{ lang: 'zh-CN' }]);
    assert.equal(h.web.state.spoken.length, 1);
    assert.equal(h.web.state.listeners.size, 0);
    h.web.state.spoken[0].onstart({});
    assert.equal(h.state().status, 'speaking');
    assert.deepEqual(h.mouths, [true]);
});

test('Web 始终无中文声线时在 1500 毫秒后提示文字仍可阅读，不假装成功', () => {
    const h = harness();
    h.speech.speak('回答文字');
    h.time.tick(1499);
    assert.equal(h.state().status, 'queued');
    assert.equal(h.web.state.spoken.length, 0);
    h.time.tick(1);
    assert.equal(h.state().status, 'error');
    assert.match(h.state().message, /文字内容仍可阅读/);
    assert.equal(h.web.state.listeners.size, 0);
    assert.equal(h.time.size, 0);
});

test('启动 8 秒期限从 speak 提交时刻起算，包含声线等待时间', () => {
    const h = harness();
    h.speech.speak('一段较长的回答');
    h.time.tick(1499);
    h.web.emit([{ lang: 'zh-CN' }]);
    const lateStart = h.web.state.spoken[0].onstart;
    h.time.tick(6500); // 共 7999ms
    assert.equal(h.state().status, 'queued');
    h.time.tick(1);
    assert.equal(h.state().status, 'error');
    assert.match(h.state().message, /启动超时/);
    assert.equal(h.web.state.cancels, 1);
    assert.equal(h.time.size, 0);
    lateStart({}); // 超时后迟到的启动事件必须忽略
    assert.equal(h.state().status, 'error');
    assert.deepEqual(h.mouths, []);
});

test('播报异常固定 120 秒上限到期取消引擎并进入 error，不假装自然结束', () => {
    const h = harness();
    const u = h.webSpeak('回答');
    u.onstart({});
    h.time.tick(119999);
    assert.equal(h.state().status, 'speaking');
    h.time.tick(1);
    assert.equal(h.state().status, 'error');
    assert.match(h.state().message, /文字内容仍可阅读/);
    assert.equal(h.web.state.cancels, 1);
    assert.deepEqual(h.mouths, [true, false]);
    assert.equal(h.time.size, 0);
});

test('播放错误立即闭嘴、清理所有定时器并保留文字提示', () => {
    const h = harness();
    const u = h.webSpeak('回答');
    u.onstart({});
    u.onerror({ error: 'network' });
    assert.equal(h.state().status, 'error');
    assert.match(h.state().message, /network/);
    assert.match(h.state().message, /文字内容仍可阅读/);
    assert.deepEqual(h.mouths, [true, false]);
    assert.equal(h.time.size, 0);
    assert.equal(u.onend, null);
});

test('暂停闭嘴并冻结故障上限，恢复只作用于已开始的当前任务', () => {
    const h = harness();
    const u = h.webSpeak('回答');
    u.onresume({}); // 尚未开始：忽略
    assert.equal(h.state().status, 'queued');
    assert.equal(h.changes.length, 1);
    u.onstart({});
    u.onpause({});
    assert.equal(h.state().status, 'paused');
    assert.deepEqual(h.mouths, [true, false]);
    assert.equal(h.time.size, 0);
    h.time.tick(200000);
    assert.equal(h.state().status, 'paused');
    u.onresume({});
    assert.equal(h.state().status, 'speaking');
    assert.deepEqual(h.mouths, [true, false, true]);
    h.time.tick(120000);
    assert.equal(h.state().status, 'error');
});

test('stop 先隔离身份再取消引擎；同步引擎回调、迟到回调与重复停止都安全', () => {
    const h = harness();
    const u = h.webSpeak('回答');
    u.onstart({});
    const lateStart = u.onstart, lateEnd = u.onend, lateError = u.onerror;
    h.web.state.onCancel = () => { if (u.onend) u.onend({}); }; // 模拟 cancel 同步触发 onend
    assert.equal(h.speech.stop(), true);
    assert.equal(h.state().status, 'idle');
    assert.deepEqual(h.mouths, [true, false]);
    assert.equal(h.web.state.cancels, 1);
    assert.equal(h.time.size, 0);
    lateStart({});
    lateEnd({});
    lateError({ error: 'interrupted' });
    assert.equal(h.state().status, 'idle');
    assert.equal(h.mouths.length, 2);
    const count = h.changes.length;
    assert.equal(h.speech.stop(), false);
    assert.equal(h.changes.length, count);
});

test('新播报替换旧任务：旧任务迟到事件不得改写新状态或口型', () => {
    const h = harness();
    const first = h.webSpeak('第一段');
    first.onstart({});
    const lateEnd = first.onend, lateError = first.onerror;
    assert.equal(h.speech.speak('第二段'), true);
    assert.equal(h.state().status, 'queued');
    assert.deepEqual(h.mouths, [true, false]);
    assert.equal(h.web.state.cancels, 1);
    lateEnd({});
    lateError({ error: 'interrupted' });
    assert.equal(h.state().status, 'queued');
    assert.equal(h.mouths.length, 2);
    const second = h.web.state.spoken[1];
    assert.equal(second.text, '第二段');
    second.onstart({});
    assert.equal(h.state().status, 'speaking');
    assert.deepEqual(h.mouths, [true, false, true]);
    assert.equal(h.time.size, 1); // 第二段的 120 秒故障上限
});

test('setActivity 先停播报再更新页面活动，非法值抛 TypeError 且不改状态', () => {
    const h = harness();
    const u = h.webSpeak('回答');
    u.onstart({});
    assert.equal(h.speech.setActivity('listening'), true);
    assert.equal(h.state().status, 'listening');
    assert.deepEqual(h.mouths, [true, false]);
    assert.equal(h.web.state.cancels, 1);
    assert.equal(h.time.size, 0);
    assert.equal(h.speech.setActivity('thinking'), true);
    assert.equal(h.state().status, 'thinking');
    assert.throws(() => h.speech.setActivity('speaking'), TypeError);
    assert.equal(h.state().status, 'thinking');
    assert.equal(h.speech.setActivity('idle'), true);
    assert.equal(h.state().status, 'idle');
    const count = h.changes.length;
    h.speech.setActivity('idle');
    assert.equal(h.changes.length, count); // 状态不变不重复通知
});

test('协议 2 且就绪时使用 speakWithId，并按精确任务 ID 接受回调', () => {
    const native = createBridge();
    const h = harness({ bridge: native.bridge });
    assert.equal(h.speech.speak(' 你好 '), true);
    assert.equal(native.state.calls.length, 1);
    assert.equal(native.state.calls[0].text, '你好');
    assert.match(native.state.calls[0].id, /^gs-[a-z0-9]+-\d+$/);
    assert.equal(h.web.state.spoken.length, 0);
    assert.equal(h.state().status, 'queued');
    assert.deepEqual(h.mouths, []);
    const id = native.state.calls[0].id;
    assert.equal(h.speech.nativeEvent('start', 'gs-other-1'), false);
    assert.equal(h.speech.nativeEvent('start', undefined), false); // 无 ID 拒绝
    assert.equal(h.state().status, 'queued');
    assert.equal(h.speech.nativeEvent('start', id), true);
    assert.equal(h.state().status, 'speaking');
    assert.deepEqual(h.mouths, [true]);
    assert.equal(h.speech.nativeEvent('end', id), true);
    assert.equal(h.state().status, 'idle');
    assert.deepEqual(h.mouths, [true, false]);
    assert.equal(h.time.size, 0);
    assert.equal(h.speech.nativeEvent('end', id), false);
});

test('协议 2 未就绪时降级 Web 中文声线，原生桥不接收任务', () => {
    const native = createBridge({ ready: false });
    const h = harness({ bridge: native.bridge });
    h.webSpeak('回答');
    assert.equal(native.state.calls.length, 0);
    assert.equal(h.web.state.spoken.length, 1);
    assert.equal(h.state().status, 'queued');
    assert.equal(h.speech.nativeEvent('start', 'gs-any-1'), false);
});

test('旧协议不使用不可靠回调：降级 Web，无中文声线时提示重建 APK', () => {
    const legacy = createBridge({ protocol: 1 });
    const h = harness({ bridge: legacy.bridge });
    h.webSpeak('回答');
    assert.equal(legacy.state.calls.length, 0);
    assert.equal(h.web.state.spoken.length, 1);

    const noVersion = { isTtsReady: () => true, speakWithId() {}, stopSpeaking() {} };
    const g = harness({ bridge: noVersion });
    g.speech.speak('回答');
    assert.equal(g.web.state.spoken.length, 0);
    g.time.tick(1500);
    assert.equal(g.state().status, 'error');
    assert.match(g.state().message, /文字内容仍可阅读/);
    assert.match(g.state().message, /APK/);
});

test('桥查询异常降级 Web 不抛出；speakWithId 异常转为 error 并尝试停止引擎', () => {
    const badReady = createBridge({ throwReady: true });
    const h = harness({ bridge: badReady.bridge });
    h.webSpeak('回答');
    assert.equal(h.web.state.spoken.length, 1);
    assert.equal(badReady.state.calls.length, 0);

    const badVersion = createBridge({ throwVersion: true });
    const v = harness({ bridge: badVersion.bridge });
    v.webSpeak('回答');
    assert.equal(v.web.state.spoken.length, 1);

    const badSpeak = createBridge({ throwSpeak: true });
    const g = harness({ bridge: badSpeak.bridge });
    assert.doesNotThrow(() => g.speech.speak('回答'));
    assert.equal(g.state().status, 'error');
    assert.match(g.state().message, /文字内容仍可阅读/);
    assert.equal(badSpeak.state.stops, 1);
    assert.equal(g.time.size, 0);
});

test('重载后的新旧页面任务 ID 互不相同，旧 ID 不能污染新实例', () => {
    const pageA = createBridge();
    const a = harness({ bridge: pageA.bridge });
    a.speech.speak('旧页面');
    const oldId = pageA.state.calls[0].id;
    a.speech.destroy();

    const pageB = createBridge();
    const b = harness({ bridge: pageB.bridge });
    b.speech.speak('新页面');
    const newId = pageB.state.calls[0].id;
    assert.notEqual(oldId, newId);
    assert.notEqual(oldId.split('-')[1], newId.split('-')[1]); // 页面级 nonce 不同
    assert.equal(b.speech.nativeEvent('start', oldId), false);
    assert.equal(b.state().status, 'queued');
    assert.equal(b.speech.nativeEvent('start', newId), true);
    assert.equal(b.state().status, 'speaking');
});

test('destroy 关闭口型与定时器，之后所有入口安全失效且不再通知页面', () => {
    const native = createBridge();
    const h = harness({ bridge: native.bridge });
    h.speech.speak('回答');
    const id = native.state.calls[0].id;
    h.speech.nativeEvent('start', id);
    const count = h.changes.length;
    assert.equal(h.speech.destroy(), true);
    assert.deepEqual(h.mouths, [true, false]);
    assert.equal(native.state.stops, 1);
    assert.equal(h.time.size, 0);
    assert.deepEqual(h.state(), { status: 'idle', message: '' });
    assert.equal(h.changes.length, count);
    assert.equal(h.speech.destroy(), false);
    assert.equal(h.speech.speak('再说话'), false);
    assert.equal(h.speech.stop(), false);
    assert.equal(h.speech.setActivity('thinking'), false);
    assert.equal(h.speech.nativeEvent('start', id), false);
    assert.equal(h.mouths.length, 2);
});

test('getState 返回分离快照，外部修改不影响模块状态', () => {
    const h = harness();
    h.speech.setActivity('thinking');
    const snapshot = h.state();
    snapshot.status = 'speaking';
    snapshot.message = 'tampered';
    assert.deepEqual(h.state(), { status: 'thinking', message: '' });
});

test('等待声线期间 stop 清理监听与定时器，迟到的 voiceschanged 不再启动播放', () => {
    const h = harness();
    h.speech.speak('回答');
    assert.equal(h.web.state.listeners.size, 1);
    assert.equal(h.time.size, 2);
    assert.equal(h.speech.stop(), true);
    assert.equal(h.web.state.listeners.size, 0);
    assert.equal(h.time.size, 0);
    h.web.emit([{ lang: 'zh-CN' }]);
    assert.equal(h.web.state.spoken.length, 0);
    assert.equal(h.state().status, 'idle');
});

test('原生任务被新任务替换后，旧任务 ID 的事件失效并停止旧引擎', () => {
    const native = createBridge();
    const h = harness({ bridge: native.bridge });
    h.speech.speak('一');
    const firstId = native.state.calls[0].id;
    assert.equal(h.speech.speak('二'), true);
    const secondId = native.state.calls[1].id;
    assert.notEqual(firstId, secondId);
    assert.equal(native.state.stops, 1);
    assert.equal(h.speech.nativeEvent('start', firstId), false);
    assert.equal(h.state().status, 'queued');
    assert.equal(h.speech.nativeEvent('start', secondId), true);
    assert.equal(h.state().status, 'speaking');
});

test('原生 error/stop 回调按 ID 处理并清理任务，未知类型被拒绝', () => {
    const native = createBridge();
    const h = harness({ bridge: native.bridge });
    h.speech.speak('回答');
    const id = native.state.calls[0].id;
    h.speech.nativeEvent('start', id);
    assert.equal(h.speech.nativeEvent('error', id, 'engine'), true);
    assert.equal(h.state().status, 'error');
    assert.match(h.state().message, /engine/);
    assert.equal(h.time.size, 0);

    const second = createBridge();
    const g = harness({ bridge: second.bridge });
    g.speech.speak('回答');
    const stopId = second.state.calls[0].id;
    g.speech.nativeEvent('start', stopId);
    assert.equal(g.speech.nativeEvent('stop', stopId), true);
    assert.equal(g.state().status, 'idle');
    assert.equal(g.time.size, 0);
    assert.equal(g.speech.nativeEvent('unknown', stopId), false);
});

test('缺少 Web 语音能力时直接给出文字提示，不抛异常', () => {
    const time = clock();
    const speech = create({
        Utterance,
        onChange: () => {},
        setTimeout: time.setTimeout,
        clearTimeout: time.clearTimeout
    });
    assert.doesNotThrow(() => speech.speak('回答'));
    assert.equal(speech.getState().status, 'error');
    assert.match(speech.getState().message, /文字内容仍可阅读/);
    assert.equal(time.size, 0);
});

test('模块可在无 window、无 CommonJS 的上下文中注册为全局 GuideSpeech', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../src/main/resources/static/js/speech-lifecycle.js'), 'utf8');
    const context = vm.createContext({});
    vm.runInContext(source, context, { filename: 'speech-lifecycle.js' });
    assert.equal(vm.runInContext('typeof GuideSpeech.create', context), 'function');
    assert.equal(vm.runInContext('typeof window', context), 'undefined');
});
