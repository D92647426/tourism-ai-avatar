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
    var configEpoch = 0, configLoaded = false, configSaving = false;

    // 会话失效/被拒绝时结束页面上的管理员状态，避免继续展示或误用此前的数据
    function endAdminSession() {
        configEpoch++;
        configLoaded = false; configSaving = false;
        configControls();
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
    var dashboardGeneration = 0;
    var reportGeneration = 0;

    function readJson(url) {
        return apiFetch(url).then(function(res) { if (!res.ok) throw new Error('统计接口请求失败'); return res.json(); });
    }
    function resetDashboardCharts(message) {
        [sentimentChart, spotsChart, hotQuestionsChart, hourlyChart].forEach(function(chart) { if (chart) chart.dispose(); });
        sentimentChart = spotsChart = hotQuestionsChart = hourlyChart = null;
        ['chartHotQuestions','chartSentiment','chartSpots','chartHourly'].forEach(function(id) {
            var node = document.getElementById(id); node.textContent = message || '';
            if (message) node.classList.add('chart-unavailable'); else node.classList.remove('chart-unavailable');
        });
    }
    /** REQ-034: one accepted dashboard response updates counts and charts together.
     * HTTP/shape failures display unavailable, never fabricated zeroes or 95%.
     * A stale response cannot overwrite a later refresh. See docs/analytics_accuracy.md.
     */

    function loadDashboard() {
        var generation = ++dashboardGeneration;
        document.getElementById('dashboardStatus').textContent = '正在读取统计数据…';
        readJson('/api/admin/dashboard')
            .then(function(data) {
                if (generation !== dashboardGeneration) return;
                updateStatCards(data);
                if (!Array.isArray(data.hotQuestions) || !Array.isArray(data.sentimentTrend) || !Array.isArray(data.spotRanking) || !Array.isArray(data.hourlyDistribution)) throw new Error('图表数据结构缺失');
                resetDashboardCharts();
                try {
                    if (typeof echarts === 'undefined') throw new Error('chart unavailable');
                    renderHotQuestions(data.hotQuestions);
                    renderSentimentTrend(data.sentimentTrend);
                    renderSpotRanking(data.spotRanking);
                    renderHourlyDistribution(data.hourlyDistribution);
                    document.getElementById('dashboardStatus').textContent = '已按当前日志更新。问答次数不代表独立访客。';
                } catch (chartError) {
                    resetDashboardCharts('图表组件暂不可用；上方统计卡片已更新。');
                    document.getElementById('dashboardStatus').textContent = '数值已更新，图表组件未加载；请检查网络后刷新。';
                }
                document.getElementById('lastRefresh').textContent = new Date().toLocaleTimeString();
            })
            .catch(function(err) {
                if (generation !== dashboardGeneration) return;
                ['statToday','statWeek','statPositiveRate','statKnowledge'].forEach(function(id) { document.getElementById(id).textContent = '--'; });
                document.getElementById('statSentimentSample').textContent = '样本数不可用';
                document.getElementById('dashboardPeriod').textContent = '统计范围未加载';
                document.getElementById('dashboardStatus').textContent = '统计加载失败，请稍后刷新；当前不展示无法确认的数据。';
                document.getElementById('lastRefresh').textContent = '未刷新成功';
                resetDashboardCharts('统计数据不可用');
                console.error('仪表盘加载失败:', err);
            });
    }

    function updateStatCards(data) {
        var view = window.AdminStats.dashboard(data);
        document.getElementById('statToday').textContent = view.today;
        document.getElementById('statWeek').textContent = view.last7;
        document.getElementById('statPositiveRate').textContent = view.rate;
        document.getElementById('statKnowledge').textContent = view.knowledge;
        document.getElementById('statSentimentSample').textContent = view.sample;
        document.getElementById('dashboardPeriod').textContent = view.period;
    }

    function renderHotQuestions(questions) {
        var dom = document.getElementById('chartHotQuestions');
        if (hotQuestionsChart) hotQuestionsChart.dispose();
        hotQuestionsChart = echarts.init(dom);

        var names = questions.map(function(q) { return q.question; });
        var values = questions.map(function(q) { return q.count; });

        // REQ-034: an empty state has no synthetic sample or chart bar.
        if (names.length === 0) {
            hotQuestionsChart.setOption({ title: { text: '暂无问答数据', left: 'center', top: 'center' }, series: [] });
            return;
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
        if (!trend.some(function(day) { return day.total > 0; })) {
            sentimentChart.setOption({ title: { text: '暂无问句情绪样本', left: 'center', top: 'center' }, series: [] }); return;
        }

        var dates = trend.map(function(d) { return d.date; });
        var positive = trend.map(function(d) { return d.positive || 0; });
        var neutral = trend.map(function(d) { return d.neutral || 0; });
        var negative = trend.map(function(d) { return d.negative || 0; });
        var unclassified = trend.map(function(d) { return d.unclassified || 0; });

        sentimentChart.setOption({
            tooltip: { trigger: 'axis' },
            legend: { data: ['正向问句', '中性问句', '负向问句', '未分类'], bottom: 0 },
            grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
            xAxis: { type: 'category', data: dates },
            yAxis: { type: 'value', name: '交互次数' },
            series: [
                { name: '正向问句', type: 'line', data: positive, itemStyle: { color: '#4caf50' } },
                { name: '中性问句', type: 'line', data: neutral, itemStyle: { color: '#ff9800' } },
                { name: '负向问句', type: 'line', data: negative, itemStyle: { color: '#f44336' } },
                { name: '未分类', type: 'line', data: unclassified, itemStyle: { color: '#87958b' } }
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
            spotsChart.setOption({
                title: { text: '暂无景点关注数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } },
                series: []
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
        if (!values.some(function(value) { return value > 0; })) {
            hourlyChart.setOption({ title: { text: '暂无问答数据', left: 'center', top: 'center' }, series: [] }); return;
        }

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

    /** REQ-038: only a loaded, verified snapshot can be edited/saved. See docs/display_config.md. */
    function configControls() {
        var disabled = !configLoaded || configSaving;
        ['cfgName','cfgWelcome','cfgVoice','cfgColor','cfgVolume','cfgSpeed','btnSaveConfig'].forEach(function(id) {
            if (S(id)) S(id).disabled = disabled;
        });
        if (S('btnReloadConfig')) S('btnReloadConfig').disabled = configSaving;
    }
    function configStatus(message) { S('cfgStatus').textContent = message; }
    function validConfig(data) {
        if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('展示设置响应无效，请重新加载');
        var display = window.GuideDisplayConfig.normalize(data);
        if (['name','welcomeMessage','primaryColor'].some(function(k) { return data[k] !== display[k]; }) ||
            typeof data.voiceType !== 'string' || !data.voiceType || typeof data.modelName !== 'string' || !data.modelName ||
            !Number.isFinite(data.volume) || data.volume < 0 || data.volume > 1 ||
            !Number.isFinite(data.speechRate) || data.speechRate < 0.5 || data.speechRate > 2) {
            throw new Error('展示设置响应无效，请重新加载');
        }
        return data;
    }
    function readConfig(res) {
        return res.json().then(function(data) {
            if (!res.ok) throw new Error(data && data.message || '配置请求失败，请重试');
            return validConfig(data);
        });
    }
    var savedVoiceType = 'auto';
    // REQ-042: options reflect this device; preserve saved values absent here. docs/voice_settings.md.
    function refreshVoiceOptions(value) {
        var select = S('cfgVoice');
        var selected = value || select.value || savedVoiceType;
        var voices = [];
        try { voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : []; } catch(e) {}
        var list = window.GuideVoiceSettings.chinese(voices);
        select.innerHTML = '';
        function option(key,label) { var node=document.createElement('option');node.value=key;node.textContent=label;select.appendChild(node); }
        option('auto','设备默认中文声线');
        list.forEach(function(voice) { option(voice.voiceURI,(voice.name || voice.voiceURI)+' · '+voice.lang); });
        if(selected !== 'auto' && !list.some(function(v){return v.voiceURI===selected;})) option(selected,'已保存但本设备未提供：'+selected);
        select.value = selected;
        S('cfgVoiceNotice').textContent = window.GuideVoiceSettings.choose({voiceType:selected},voices).notice + ' 声线依赖游客设备，不保证跨设备或男女声。Android 参数使用浏览器语音回退。';
    }
    if (window.speechSynthesis && window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged',function(){refreshVoiceOptions();});
    function showConfig(config) {
        S('cfgName').value = config.name; S('cfgWelcome').value = config.welcomeMessage;
        savedVoiceType = config.voiceType; refreshVoiceOptions(config.voiceType); S('cfgColor').value = config.primaryColor;
        S('cfgVolume').value = config.volume; S('cfgSpeed').value = config.speechRate;
        S('cfgVolumeLabel').textContent = config.volume; S('cfgSpeedLabel').textContent = config.speechRate;
        renderConfigPreview();
    }
    /** REQ-038: draft-only preview shares safe display normalization; it never writes config. */
    function renderConfigPreview() {
        var display = window.GuideDisplayConfig.normalize({name:S('cfgName').value,
            welcomeMessage:S('cfgWelcome').value, primaryColor:S('cfgColor').value});
        var colors = window.GuideDisplayConfig.palette(display.primaryColor);
        S('cfgPreviewName').textContent = 'AI导游' + display.name;
        S('cfgPreviewWelcome').textContent = display.welcomeMessage;
        S('cfgPreview').style.setProperty('--preview-primary', display.primaryColor);
        S('cfgPreview').style.setProperty('--preview-on', colors['--on-primary']);
        S('cfgPreview').style.setProperty('--preview-light', colors['--primary-light']);
    }
    function loadDigitalHumanConfig() {
        if (!adminStarted || configSaving) return;
        var epoch = ++configEpoch;
        configLoaded = false; configControls(); configStatus('正在加载展示设置…');
        apiFetch('/api/admin/digital-human-config').then(readConfig).then(function(data) {
            if (epoch !== configEpoch) return;
            showConfig(data); configLoaded = true; configControls(); configStatus('已加载。保存后游客刷新生效。');
        }).catch(function() {
            if (epoch !== configEpoch) return;
            configLoaded = false; configControls(); configStatus('加载失败，请点击重新加载后再保存。');
        });
    }
    S('btnReloadConfig').addEventListener('click', loadDigitalHumanConfig);
    ['cfgName','cfgWelcome','cfgColor','cfgVoice','cfgVolume','cfgSpeed'].forEach(function(id) {
        S(id).addEventListener('input', function() {
            renderConfigPreview();
            if (configLoaded && !configSaving) configStatus('有未保存的更改。保存后游客刷新生效。');
        });
    });
    S('cfgVolume').addEventListener('input', function() { S('cfgVolumeLabel').textContent = this.value; });
    S('cfgSpeed').addEventListener('input', function() { S('cfgSpeedLabel').textContent = this.value; });

    S('btnSaveConfig').addEventListener('click', function() {
        if (!adminStarted || !configLoaded || configSaving) return;
        var expected = {name:S('cfgName').value.trim(), welcomeMessage:S('cfgWelcome').value.trim(),
            voiceType:S('cfgVoice').value, primaryColor:S('cfgColor').value,
            volume:parseFloat(S('cfgVolume').value), speechRate:parseFloat(S('cfgSpeed').value)};
        var epoch = ++configEpoch;
        configSaving = true; configControls(); configStatus('正在保存…');
        apiFetch('/api/admin/digital-human-config', {method:'PUT', headers:{'Content-Type':'application/json'},
            body:JSON.stringify(expected)}).then(readConfig).then(function(saved) {
            if (epoch !== configEpoch) return;
            if (Object.keys(expected).some(function(k) { return saved[k] !== expected[k]; })) {
                throw new Error('保存结果未确认，请重新加载后核对。');
            }
            showConfig(saved); configStatus('已保存。游客刷新页面后生效。');
        }).catch(function(error) {
            if (epoch === configEpoch) configStatus(error && error.message || '未保存，请重试。');
        }).finally(function() {
            if (epoch === configEpoch) { configSaving = false; configControls(); }
        });
    });
    configControls();

    // ===== 感受度报告 =====

    function resetReportCharts(message) {
        if (window._reportSentimentChart) window._reportSentimentChart.dispose();
        if (window._reportTopicsChart) window._reportTopicsChart.dispose();
        window._reportSentimentChart = window._reportTopicsChart = null;
        ['chartReportSentiment','chartReportTopics'].forEach(function(id) { document.getElementById(id).textContent = message || ''; });
    }

    /** REQ-034: render one report snapshot; all panels share its cutoff and sample.
     * On failure clear stale panels. CDN failures keep verified numbers available.
     * See docs/analytics_accuracy.md, API-034; no fabricated rating or visitor data.
     */
    function loadReports() {
        var generation = ++reportGeneration;
        document.getElementById('reportStatus').textContent = '正在读取近7天报告…';
        readJson('/api/admin/reports/sentiment').then(function(data) {
            if (generation !== reportGeneration) return;
            var view = window.AdminStats.report(data);
            if (!Array.isArray(data.trend) || !Array.isArray(data.topics) || !Array.isArray(data.suggestions)) throw new Error('报告数据结构缺失');
            document.getElementById('reportPeriod').textContent = view.period;
            document.getElementById('reportSample').textContent = view.sample + '；正向问句占比：' + view.rate + '。这不是游客满意度。';
            resetReportCharts();
            try {
                if (typeof echarts === 'undefined') throw new Error('chart unavailable');
                renderReportSentiment(data.trend);
                renderReportTopics(data.topics);
                document.getElementById('reportStatus').textContent = '整份报告采用同一快照；问句情绪来自关键词规则。';
            } catch (chartError) {
                resetReportCharts('图表组件暂不可用，样本与统计范围已显示。');
                document.getElementById('reportStatus').textContent = '数值与建议已更新；图表组件未加载，请检查网络后刷新。';
            }
            renderSuggestions(data.suggestions);
        }).catch(function() {
            if (generation !== reportGeneration) return;
            resetReportCharts('报告数据不可用');
            document.getElementById('reportPeriod').textContent = '统计范围未加载';
            document.getElementById('reportSample').textContent = '样本数不可用';
            document.getElementById('reportStatus').textContent = '情绪报告加载失败，请稍后重试。';
            document.getElementById('suggestionsList').textContent = '建议加载失败，请稍后重试。';
        });
    }

    function renderSuggestions(suggestions) {
        var list = document.getElementById('suggestionsList');
        if (!suggestions.length) { list.textContent = '暂无规则建议，积累更多问答后再查看。'; return; }
        list.innerHTML = suggestions.map(function(s) {
            var level = ['info','warning','danger'].indexOf(s.level) >= 0 ? s.level : 'info';
            return '<div class="suggestion-item ' + level + '"><div class="sug-title">' + escapeHtml(s.title) + '</div><div class="sug-detail">' + escapeHtml(s.detail) + '</div></div>';
        }).join('');
    }

    function renderReportSentiment(trend) {
        var dom = document.getElementById('chartReportSentiment');
        if (window._reportSentimentChart) window._reportSentimentChart.dispose();
        window._reportSentimentChart = echarts.init(dom);
        if (!trend.some(function(day) { return day.total > 0; })) {
            window._reportSentimentChart.setOption({ title: { text: '暂无问句情绪样本', left: 'center', top: 'center' }, series: [] }); return;
        }

        var dates = trend.map(function(d) { return d.date; });
        var positive = trend.map(function(d) { return d.positive || 0; });
        var neutral = trend.map(function(d) { return d.neutral || 0; });
        var negative = trend.map(function(d) { return d.negative || 0; });
        var unclassified = trend.map(function(d) { return d.unclassified || 0; });

        window._reportSentimentChart.setOption({
            tooltip: { trigger: 'axis' },
            legend: { data: ['正向问句', '中性问句', '负向问句', '未分类'], bottom: 0 },
            grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
            xAxis: { type: 'category', data: dates },
            yAxis: { type: 'value' },
            series: [
                { name: '正向问句', type: 'line', data: positive, itemStyle: { color: '#4caf50' } },
                { name: '中性问句', type: 'line', data: neutral, itemStyle: { color: '#ff9800' } },
                { name: '负向问句', type: 'line', data: negative, itemStyle: { color: '#f44336' } },
                { name: '未分类', type: 'line', data: unclassified, itemStyle: { color: '#87958b' } }
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
