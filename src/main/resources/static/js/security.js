// ===== 会话与 CSRF 统一辅助（REQ-030 / GitHub #5）=====
// 真实身份只来自服务端 /api/auth/me；localStorage 仅作显示缓存，不能作为登录凭证。
(function (global) {
    'use strict';

    var csrfToken = null;
    var csrfPending = null;

    function fetchCsrf(force) {
        if (csrfToken && !force) {
            return Promise.resolve(csrfToken);
        }
        if (!csrfPending || force) {
            csrfPending = fetch('/api/auth/csrf', {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store'
            }).then(function (res) {
                if (!res.ok) {
                    throw new Error('获取 CSRF token 失败: ' + res.status);
                }
                return res.json();
            }).then(function (data) {
                csrfToken = data.token;
                return csrfToken;
            });
        }
        return csrfPending;
    }

    // 统一 fetch：自动带 Cookie、自动附加 X-XSRF-TOKEN；403 时刷新 token 重试一次。
    function apiFetch(url, options) {
        options = options || {};
        var method = (options.method || 'GET').toUpperCase();
        var needsCsrf = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

        function send(retried) {
            return fetchCsrf(false).then(function (token) {
                var opts = {};
                for (var key in options) {
                    if (Object.prototype.hasOwnProperty.call(options, key)) {
                        opts[key] = options[key];
                    }
                }
                opts.credentials = 'same-origin';
                opts.headers = {};
                var sourceHeaders = options.headers || {};
                for (var header in sourceHeaders) {
                    if (Object.prototype.hasOwnProperty.call(sourceHeaders, header)) {
                        opts.headers[header] = sourceHeaders[header];
                    }
                }
                if (needsCsrf && token) {
                    opts.headers['X-XSRF-TOKEN'] = token;
                }
                return fetch(url, opts).then(function (res) {
                    if (res.status === 403 && needsCsrf && !retried) {
                        csrfToken = null;
                        csrfPending = null;
                        return send(true);
                    }
                    return res;
                });
            });
        }

        return send(false);
    }

    // 读取服务端会话身份；未登录返回 null（不抛异常，方便页面做引导）。
    function me() {
        return fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
        }).then(function (res) {
            if (!res.ok) {
                return null;
            }
            return res.json();
        }).catch(function () {
            return null;
        });
    }

    // 服务端退出：使 HttpSession 失效，然后清理本地显示缓存。
    function logout() {
        return apiFetch('/api/auth/logout', { method: 'POST' }).catch(function () {
        }).then(function () {
            try {
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                localStorage.removeItem('interest');
            } catch (e) {
            }
        });
    }

    global.AuthGuard = {
        fetchCsrf: fetchCsrf,
        apiFetch: apiFetch,
        me: me,
        logout: logout
    };
})(window);
