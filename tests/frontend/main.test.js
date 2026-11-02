'use strict';

// 真实执行 main.js 的认证相关回归测试（REQ-030 / GitHub #5）。
const test = require('node:test');
const assert = require('node:assert/strict');

const { createEnv, loadScript, flush, response } = require('./harness');

function csrfOk() {
    return response(200, { headerName: 'X-XSRF-TOKEN', token: 'csrf-token' });
}

function setup(options) {
    const opts = options || {};
    const env = createEnv({ fetch: opts.fetch, storage: opts.storage || {} });
    const doc = env.document;

    // 个人信息弹窗中的兴趣按钮：默认已选中“摄影打卡”
    const selected = doc.createElement('button');
    selected.dataset.interest = '摄影打卡';
    selected._classes.add('interest-btn');
    selected._classes.add('selected');
    const profileInterests = doc.getElementById('profileInterests');
    profileInterests._queryAll = (selector) => (selector === '.interest-btn' ? [selected] : []);
    profileInterests._query = (selector) => (selector === '.interest-btn.selected' ? selected : null);

    doc._selectors['.live2d-label'] = doc.getElementById('live2dLabel');

    loadScript(env, 'security.js');
    loadScript(env, 'main.js');
    return env;
}

function baseFetch(overrides) {
    return (url) => {
        if (overrides && Object.prototype.hasOwnProperty.call(overrides, url)) {
            const value = overrides[url];
            return typeof value === 'function' ? value() : value;
        }
        if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
        if (url.indexOf('/api/auth/me') >= 0) return response(401, {});
        if (url.indexOf('/api/spots') >= 0) return response(200, []);
        if (url.indexOf('/api/digital-human-config') >= 0) return response(200, { name: '灵灵' });
        return response(404, {});
    };
}

test('启动时以服务端身份为准：服务端无兴趣会清掉旧账号缓存', async () => {
    const fetch = baseFetch({
        '/api/auth/me': () => response(200, {
            userId: 'u2', username: 'bob', role: 'GUEST', interest: null
        })
    });
    const env = setup({ fetch, storage: { userId: 'old', username: 'old-user', interest: '历史人文' } });
    await flush(env);

    assert.equal(env.localStorage.getItem('userId'), 'u2');
    assert.equal(env.localStorage.getItem('username'), 'bob');
    assert.equal(env.localStorage.getItem('interest'), null, '不能复活旧账号的兴趣缓存');
});

test('未登录访问首页会被引导到登录页', async () => {
    const env = setup({ fetch: baseFetch({}), storage: { userId: 'stale' } });
    await flush(env);

    assert.equal(env.location.href, '/login.html');
});

test('兴趣保存失败时不写入缓存并显示错误', async () => {
    const fetch = baseFetch({
        '/api/auth/me': () => response(200, {
            userId: 'u1', username: 'alice', role: 'GUEST', interest: '自然风光'
        }),
        '/api/auth/interest': () => response(500, {})
    });
    const env = setup({ fetch });
    const doc = env.document;
    await flush(env);
    assert.equal(env.localStorage.getItem('interest'), '自然风光');

    doc.getElementById('profileSave').dispatch('click');
    await flush(env);

    assert.equal(env.localStorage.getItem('interest'), '自然风光', '失败时不覆盖已保存状态');
    assert.match(doc.getElementById('profileMsg').textContent, /保存失败/);
    assert.match(String(doc.getElementById('profileMsg').className), /error/);
});

test('兴趣保存 401 时清理过期身份并引导登录', async () => {
    const fetch = baseFetch({
        '/api/auth/me': () => response(200, {
            userId: 'u1', username: 'alice', role: 'GUEST', interest: '自然风光'
        }),
        '/api/auth/interest': () => response(401, {})
    });
    const env = setup({ fetch });
    const doc = env.document;
    await flush(env);
    assert.equal(env.localStorage.getItem('userId'), 'u1');

    doc.getElementById('profileSave').dispatch('click');
    await flush(env);

    assert.equal(env.location.href, '/login.html');
    assert.equal(env.localStorage.getItem('userId'), null);
    assert.equal(env.localStorage.getItem('interest'), null);
});

test('兴趣保存成功后更新缓存并提示成功', async () => {
    const fetch = baseFetch({
        '/api/auth/me': () => response(200, {
            userId: 'u1', username: 'alice', role: 'GUEST', interest: null
        }),
        '/api/auth/interest': () => response(200, { success: true })
    });
    const env = setup({ fetch });
    const doc = env.document;
    await flush(env);

    doc.getElementById('profileSave').dispatch('click');
    await flush(env);

    assert.equal(env.localStorage.getItem('interest'), '摄影打卡');
    assert.match(doc.getElementById('profileMsg').textContent, /兴趣爱好已更新/);
    assert.equal(env.location.href, '');
});

test('退出失败时显示错误、不跳转，并恢复按钮可用', async () => {
    const fetch = baseFetch({
        '/api/auth/me': () => response(200, {
            userId: 'u1', username: 'alice', role: 'GUEST', interest: '自然风光'
        }),
        '/api/auth/logout': () => response(500, {})
    });
    const env = setup({ fetch });
    const doc = env.document;
    await flush(env);

    doc.getElementById('profileLogout').dispatch('click');
    await flush(env);

    assert.equal(env.location.href, '');
    assert.equal(doc.getElementById('profileLogout').disabled, false);
    assert.match(doc.getElementById('profileMsg').textContent, /退出失败/);
});

test('退出成功后跳转登录页', async () => {
    const fetch = baseFetch({
        '/api/auth/me': () => response(200, {
            userId: 'u1', username: 'alice', role: 'GUEST', interest: '自然风光'
        }),
        '/api/auth/logout': () => response(200, { success: true })
    });
    const env = setup({ fetch });
    await flush(env);

    env.document.getElementById('profileLogout').dispatch('click');
    await flush(env);

    assert.equal(env.location.href, '/login.html');
    assert.equal(env.localStorage.getItem('userId'), null);
});
