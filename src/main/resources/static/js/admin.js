// ===== 管理后台 - 前端逻辑 =====

(function() {
    'use strict';

    var S = function(id) { return document.getElementById(id); };

    // ===== 登录 / 权限校验（页面提示不替代服务端权限） =====
    var adminGate = S('adminGate');
    var adminGateLogin = S('adminGateLogin');
    var adminGateDenied = S('adminGateDenied');
    var adminGateError = S('adminGateError');
    var adminIdentity = S('adminIdentity');
    var adminStarted = false;

    // 会话失效/被拒绝时结束页面上的管理员状态，避免继续展示或误用此前的数据
    function endAdminSession() {
        adminStarted = false;
        if (adminIdentity) adminIdentity.textContent = '';
        // 清掉上一次会话加载的敏感列表，避免退出/被拒绝后仍可从 DOM 读到旧数据
        var knowledgeBody = S('knowledgeTbody');
        if (knowledgeBody) knowledgeBody.innerHTML = '';
        var usersBody = document.querySelector('#usersTable tbody');
        if (usersBody) usersBody.innerHTML = '';
    }

    function showLoginGate(message) {
        endAdminSession();
        adminGate.style.display = 'flex';
        adminGateLogin.style.display = 'block';
        adminGateDenied.style.display = 'none';
        adminGateError.textContent = message || '';
    }

    function showForbiddenGate() {
        endAdminSession();
        adminGate.style.display = 'flex';
        adminGateLogin.style.display = 'none';
        adminGateDenied.style.display = 'block';
    }

    function hideGate() {
        adminGate.style.display = 'none';
    }

    // 统一请求封装：携带 Cookie 会话与 CSRF token；401/403 只显示提示，不做循环重定向。
    function apiFetch(url, options) {
        return window.AuthGuard.apiFetch(url, options).then(function(res) {
            if (res.status === 401) {
                showLoginGate('登录状态已失效，请重新登录');
                throw new Error('unauthorized');
            }
            if (res.status === 403) {
                showForbiddenGate();
                throw new Error('forbidden');
            }
            return res;
        });
    }

    function activeTabName() {
        var active = document.querySelector('.nav-item.active');
        return active ? active.dataset.tab : 'dashboard';
    }

    function loadTab(tab) {
        if (tab === 'knowledge') loadKnowledge();
        else if (tab === 'digital-human') loadDigitalHumanConfig();
        else if (tab === 'reports') loadReports();
        else if (tab === 'users') loadUsers();
        else loadDashboard();
    }

    // 登录（含过期后重新登录）成功后重载当前激活 tab，不能只隐藏遮罩留下旧数据
    function startAdmin(username) {
        hideGate();
        adminStarted = true;
        if (adminIdentity && username) {
            adminIdentity.textContent = '👤 ' + username + '（管理员）';
        }
        loadTab(activeTabName());
    }

    // 管理员登录
    S('adminLoginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var username = S('adminUsername').value.trim();
        var password = S('adminPassword').value;
        window.AuthGuard.apiFetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        }).then(function(res) {
            return res.json().then(function(d) {
                d.__status = res.status;
                return d;
            });
        }).then(function(d) {
            if (!d.success) {
                adminGateError.textContent = d.__status === 401
                    ? '用户名或密码错误'
                    : (d.message || '登录失败');
                return;
            }
            if (d.role !== 'ADMIN') {
                showForbiddenGate();
                return;
            }
            S('adminPassword').value = '';
            adminGateError.textContent = '';
            var switchError = S('adminGateSwitchError');
            if (switchError) switchError.textContent = '';
            startAdmin(d.username);
        }).catch(function() {
            adminGateError.textContent = '登录失败，请稍后重试';
        });
    });

    // 退出登录：仅当服务端确认退出后才跳转，失败时显示可见提示并允许重试
    S('adminLogout').addEventListener('click', function() {
        var button = S('adminLogout');
        var error = S('adminLogoutError');
        if (error) error.textContent = '';
        button.disabled = true;
        window.AuthGuard.logout().then(function() {
            window.location.href = '/login.html';
        }).catch(function() {
            button.disabled = false;
            if (error) error.textContent = '退出失败，请检查网络后重试';
        });
    });

    // 无权限面板的“切换账号登录”：先结束服务端会话，再显示本页管理员登录表单
    var adminSwitchAccount = S('adminSwitchAccount');
    if (adminSwitchAccount) {
        adminSwitchAccount.addEventListener('click', function() {
            var switchError = S('adminGateSwitchError');
            if (switchError) switchError.textContent = '';
            adminSwitchAccount.disabled = true;
            window.AuthGuard.logout().then(function() {
                adminSwitchAccount.disabled = false;
                showLoginGate('已退出当前账号，请使用管理员账号登录');
            }).catch(function() {
                adminSwitchAccount.disabled = false;
                if (switchError) switchError.textContent = '退出失败，请检查网络后重试';
            });
        });
    }

    function checkIdentity() {
        window.AuthGuard.me().then(function(user) {
            if (!user) {
                showLoginGate('');
                return;
            }
            if (user.role !== 'ADMIN') {
                showForbiddenGate();
                return;
            }
            startAdmin(user.username);
        }).catch(function() {
            showLoginGate('无法确认登录状态，请重新登录');
        });
    }

    // ===== Tab 导航 =====
    var navItems = document.querySelectorAll('.nav-item');
    var tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(function(item) {
        item.addEventListener('click', function() {
            var tab = this.dataset.tab;
            navItems.forEach(function(n) { n.classList.remove('active'); });
            this.classList.add('active');
            tabContents.forEach(function(t) { t.classList.remove('active'); });
            document.getElementById('tab-' + tab).classList.add('active');

            // 切换时加载数据
            if (tab === 'dashboard') loadDashboard();
            if (tab === 'knowledge') loadKnowledge();
            if (tab === 'digital-human') loadDigitalHumanConfig();
            if (tab === 'reports') loadReports();
            if (tab === 'users') loadUsers();
        });
    });

    // ===== 数据大屏 =====
    var sentimentChart = null;
    var spotsChart = null;
    var hotQuestionsChart = null;
    var hourlyChart = null;

    function loadDashboard() {
        apiFetch('/api/admin/dashboard')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                updateStatCards(data);
                renderHotQuestions(data.hotQuestions || []);
                renderSentimentTrend(data.sentimentTrend || []);
                renderSpotRanking(data.spotRanking || []);
                renderHourlyDistribution(data.hourlyDistribution || []);
                document.getElementById('lastRefresh').textContent = new Date().toLocaleTimeString();
            })
            .catch(function(err) {
                console.error('仪表盘加载失败:', err);
            });
    }

    function updateStatCards(data) {
        document.getElementById('statToday').textContent = data.todayVisitors || 0;
        document.getElementById('statWeek').textContent = data.weekVisitors || 0;
        document.getElementById('statSatisfaction').textContent = (data.satisfactionRate || 95) + '%';
        document.getElementById('statKnowledge').textContent = data.totalKnowledgeItems || 0;
    }

    function renderHotQuestions(questions) {
        var dom = document.getElementById('chartHotQuestions');
        if (hotQuestionsChart) hotQuestionsChart.dispose();
        hotQuestionsChart = echarts.init(dom);

        var names = questions.map(function(q) { return q.question; });
        var values = questions.map(function(q) { return q.count; });

        // 如果没有数据，显示示例
        if (names.length === 0) {
            names = ['暂无数据'];
            values = [0];
        }

        hotQuestionsChart.setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '8%', bottom: '3%', containLabel: true },
            xAxis: { type: 'value', name: '提问次数' },
            yAxis: { type: 'category', data: names.reverse(), axisLabel: { width: 120, overflow: 'truncate' } },
            series: [{
                type: 'bar',
                data: values.reverse().map(function(v, i) {
                    return { value: v, itemStyle: { color: ['#2d8f4e','#3da061','#4fb374','#6fc487','#8fd59a'][i] || '#2d8f4e' } };
                }),
                barMaxWidth: 40
            }]
        });
    }

    function renderSentimentTrend(trend) {
        var dom = document.getElementById('chartSentiment');
        if (sentimentChart) sentimentChart.dispose();
        sentimentChart = echarts.init(dom);

        var dates = trend.map(function(d) { return d.date; });
        var positive = trend.map(function(d) { return d.positive || 0; });
        var neutral = trend.map(function(d) { return d.neutral || 0; });
        var negative = trend.map(function(d) { return d.negative || 0; });

        sentimentChart.setOption({
            tooltip: { trigger: 'axis' },
            legend: { data: ['正面', '中性', '负面'], bottom: 0 },
            grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
            xAxis: { type: 'category', data: dates },
            yAxis: { type: 'value', name: '交互次数' },
            series: [
                { name: '正面', type: 'line', data: positive, smooth: true, itemStyle: { color: '#4caf50' } },
                { name: '中性', type: 'line', data: neutral, smooth: true, itemStyle: { color: '#ff9800' } },
                { name: '负面', type: 'line', data: negative, smooth: true, itemStyle: { color: '#f44336' } }
            ]
        });
    }

    function renderSpotRanking(ranking) {
        var dom = document.getElementById('chartSpots');
        if (spotsChart) spotsChart.dispose();
        spotsChart = echarts.init(dom);

        var names = ranking.map(function(r) { return r.spot; });
        var values = ranking.map(function(r) { return r.count; });

        if (names.length === 0) {
            names = ['暂无数据'];
            values = [{ value: 1, name: '暂无数据', itemStyle: { color: '#ddd' } }];
            spotsChart.setOption({
                title: { text: '暂无景点关注数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } },
                series: [{ type: 'pie', radius: ['40%', '70%'], data: values }]
            });
            return;
        }

        spotsChart.setOption({
            tooltip: { trigger: 'item', formatter: '{b}: {c} 次 ({d}%)' },
            legend: { orient: 'vertical', right: 10, top: 'center' },
            series: [{
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['35%', '50%'],
                data: ranking.map(function(r) { return { value: r.count, name: r.spot }; }),
                emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } }
            }]
        });
    }

    function renderHourlyDistribution(data) {
        var dom = document.getElementById('chartHourly');
        if (hourlyChart) hourlyChart.dispose();
        hourlyChart = echarts.init(dom);

        var hours = data.map(function(d) { return d.hour; });
        var values = data.map(function(d) { return d.count; });

        hourlyChart.setOption({
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category', data: hours, axisLabel: { rotate: 45, fontSize: 10 } },
            yAxis: { type: 'value', name: '交互次数' },
            series: [{
                type: 'bar',
                data: values,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#2d8f4e' },
                        { offset: 1, color: '#a8e6cf' }
                    ])
                },
                barMaxWidth: 20
            }]
        });
    }

    // 窗口大小变化时重绘图表
    window.addEventListener('resize', function() {
        if (hotQuestionsChart) hotQuestionsChart.resize();
        if (sentimentChart) sentimentChart.resize();
        if (spotsChart) spotsChart.resize();
        if (hourlyChart) hourlyChart.resize();
        if (window._reportSentimentChart) window._reportSentimentChart.resize();
        if (window._reportTopicsChart) window._reportTopicsChart.resize();
    });

    // 30秒自动刷新仪表盘
    setInterval(function() {
        if (adminStarted && document.getElementById('tab-dashboard').classList.contains('active')) {
            loadDashboard();
        }
    }, 30000);

    // ===== 知识库管理 =====
    var kwModalOverlay = document.getElementById('kwModalOverlay');
    var kwEditId = document.getElementById('kwEditId');

    function loadKnowledge() {
        var keyword = document.getElementById('kwSearch').value.trim();
        var category = document.getElementById('kwCategoryFilter').value;

        var url = '/api/admin/knowledge?';
        if (keyword) url += 'keyword=' + encodeURIComponent(keyword) + '&';
        if (category) url += 'category=' + encodeURIComponent(category);

        apiFetch(url)
            .then(function(res) { return res.json(); })
            .then(function(data) { renderKnowledgeTable(data); })
            .catch(function() {
                document.getElementById('knowledgeTbody').innerHTML =
                    '<tr><td colspan="6" style="text-align:center;padding:40px;color:#999;">加载失败</td></tr>';
            });
    }

    function renderKnowledgeTable(items) {
        var tbody = document.getElementById('knowledgeTbody');
        if (!items || items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#999;">暂无数据</td></tr>';
            return;
        }
        tbody.innerHTML = items.map(function(item) {
            var brief = item.content ? item.content.substring(0, 60) + '...' : '';
            return '<tr>' +
                '<td>' + item.id + '</td>' +
                '<td><strong>' + escapeHtml(item.title) + '</strong></td>' +
                '<td><span class="category-tag ' + item.category + '">' + item.category + '</span></td>' +
                '<td>' + escapeHtml(brief) + '</td>' +
                '<td>' + (item.createTime || '--') + '</td>' +
                '<td>' +
                    '<button class="btn btn-primary btn-sm" onclick="window._editKnowledge(' + item.id + ')">编辑</button>' +
                    '<button class="btn btn-danger btn-sm" onclick="window._deleteKnowledge(' + item.id + ')">删除</button>' +
                '</td>' +
            '</tr>';
        }).join('');
    }

    // 暴露到全局供 onclick 使用
    window._editKnowledge = function(id) {
        apiFetch('/api/admin/knowledge/' + id)
            .then(function(res) { return res.json(); })
            .then(function(item) {
                document.getElementById('kwModalTitle').textContent = '编辑知识条目';
                kwEditId.value = item.id;
                document.getElementById('kwEditTitle').value = item.title || '';
                document.getElementById('kwEditCategory').value = item.category || '景点讲解';
                document.getElementById('kwEditContent').value = item.content || '';
                document.getElementById('kwEditKeywords').value = item.keywords || '';
                kwModalOverlay.classList.add('active');
            });
    };

    window._deleteKnowledge = function(id) {
        if (!confirm('确定要删除此知识条目吗？此操作不可撤销。')) return;
        apiFetch('/api/admin/knowledge/' + id, { method: 'DELETE' })
            .then(function(res) {
                if (res.ok) { loadKnowledge(); }
                else { alert('删除失败'); }
            });
    };

    // 搜索/筛选
    document.getElementById('kwSearch').addEventListener('input', loadKnowledge);
    document.getElementById('kwCategoryFilter').addEventListener('change', loadKnowledge);

    // 新增按钮
    document.getElementById('btnAddKnowledge').addEventListener('click', function() {
        document.getElementById('kwModalTitle').textContent = '新增知识条目';
        kwEditId.value = '';
        document.getElementById('kwEditTitle').value = '';
        document.getElementById('kwEditCategory').value = '景点讲解';
        document.getElementById('kwEditContent').value = '';
        document.getElementById('kwEditKeywords').value = '';
        kwModalOverlay.classList.add('active');
    });

    // 模态框操作
    document.getElementById('kwModalClose').addEventListener('click', function() {
        kwModalOverlay.classList.remove('active');
    });
    document.getElementById('kwModalCancel').addEventListener('click', function() {
        kwModalOverlay.classList.remove('active');
    });
    kwModalOverlay.addEventListener('click', function(e) {
        if (e.target === kwModalOverlay) kwModalOverlay.classList.remove('active');
    });

    // 保存
    document.getElementById('kwModalSave').addEventListener('click', function() {
        var item = {
            title: document.getElementById('kwEditTitle').value.trim(),
            category: document.getElementById('kwEditCategory').value,
            content: document.getElementById('kwEditContent').value.trim(),
            keywords: document.getElementById('kwEditKeywords').value.trim()
        };

        if (!item.title || !item.content) {
            alert('标题和内容不能为空');
            return;
        }

        var id = kwEditId.value;
        var url = '/api/admin/knowledge';
        var method = 'POST';
        if (id) {
            url += '/' + id;
            method = 'PUT';
        }

        apiFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        })
        .then(function(res) { return res.json(); })
        .then(function() {
            kwModalOverlay.classList.remove('active');
            loadKnowledge();
        })
        .catch(function() { alert('保存失败'); });
    });

    // ===== 数字人形象管理 =====

    function loadDigitalHumanConfig() {
        apiFetch('/api/admin/digital-human-config')
            .then(function(res) { return res.json(); })
            .then(function(config) {
                document.getElementById('cfgName').value = config.name || '灵灵';
                document.getElementById('cfgWelcome').value = config.welcomeMessage || '';
                document.getElementById('cfgVoice').value = config.voiceType || 'female';
                document.getElementById('cfgColor').value = config.primaryColor || '#2d8f4e';
                document.getElementById('cfgVolume').value = config.volume || 1.0;
                document.getElementById('cfgSpeed').value = config.speechRate || 1.0;
                document.getElementById('cfgVolumeLabel').textContent = config.volume || 1.0;
                document.getElementById('cfgSpeedLabel').textContent = config.speechRate || 1.0;
            })
            .catch(function() { /* 使用默认值 */ });
    }

    // 范围滑块联动
    document.getElementById('cfgVolume').addEventListener('input', function() {
        document.getElementById('cfgVolumeLabel').textContent = this.value;
    });
    document.getElementById('cfgSpeed').addEventListener('input', function() {
        document.getElementById('cfgSpeedLabel').textContent = this.value;
    });

    // 保存配置
    document.getElementById('btnSaveConfig').addEventListener('click', function() {
        var config = {
            name: document.getElementById('cfgName').value.trim(),
            welcomeMessage: document.getElementById('cfgWelcome').value.trim(),
            voiceType: document.getElementById('cfgVoice').value,
            primaryColor: document.getElementById('cfgColor').value,
            volume: parseFloat(document.getElementById('cfgVolume').value),
            speechRate: parseFloat(document.getElementById('cfgSpeed').value)
        };

        apiFetch('/api/admin/digital-human-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        })
        .then(function(res) { return res.json(); })
        .then(function() {
            alert('配置保存成功！游客端将在刷新后生效。');
        })
        .catch(function() { alert('保存失败'); });
    });

    // ===== 感受度报告 =====

    function loadReports() {
        loadSentimentReport();
        loadTopicsReport();
        loadSuggestions();
    }

    function loadSentimentReport() {
        apiFetch('/api/admin/reports/sentiment')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                renderReportSentiment(data.trend || []);
            });
    }

    function loadTopicsReport() {
        apiFetch('/api/admin/reports/topics')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                renderReportTopics(data.topics || []);
            });
    }

    function loadSuggestions() {
        apiFetch('/api/admin/reports/suggestions')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                var list = document.getElementById('suggestionsList');
                var suggestions = data.suggestions || [];
                if (suggestions.length === 0) {
                    list.innerHTML = '<p class="loading-text">暂无服务建议，积累更多交互数据后将自动生成。</p>';
                    return;
                }
                list.innerHTML = suggestions.map(function(s) {
                    return '<div class="suggestion-item ' + (s.level || 'info') + '">' +
                        '<div class="sug-title">' + (s.level === 'danger' ? '⚠️ ' : s.level === 'warning' ? '⚡ ' : '💡 ') + s.title + '</div>' +
                        '<div class="sug-detail">' + s.detail + '</div>' +
                    '</div>';
                }).join('');
            });
    }

    function renderReportSentiment(trend) {
        var dom = document.getElementById('chartReportSentiment');
        if (window._reportSentimentChart) window._reportSentimentChart.dispose();
        window._reportSentimentChart = echarts.init(dom);

        var dates = trend.map(function(d) { return d.date; });
        var positive = trend.map(function(d) { return d.positive || 0; });
        var neutral = trend.map(function(d) { return d.neutral || 0; });
        var negative = trend.map(function(d) { return d.negative || 0; });

        window._reportSentimentChart.setOption({
            tooltip: { trigger: 'axis' },
            legend: { data: ['正面', '中性', '负面'], bottom: 0 },
            grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
            xAxis: { type: 'category', data: dates },
            yAxis: { type: 'value' },
            series: [
                { name: '正面', type: 'line', data: positive, smooth: true, areaStyle: { color: 'rgba(76,175,80,0.2)' }, itemStyle: { color: '#4caf50' } },
                { name: '中性', type: 'line', data: neutral, smooth: true, areaStyle: { color: 'rgba(255,152,0,0.1)' }, itemStyle: { color: '#ff9800' } },
                { name: '负面', type: 'line', data: negative, smooth: true, areaStyle: { color: 'rgba(244,67,54,0.1)' }, itemStyle: { color: '#f44336' } }
            ]
        });
    }

    function renderReportTopics(topics) {
        var dom = document.getElementById('chartReportTopics');
        if (window._reportTopicsChart) window._reportTopicsChart.dispose();
        window._reportTopicsChart = echarts.init(dom);

        if (!topics || topics.length === 0) {
            window._reportTopicsChart.setOption({
                title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#999' } }
            });
            return;
        }

        window._reportTopicsChart.setOption({
            tooltip: { trigger: 'item', formatter: '{b}: {c} 次 ({d}%)' },
            series: [{
                type: 'pie',
                radius: ['45%', '75%'],
                center: ['50%', '50%'],
                data: topics.map(function(t) { return { value: t.count, name: t.spot }; }),
                label: { formatter: '{b}\n{d}%' },
                emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } }
            }]
        });
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // ===== 用户列表 =====
    function loadUsers() {
        apiFetch('/api/admin/users')
            .then(function(res) { return res.json(); })
            .then(function(users) {
                var tbody = document.querySelector('#usersTable tbody');
                if (!users || users.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" class="loading-text">暂无注册用户</td></tr>';
                    return;
                }
                tbody.innerHTML = users.map(function(u) {
                    var date = new Date(u.createdAt).toLocaleString('zh-CN');
                    return '<tr>' +
                        '<td>' + escapeHtml(u.username) + '</td>' +
                        '<td>' + (u.interest || '未选择') + '</td>' +
                        '<td>' + date + '</td>' +
                        '</tr>';
                }).join('');
            })
            .catch(function() {
                document.querySelector('#usersTable tbody').innerHTML =
                    '<tr><td colspan="3" class="loading-text">加载失败</td></tr>';
            });
    }

    // ===== 初始化：先向服务端确认管理员身份，再加载数据 =====
    function init() {
        checkIdentity();
    }

    init();
})();
