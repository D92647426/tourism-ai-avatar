// REQ-038: real main/admin adapters; controlled public/config and timer boundaries.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEnv, loadScript, flush, response } = require('./harness');
const DEFAULT_WELCOME = '阿弥陀佛！我是您的AI导游灵灵，欢迎来到灵山胜境，愿您在此感悟灵山，吉祥平安！';
const config = extra => ({ name: '小旅', welcomeMessage: '欢迎，一起发现风景。', primaryColor: '#174a67',
    voiceType: 'female', modelName: 'haru', volume: 1, speechRate: 1, ...extra });
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

function visitor(fetchConfig) {
    const env = createEnv({ fetch(url) {
        if (url === '/api/digital-human-config') return fetchConfig();
        if (url === '/api/auth/me') return response(200, { userId: 'test', username: 'test', role: 'GUEST' });
        if (url === '/api/auth/csrf') return response(200, { token: 'test-token', headerName: 'X-XSRF-TOKEN' });
        if (url === '/api/chat') return response(200, { reply: '保留这段回答' });
        return response(200, []);
    }});
    const doc = env.document;
    doc._selectors['.live2d-label'] = doc.getElementById('live2dLabel');
    loadScript(env, 'security.js'); loadScript(env, 'display-config.js'); loadScript(env, 'main.js');
    return env;
}

test('public name, first welcome and theme are applied together without admin requests', async () => {
    const env = visitor(() => response(200, config())); await flush(env);
    assert.equal(env.document.getElementById('chatWelcome').textContent, config().welcomeMessage);
    assert.equal(env.document.getElementById('chatHeaderName').textContent, 'AI导游小旅');
    assert.equal(env.document.documentElement.style['--primary'], '#174a67');
    assert.ok(!env.fetchCalls.some(c => c.url.startsWith('/api/admin/')));
});

test('HTML-looking text stays literal and illegal CSS falls back', async () => {
    const env = visitor(() => response(200, config({name:'<b>旅</b>',welcomeMessage:'<img src=x onerror=alert(1)>',primaryColor:'url(evil)'})));
    await flush(env);
    assert.equal(env.document.getElementById('chatWelcome').textContent, '<img src=x onerror=alert(1)>');
    assert.equal(env.document.getElementById('chatHeaderName').textContent, 'AI导游<b>旅</b>');
    assert.equal(env.document.documentElement.style['--primary'], '#c8963e');
});

test('failed public read leaves complete stable defaults', async () => {
    const env = visitor(() => response(500, {})); await flush(env);
    assert.equal(env.document.getElementById('chatWelcome').textContent, DEFAULT_WELCOME);
    assert.equal(env.document.documentElement.style['--primary'], '#c8963e');
});

test('late config updates labels but cannot rewrite welcome after chat started', async () => {
    const late = deferred(); const env = visitor(() => late.promise); await flush(env);
    const doc = env.document, welcome = doc.getElementById('chatWelcome').textContent;
    doc.getElementById('chatInput').value = '你好'; doc.getElementById('chatSendBtn').dispatch('click'); await flush(env);
    const count = doc.getElementById('chatMessages').children.length;
    late.resolve(response(200, config())); await flush(env);
    assert.equal(doc.getElementById('chatWelcome').textContent, welcome);
    assert.equal(doc.getElementById('chatMessages').children.length, count);
    assert.equal(doc.getElementById('chatHeaderName').textContent, 'AI导游小旅');
});

function admin(get, put) {
    const alerts = [], puts = [];
    const env = createEnv({fetch(url, opts) {
        if (url === '/api/auth/me') return response(200, { role: 'ADMIN', username: 'test-admin' });
        if (url === '/api/auth/csrf') return response(200, { token: 'test-token', headerName: 'X-XSRF-TOKEN' });
        if (url === '/api/admin/digital-human-config') {
            if (opts.method === 'PUT') { puts.push(JSON.parse(opts.body)); return put(puts[puts.length - 1]); }
            return get();
        }
        return response(200, {});
    }});
    env.alert = msg => alerts.push(msg);
    const nav = env.document.createElement('a'); nav.dataset.tab = 'digital-human'; nav._classes.add('active');
    env.document._selectorsAll['.nav-item'] = [nav];
    env.document._selectors['.nav-item.active'] = nav;
    loadScript(env, 'security.js'); loadScript(env, 'display-config.js'); loadScript(env, 'admin.js');
    return {env, doc:env.document, puts, alerts};
}

test('admin load failure disables save and gives a retryable status', async () => {
    const a = admin(() => response(500, {}), () => response(200, config())); await flush(a.env);
    assert.equal(a.doc.getElementById('btnSaveConfig').disabled, true);
    assert.match(a.doc.getElementById('cfgStatus').textContent, /加载失败/);
});

test('admin preserves volume zero while saving display fields', async () => {
    const a = admin(() => response(200, config({volume:0})), data => response(200, {...config(), ...data})); await flush(a.env);
    assert.equal(Number(a.doc.getElementById('cfgVolume').value), 0);
    a.doc.getElementById('cfgName').value = '新导游'; a.doc.getElementById('btnSaveConfig').dispatch('click'); await flush(a.env);
    assert.equal(a.puts[0].volume, 0);
    assert.match(a.doc.getElementById('cfgStatus').textContent, /已保存/);
});

test('admin HTTP save error retains draft and never announces success', async () => {
    const a = admin(() => response(200, config()), () => response(500, {message:'未保存，请重试'})); await flush(a.env);
    a.doc.getElementById('cfgName').value = '我的草稿'; a.doc.getElementById('btnSaveConfig').dispatch('click'); await flush(a.env);
    assert.equal(a.doc.getElementById('cfgName').value, '我的草稿');
    assert.match(a.doc.getElementById('cfgStatus').textContent, /未保存/);
    assert.ok(!a.alerts.some(s => /保存成功/.test(s)));
});

test('admin duplicate clicks make one save request', async () => {
    const late = deferred(), a = admin(() => response(200, config()), () => late.promise); await flush(a.env);
    a.doc.getElementById('btnSaveConfig').dispatch('click'); a.doc.getElementById('btnSaveConfig').dispatch('click'); await flush(a.env);
    assert.equal(a.puts.length, 1);
    late.resolve(response(200, config())); await flush(a.env);
});

test('admin does not call a mismatched 200 response a successful save', async () => {
    const a = admin(() => response(200, config()), () => response(200, config({name:'另一个值'}))); await flush(a.env);
    a.doc.getElementById('btnSaveConfig').dispatch('click'); await flush(a.env);
    assert.match(a.doc.getElementById('cfgStatus').textContent, /未确认/);
    assert.ok(!a.alerts.some(s => /保存成功/.test(s)));
});

test('public deadline includes a stalled JSON body and ignores late parse completion', async () => {
    const env = createEnv(), body = deferred();
    const timers = new Map(); let next = 0, aborted = false;
    loadScript(env, 'display-config.js');
    env.GuideDisplayConfig.load({document:env.document, canUpdateWelcome:() => true,
        fetch:() => ({ok:true,json:() => body.promise}),
        setTimeout:(fn, ms) => { assert.equal(ms, 5000); timers.set(++next, fn); return next; },
        clearTimeout:id => timers.delete(id), AbortController:function() { this.abort = () => { aborted = true; }; }});
    await flush(env); [...timers.values()][0]();
    body.resolve(config()); await flush(env);
    assert.equal(aborted, true); assert.equal(timers.size, 0);
    assert.equal(env.document.getElementById('chatWelcome').textContent, DEFAULT_WELCOME);
});

test('light and dark color extremes keep explicit contrasting text tokens', () => {
    const display = require('../../src/main/resources/static/js/display-config');
    assert.equal(display.palette('#ffffff')['--on-primary'], '#000000');
    assert.equal(display.palette('#000000')['--on-primary'], '#ffffff');
    assert.equal(display.palette('#ffffff')['--primary-dark'], '#666666');
    assert.equal(display.normalize({name:null,welcomeMessage:[],primaryColor:'#123'}).primaryColor, '#c8963e');
});

test('new admin reload fences the old load response', async () => {
    const old = deferred(); let reads = 0;
    const a = admin(() => ++reads === 1 ? old.promise : response(200, config({name:'新配置'})), () => response(200, config()));
    await flush(a.env); a.doc.getElementById('btnReloadConfig').dispatch('click'); await flush(a.env);
    old.resolve(response(200, config({name:'过期配置'}))); await flush(a.env);
    assert.equal(a.doc.getElementById('cfgName').value, '新配置');
});

test('admin previews draft text and theme without announcing a saved change', async () => {
    const a = admin(() => response(200, config()), () => response(200, config()));
    await flush(a.env);
    a.doc.getElementById('cfgName').value = '<b>新向导</b>';
    a.doc.getElementById('cfgColor').value = '#ffffff';
    a.doc.getElementById('cfgName').dispatch('input');
    assert.equal(a.doc.getElementById('cfgPreviewName').textContent, 'AI导游<b>新向导</b>');
    assert.equal(a.doc.getElementById('cfgPreviewName').innerHTML, '');
    assert.equal(a.doc.getElementById('cfgPreview').style['--preview-on'], '#000000');
    assert.match(a.doc.getElementById('cfgStatus').textContent, /未保存/);
    assert.equal(a.puts.length, 0);
});

test('admin display edits preserve a configured voice outside the legacy menu', async () => {
    const custom = config({voiceType:'device-voice-id', volume:0.15, speechRate:1.15});
    const a = admin(() => response(200, custom), data => response(200, {...custom,...data}));
    await flush(a.env);
    const voice = a.doc.getElementById('cfgVoice');
    assert.equal(voice.children[0].value, 'device-voice-id');
    assert.equal(voice.children[0].textContent, '已保存声线：device-voice-id');
    a.doc.getElementById('cfgName').value = '新名称';
    a.doc.getElementById('btnSaveConfig').dispatch('click'); await flush(a.env);
    assert.equal(a.puts[0].voiceType, custom.voiceType);
    assert.equal(a.puts[0].volume, 0.15); assert.equal(a.puts[0].speechRate, 1.15);
    assert.match(a.doc.getElementById('cfgStatus').textContent, /已保存/);
});
