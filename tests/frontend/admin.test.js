'use strict';

// 真实执行 admin.js 的认证切换回归测试（REQ-030 / GitHub #5）。
const test = require('node:test');
const assert = require('node:assert/strict');

const { createEnv, loadScript, flush, response } = require('./harness');

function csrfOk() {
    return response(200, { headerName: 'X-XSRF-TOKEN', token: 'csrf-token' });
}

function setup(state) {
    const env = createEnv({
        fetch(url, options) {
            if (url.indexOf('/api/auth/csrf') >= 0) return csrfOk();
            if (url.indexOf('/api/auth/me') >= 0) return state.me();
            if (url.indexOf('/api/auth/login') >= 0) return state.login();
            if (url.indexOf('/api/auth/logout') >= 0) return state.logout();
            if (url.indexOf('/api/admin/') >= 0) {
                state.adminCalls.push({ url, options });
                return state.admin();
            }
            return response(404, {});
        }
    });
    const doc = env.document;

    const tabs = ['dashboard', 'knowledge', 'digital-human', 'reports', 'users'];
    const navItems = tabs.map((tab) => {
        const item = doc.createElement('a');
        item.dataset.tab = tab;
        item._classes.add('nav-item');
        return item;
    });
    const tabContents = tabs.map((tab) => {
        const section = doc.createElement('section');
        section.id = 'tab-' + tab;
        section._classes.add('tab-content');
        return section;
    });
    doc._selectorsAll['.nav-item'] = navItems;
    doc._selectorsAll['.tab-content'] = tabContents;
    doc._selectors['.nav-item.active'] = () => navItems.find((item) => item._classes.has('active')) || null;

    loadScript(env, 'security.js');
    loadScript(env, 'display-config.js'); loadScript(env, 'admin.js');

    const activeTab = (tab) => {
        navItems.forEach((item) => {
            if (item.dataset.tab === tab) item._classes.add('active');
            else item._classes.delete('active');
        });
    };
    return { env, doc, navItems, activeTab, tabs };
}

function state(overrides) {
    const base = {
        me: () => response(401, {}),
        login: () => response(200, { success: true, userId: 'a1', username: 'admin', role: 'ADMIN' }),
        logout: () => response(200, { success: true }),
        admin: () => response(200, []),
        adminCalls: []
    };
    return Object.assign(base, overrides || {});
}

function login(doc, env) {
    doc.getElementById('adminUsername').value = 'admin';
    doc.getElementById('adminPassword').value = 'admin-pass-1';
    doc.getElementById('adminLoginForm').dispatch('submit', { preventDefault() { } });
    return flush(env);
}

test('匿名进入管理后台显示登录层', async () => {
    const s = state();
    const { env, doc } = setup(s);
    await flush(env);

    assert.equal(doc.getElementById('adminGate').style.display, 'flex');
    assert.equal(doc.getElementById('adminGateLogin').style.display, 'block');
    assert.equal(doc.getElementById('adminGateDenied').style.display, 'none');
});

test('游客进入管理后台显示无权限层', async () => {
    const s = state({ me: () => response(200, { userId: 'g1', username: 'guest', role: 'GUEST' }) });
    const { env, doc } = setup(s);
    await flush(env);

    assert.equal(doc.getElementById('adminGate').style.display, 'flex');
    assert.equal(doc.getElementById('adminGateDenied').style.display, 'block');
    assert.equal(doc.getElementById('adminGateLogin').style.display, 'none');
});

test('管理员登录后加载当前激活 tab；过期重登后重新加载该 tab', async () => {
    const s = state();
    const { env, doc, activeTab } = setup(s);
    await flush(env);

    activeTab('knowledge');
    await login(doc, env);

    assert.equal(doc.getElementById('adminGate').style.display, 'none');
    assert.match(doc.getElementById('adminIdentity').textContent, /管理员/);
    const firstKnowledge = s.adminCalls.filter((call) => call.url.indexOf('/api/admin/knowledge') >= 0);
    assert.equal(firstKnowledge.length, 1, '登录后应加载当前激活的 knowledge tab');

    // 会话过期：管理接口返回 401，页面回到登录层并清理管理员状态
    s.admin = () => response(401, {});
    const knowledgeNav = doc._selectorsAll['.nav-item'].find((item) => item.dataset.tab === 'knowledge');
    knowledgeNav.dispatch('click');
    await flush(env);

    assert.equal(doc.getElementById('adminGate').style.display, 'flex');
    assert.equal(doc.getElementById('adminGateError').textContent, '登录状态已失效，请重新登录');
    assert.equal(doc.getElementById('adminIdentity').textContent, '');
    assert.equal(doc.getElementById('adminGateLogin').style.display, 'block');
    const knowledgeCallsAtExpiry = s.adminCalls.filter((call) => call.url.indexOf('/api/admin/knowledge') >= 0).length;

    // 重新登录：必须重新加载当前激活 tab，不能只隐藏遮罩保留旧数据
    s.admin = () => response(200, []);
    await login(doc, env);
    const afterRelogin = s.adminCalls.filter((call) => call.url.indexOf('/api/admin/knowledge') >= 0).length;
    assert.equal(afterRelogin, knowledgeCallsAtExpiry + 1, '重登后应重新加载 knowledge tab');
    assert.equal(doc.getElementById('adminGate').style.display, 'none');
});

test('切换账号退出失败时显示错误，成功后才回到管理员登录层', async () => {
    const s = state({ me: () => response(200, { userId: 'g1', username: 'guest', role: 'GUEST' }) });
    const { env, doc } = setup(s);
    await flush(env);
    assert.equal(doc.getElementById('adminGateDenied').style.display, 'block');

    s.logout = () => response(500, {});
    doc.getElementById('adminSwitchAccount').dispatch('click');
    await flush(env);
    assert.match(doc.getElementById('adminGateSwitchError').textContent, /退出失败/);
    assert.equal(doc.getElementById('adminGateDenied').style.display, 'block', '退出失败时不能假跳转');

    s.logout = () => response(200, { success: true });
    doc.getElementById('adminSwitchAccount').dispatch('click');
    await flush(env);
    assert.equal(doc.getElementById('adminGateLogin').style.display, 'block');
    assert.equal(doc.getElementById('adminGateDenied').style.display, 'none');
    assert.match(doc.getElementById('adminGateError').textContent, /已退出当前账号/);
});

test('侧边栏退出失败时显示错误并恢复按钮', async () => {
    const s = state({ me: () => response(200, { userId: 'a1', username: 'admin', role: 'ADMIN' }) });
    const { env, doc } = setup(s);
    await flush(env);

    s.logout = () => response(500, {});
    doc.getElementById('adminLogout').dispatch('click');
    await flush(env);

    assert.match(doc.getElementById('adminLogoutError').textContent, /退出失败/);
    assert.equal(doc.getElementById('adminLogout').disabled, false);
    assert.equal(env.location.href, '');

    s.logout = () => response(200, { success: true });
    doc.getElementById('adminLogout').dispatch('click');
    await flush(env);
    assert.equal(env.location.href, '/login.html');
});
