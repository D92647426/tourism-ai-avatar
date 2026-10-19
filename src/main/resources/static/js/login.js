// ===== 登录注册逻辑 =====
(function() {
    'use strict';

    var S = function(id) { return document.getElementById(id); };

    var loginForm = S('loginForm');
    var registerForm = S('registerForm');
    var registerCard = S('registerCard');
    var interestCard = S('interestCard');
    var loginError = S('loginError');
    var regError = S('regError');
    var enterApp = S('enterApp');
    var skipInterest = S('skipInterest');

    var currentUserId = null;
    var selectedInterest = '';

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

    // ===== 注册 =====
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var u = S('regUsername').value.trim();
        var p = S('regPassword').value;
        var p2 = S('regPassword2').value;

        if (p !== p2) { regError.textContent = '两次密码不一致'; return; }

        fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.success) {
                currentUserId = d.userId;
                registerCard.style.display = 'none';
                interestCard.style.display = 'block';
                // 记录到 localStorage
                saveSession(d.userId, d.username);
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

        fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        }).then(function(r) { return r.json(); }).then(function(d) {
            if (d.success) {
                currentUserId = d.userId;
                saveSession(d.userId, d.username);
                if (d.interest) {
                    // 已有兴趣偏好，直接进入
                    localStorage.setItem('interest', d.interest);
                    goToApp();
                } else {
                    // 还没选兴趣
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
        if (!selectedInterest) return;
        saveInterest(selectedInterest);
        goToApp();
    });

    skipInterest.addEventListener('click', function() { goToApp(); });

    function saveInterest(interest) {
        localStorage.setItem('interest', interest);
        if (currentUserId) {
            fetch('/api/auth/interest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, interest: interest })
            }).catch(function(){});
        }
    }

    function saveSession(userId, username) {
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', username);
    }

    function goToApp() {
        window.location.href = '/index.html';
    }

    // ===== 自动检查登录状态 =====
    if (localStorage.getItem('userId')) {
        // 已登录，直接跳转
        goToApp();
    }
})();
