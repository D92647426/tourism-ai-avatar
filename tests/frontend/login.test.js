'use strict';

// 真实执行 login.js 的回归测试（REQ-030 / GitHub #5）。
const test = require('node:test');
const assert = require('node:assert/strict');

const { createEnv, loadScript, flush, response } = require('./harness');

function csrfOk() {
    return response(200, { headerName: 'X-XSRF-TOKEN', token: 'csrf-token' });
}

function setup(fetchImpl, storage) {
    const env = createEnv({ storage: storage || {}, fetch: fetchImpl });
    const doc = env.document;
    doc.getElementById('loginForm').parentElement = doc.getElementById('loginContainer');
    const interestButtons = ['历史人文', '自然风光', '亲子出游', '摄影打卡'].map((name) => {
        const btn = doc.createElement('button');
        btn.dataset.interest = name;
        btn._classes.add('interest-btn');
        return btn;
    });
    const interestOptions = doc.getElementById('interestOptions');
    interestOptions._queryAll = (selector) => (selector === '.interest-btn' ? interestButtons : []);
    loadScript(env, 'security.js');
    loadScript(env, 'login.js');
    return { env, doc, interestButtons };
}

function submit(form, env) {
    form.dispatch('submit', { preventDefault() { } });
    return flush(env);
}

test('注册成功会清掉上一个账号的兴趣缓存', async () => {
    const { env, doc } = setup((url) => {
        if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
        if (url.indexOf('/api/auth/me') >= 0) return response(401, {});
        if (url.indexOf('/api/auth/register') >= 0) {
            return response(200, { success: true, userId: 'u2', username: 'bob', role: 'GUEST' });
        }
        return response(404, {});
    }, { userId: 'old', username: 'old-user', interest: '历史人文' });

    doc.getElementById('regUsername').value = 'bob';
    doc.getElementById('regPassword').value = 'pass-1234';
    doc.getElementById('regPassword2').value = 'pass-1234';
    await submit(doc.getElementById('registerForm'), env);

    assert.equal(env.localStorage.getItem('interest'), null, '新账号不能沿用上一个账号的兴趣');
    assert.equal(doc.getElementById('interestCard').style.display, 'block');
    assert.equal(env.location.href, '');
});

test('登录成功但服务端无兴趣时清空旧缓存', async () => {
    const { env, doc } = setup((url) => {
        if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
        if (url.indexOf('/api/auth/me') >= 0) return response(401, {});
        if (url.indexOf('/api/auth/login') >= 0) {
            return response(200, { success: true, userId: 'u2', username: 'bob', role: 'GUEST', interest: null });
        }
        return response(404, {});
    }, { interest: '历史人文', userId: 'old' });

    doc.getElementById('loginUsername').value = 'bob';
    doc.getElementById('loginPassword').value = 'pass-1234';
    await submit(doc.getElementById('loginForm'), env);

    assert.equal(env.localStorage.getItem('interest'), null);
    assert.equal(env.location.href, '');
});

test('管理员登录跳转管理后台', async () => {
    const { env, doc } = setup((url) => {
        if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
        if (url.indexOf('/api/auth/me') >= 0) return response(401, {});
        if (url.indexOf('/api/auth/login') >= 0) {
            return response(200, { success: true, userId: 'a1', username: 'admin', role: 'ADMIN', interest: null });
        }
        return response(404, {});
    });

    doc.getElementById('loginUsername').value = 'admin';
    doc.getElementById('loginPassword').value = 'admin-pass-1';
    await submit(doc.getElementById('loginForm'), env);

    assert.equal(env.location.href, '/admin.html');
});

test('兴趣保存失败时不跳转、不写缓存并显示错误', async () => {
    const { env, doc, interestButtons } = setup((url) => {
        if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
        if (url.indexOf('/api/auth/me') >= 0) return response(401, {});
        if (url.indexOf('/api/auth/interest') >= 0) return response(500, {});
        return response(404, {});
    });

    doc.getElementById('interestOptions').dispatch('click', { target: interestButtons[3] });
    doc.getElementById('enterApp').dispatch('click');
    await flush(env);

    assert.equal(env.location.href, '', '保存失败不能进入应用');
    assert.equal(env.localStorage.getItem('interest'), null);
    assert.match(doc.getElementById('interestError').textContent, /保存失败/);
    assert.equal(doc.getElementById('enterApp').disabled, false, '失败后应允许重试');
});

test('兴趣保存 401 时清理过期身份并引导重新登录', async () => {
    const { env, doc, interestButtons } = setup((url) => {
        if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
        if (url.indexOf('/api/auth/me') >= 0) return response(401, {});
        if (url.indexOf('/api/auth/interest') >= 0) return response(401, {});
        return response(404, {});
    }, { userId: 'stale', username: 'stale-user', interest: '历史人文' });

    doc.getElementById('interestOptions').dispatch('click', { target: interestButtons[1] });
    doc.getElementById('enterApp').dispatch('click');
    await flush(env);

    assert.equal(env.location.href, '', '已处于登录页，不应再跳转');
    assert.equal(env.localStorage.getItem('userId'), null);
    assert.equal(env.localStorage.getItem('interest'), null);
    assert.match(doc.getElementById('loginError').textContent, /登录状态已失效/);
    assert.equal(doc.getElementById('loginContainer').style.display, 'block', '应回到登录表单');
    assert.equal(doc.getElementById('interestCard').style.display, 'none');
});

test('兴趣保存成功后写入缓存并进入应用', async () => {
    const { env, doc, interestButtons } = setup((url) => {
        if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
        if (url.indexOf('/api/auth/me') >= 0) return response(401, {});
        if (url.indexOf('/api/auth/interest') >= 0) return response(200, { success: true });
        return response(404, {});
    });

    doc.getElementById('interestOptions').dispatch('click', { target: interestButtons[2] });
    doc.getElementById('enterApp').dispatch('click');
    await flush(env);

    assert.equal(env.localStorage.getItem('interest'), '亲子出游');
    assert.equal(env.location.href, '/index.html');
});
