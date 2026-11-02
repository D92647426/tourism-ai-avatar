// ===== 登录注册逻辑 =====
// 真实身份由服务端 HttpSession 决定；localStorage 只缓存显示信息（REQ-030 / GitHub #5）。
(function() {
    'use strict';

    var S = function(id) { return document.getElementById(id); };
    var api = window.AuthGuard.apiFetch;

    var loginForm = S('loginForm');
    var registerForm = S('registerForm');
    var registerCard = S('registerCard');
    var interestCard = S('interestCard');
    var loginError = S('loginError');
    var regError = S('regError');
    var interestError = S('interestError');
    var enterApp = S('enterApp');
    var skipInterest = S('skipInterest');

    var selectedInterest = '';

    // 兴趣缓存一律以服务端返回为准：空值表示该账号没有兴趣，必须清掉上一个账号的缓存。
    function applyServerInterest(interest) {
        if (interest) {
            localStorage.setItem('interest', interest);
        } else {
            localStorage.removeItem('interest');
        }
    }

    // ===== 切换表单 =====
    S('showRegister').addEventListener('click', function(e) {
        e.preventDefault();
        loginForm.parentElement.style.display = 'none';
        registerCard.style.display = 'block';
        interestCard.style.display = 'none';
    });

    S('showLogin').addEventListener('click', function(e) {
        e.preventDefault();
        loginForm.parentElement.style.display = 'block';
        registerCard.style.display = 'none';
        interestCard.style.display = 'none';
    });

    // ===== 注册（永远创建游客，客户端 role 会被服务端忽略） =====
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var u = S('regUsername').value.trim();
        var p = S('regPassword').value;
        var p2 = S('regPassword2').value;

        if (p !== p2) { regError.textContent = '两次密码不一致'; return; }

        api('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.success) {
                registerCard.style.display = 'none';
                interestCard.style.display = 'block';
                saveSession(d.userId, d.username);
                applyServerInterest(''); // 新账号没有兴趣，不能沿用上一个账号的缓存
            } else {
                regError.textContent = d.message || '注册失败';
            }
        }).catch(function() { regError.textContent = '网络错误'; });
    });

    // ===== 登录 =====
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var u = S('loginUsername').value.trim();
        var p = S('loginPassword').value;

        api('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.success) {
                saveSession(d.userId, d.username);
                applyServerInterest(d.interest);
                if (d.role === 'ADMIN') {
                    // 管理员登录后进入管理后台，权限仍由服务端接口校验。
                    window.location.href = '/admin.html';
                } else if (d.interest) {
                    goToApp();
                } else {
                    loginForm.parentElement.style.display = 'none';
                    interestCard.style.display = 'block';
                }
            } else {
                loginError.textContent = d.message || '登录失败';
            }
        }).catch(function() { loginError.textContent = '网络错误'; });
    });

    // ===== 兴趣选择 =====
    S('interestOptions').addEventListener('click', function(e) {
        var b = e.target.closest('.interest-btn');
        if (!b) return;
        var all = S('interestOptions').querySelectorAll('.interest-btn');
        all.forEach(function(x) { x.classList.remove('selected'); });
        b.classList.add('selected');
        selectedInterest = b.dataset.interest;
        enterApp.style.display = 'block';
    });

    enterApp.addEventListener('click', function() {
        if (!selectedInterest || enterApp.disabled) return;
        enterApp.disabled = true;
        if (interestError) interestError.textContent = '正在保存…';
        api('/api/auth/interest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interest: selectedInterest })
        }).then(function(res) {
            if (res.status === 401) {
                var error = new Error('登录状态已失效');
                error.status = 401;
                throw error;
            }
            if (!res.ok) { throw new Error('保存失败: HTTP ' + res.status); }
            return res.json();
        }).then(function(d) {
            if (!d || d.success !== true) { throw new Error('保存失败'); }
            localStorage.setItem('interest', selectedInterest);
            if (interestError) interestError.textContent = '';
            goToApp();
        }).catch(function(error) {
            enterApp.disabled = false;
            if (error && error.status === 401) {
                window.AuthGuard.clearIdentity();
                loginForm.parentElement.style.display = 'block';
                interestCard.style.display = 'none';
                loginError.textContent = '登录状态已失效，请重新登录';
                if (interestError) interestError.textContent = '';
                return;
            }
            // 保存失败：不进入应用，也不写本地缓存
            if (interestError) interestError.textContent = '保存失败，请检查网络后重试';
        });
    });

    skipInterest.addEventListener('click', function() {
        localStorage.removeItem('interest');
        goToApp();
    });

    function saveSession(userId, username) {
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', username);
    }

    function goToApp() {
        window.location.href = '/index.html';
    }

    // ===== 自动检查：以服务端会话为准，localStorage 只作显示缓存 =====
    window.AuthGuard.me().then(function(user) {
        if (user) {
            saveSession(user.userId, user.username);
            applyServerInterest(user.interest);
            if (user.role === 'ADMIN') {
                window.location.href = '/admin.html';
            } else {
                goToApp();
            }
        }
    });
})();
