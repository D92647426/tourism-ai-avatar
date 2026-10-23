'use strict';

// 真实执行 security.js 的回归测试（REQ-030 / GitHub #5）。
const test = require('node:test');
const assert = require('node:assert/strict');

const { createEnv, loadScript, flush, response } = require('./harness');

function csrfOk() {
    return response(200, { headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'csrf-token' });
}

function storageState(env) {
    return {
        userId: env.localStorage.getItem('userId'),
        username: env.localStorage.getItem('username'),
        interest: env.localStorage.getItem('interest')
    };
}

test('logout 成功时清空本地身份缓存', async () => {
    const env = createEnv({
        storage: { userId: 'u1', username: 'alice', interest: '历史人文' },
        fetch(url) {
            if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
            if (url.indexOf('/api/auth/logout') >= 0) return response(200, { success: true });
            return response(404, {});
        }
    });
    loadScript(env, 'security.js');

    await env.window.AuthGuard.logout();
    await flush(env);

    assert.deepEqual(storageState(env), { userId: null, username: null, interest: null });
});

test('logout 遇到 HTTP 失败时 reject，且不清空本地身份、不谎称成功', async () => {
    const env = createEnv({
        storage: { userId: 'u1', username: 'alice', interest: '历史人文' },
        fetch(url) {
            if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
            if (url.indexOf('/api/auth/logout') >= 0) return response(500, { success: false });
            return response(404, {});
        }
    });
    loadScript(env, 'security.js');

    await assert.rejects(() => env.window.AuthGuard.logout(), /退出登录失败/);
    await flush(env);

    assert.equal(storageState(env).userId, 'u1', '服务器未确认退出时不能清掉身份缓存');
    assert.equal(storageState(env).interest, '历史人文');
});

test('logout 遇到网络异常时 reject，且不清空本地身份', async () => {
    const env = createEnv({
        storage: { userId: 'u1', username: 'alice' },
        fetch(url) {
            if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
            if (url.indexOf('/api/auth/logout') >= 0) throw new Error('network down');
            return response(404, {});
        }
    });
    loadScript(env, 'security.js');

    await assert.rejects(() => env.window.AuthGuard.logout(), /network down/);
    assert.equal(storageState(env).userId, 'u1');
});

test('logout 未返回 success=true 时视为失败', async () => {
    const env = createEnv({
        storage: { userId: 'u1' },
        fetch(url) {
            if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
            if (url.indexOf('/api/auth/logout') >= 0) return response(200, { success: false });
            return response(404, {});
        }
    });
    loadScript(env, 'security.js');

    await assert.rejects(() => env.window.AuthGuard.logout(), /服务端未确认/);
    assert.equal(storageState(env).userId, 'u1');
});

test('写请求会携带 CSRF header 与会话 Cookie', async () => {
    const env = createEnv({
        fetch(url) {
            if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
            return response(200, { success: true });
        }
    });
    loadScript(env, 'security.js');

    await env.window.AuthGuard.apiFetch('/api/auth/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest: '摄影打卡' })
    });
    const post = env.fetchCalls.filter((call) => call.url.indexOf('/api/auth/interest') >= 0)[0];
    assert.equal(post.options.headers['X-XSRF-TOKEN'], 'csrf-token');
    assert.equal(post.options.credentials, 'same-origin');
});

test('CSRF 获取失败后下一次调用可以重新获取（不会永久失败）', async () => {
    let csrfCalls = 0;
    const env = createEnv({
        fetch(url) {
            if (url.indexOf('/api/auth/csrf') >= 0) {
                csrfCalls += 1;
                return csrfCalls === 1 ? response(500, {}) : csrfOk();
            }
            return response(200, { success: true });
        }
    });
    loadScript(env, 'security.js');

    await assert.rejects(() =>
        env.window.AuthGuard.apiFetch('/api/auth/interest', { method: 'POST' }), /CSRF/);

    const second = await env.window.AuthGuard.apiFetch('/api/auth/interest', { method: 'POST' });
    assert.equal(second.status, 200);
    assert.equal(csrfCalls, 2, '失败后应重新发起 CSRF 请求，而不是复用 rejected promise');
});

test('403 时只刷新一次 token 并重试一次，不无限重试', async () => {
    let csrfCalls = 0;
    let protectedCalls = 0;
    const env = createEnv({
        fetch(url) {
            if (url.indexOf('/api/auth/csrf') >= 0) {
                csrfCalls += 1;
                return response(200, { token: 'token-' + csrfCalls });
            }
            protectedCalls += 1;
            return protectedCalls === 1 ? response(403, {}) : response(200, { success: true });
        }
    });
    loadScript(env, 'security.js');

    const res = await env.window.AuthGuard.apiFetch('/api/auth/interest', { method: 'POST' });
    assert.equal(res.status, 200);
    assert.equal(csrfCalls, 2, '403 后应刷新一次 CSRF token');
    assert.equal(protectedCalls, 2, '只重试一次，不能无限循环');
});

test('持续 403 时最多重试一次后把 403 返回给调用方', async () => {
    const env = createEnv({
        fetch(url) {
            if (url.indexOf('/api/auth/csrf') >= 0) return response(200, { token: 'token' });
            return response(403, {});
        }
    });
    loadScript(env, 'security.js');

    const res = await env.window.AuthGuard.apiFetch('/api/auth/interest', { method: 'POST' });
    assert.equal(res.status, 403);
    const postCalls = env.fetchCalls.filter((call) => call.url.indexOf('/api/auth/interest') >= 0);
    assert.equal(postCalls.length, 2);
});

test('me 返回非 2xx 时为 null，不抛异常', async () => {
    const env = createEnv({
        fetch() { return response(401, {}); }
    });
    loadScript(env, 'security.js');

    assert.equal(await env.window.AuthGuard.me(), null);
});
