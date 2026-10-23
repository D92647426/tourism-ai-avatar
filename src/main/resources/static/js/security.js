// ===== 会话与 CSRF 统一辅助（REQ-030 / GitHub #5）=====
// 真实身份只来自服务端 /api/auth/me；localStorage 仅作显示缓存，不能作为登录凭证。
(function (global) {
    'use strict';

    var csrfToken = null;
    var csrfPending = null;

    // 获取 CSRF token：并发调用复用同一个请求；失败后清除 pending，允许下一次重试。
    function fetchCsrf(force) {
        if (force) {
            csrfToken = null;
            csrfPending = null;
        }
        if (csrfToken) {
            return Promise.resolve(csrfToken);
        }
        if (!csrfPending) {
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
                if (!data || !data.token) {
                    throw new Error('CSRF 响应缺少 token');
                }
                csrfToken = data.token;
                return csrfToken;
            }).then(function (token) {
                csrfPending = null;
                return token;
            }, function (error) {
                // 关键：失败不能留下 rejected promise，否则之后所有写请求都会永久失败。
                csrfPending = null;
                csrfToken = null;
                throw error;
            });
        }
        return csrfPending;
    }

    // 统一 fetch：自动带 Cookie、自动附加 X-XSRF-TOKEN；403 时刷新 token 重试一次（仅一次）。
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

    // 清理本地显示缓存；真实会话是否结束只以服务端响应为准。
    function clearIdentity() {
        try {
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('interest');
        } catch (e) {
            // 本地缓存清理失败不应影响服务端退出结果。
        }
    }

    // 服务端退出：只有服务端确认 HTTP 2xx 且 success=true 才清理缓存；失败时 reject 供页面提示重试。
    function logout() {
        return apiFetch('/api/auth/logout', { method: 'POST' }).then(function (res) {
            if (!res.ok) {
                throw new Error('退出登录失败: HTTP ' + res.status);
            }
            return res.json().catch(function () {
                return {};
            });
        }).then(function (data) {
            if (!data || data.success !== true) {
                throw new Error('退出登录失败：服务端未确认');
            }
            clearIdentity();
            return data;
        });
    }

    global.AuthGuard = {
        fetchCsrf: fetchCsrf,
        apiFetch: apiFetch,
        me: me,
        logout: logout,
        clearIdentity: clearIdentity
    };
})(window);
