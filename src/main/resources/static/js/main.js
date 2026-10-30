// ===== 灵山胜境AI数字人导览系统 =====
(function() {
    'use strict';

    // ===== DOM =====
    var S = function(id) { return document.getElementById(id); };
    var spotsGrid = S('spotsGrid');
    var spotCount = S('spotCount');
    var searchInput = S('searchInput');
    var modalOverlay = S('modalOverlay');
    var modalBody = S('modalBody');
    var modalClose = S('modalClose');
    var live2dStage = S('live2dStage');
    var live2dCanvas = S('live2dMainCanvas');
    var chatFab = S('chatFab');
    var chatPanelOverlay = S('chatPanelOverlay');
    var chatPanelClose = S('chatPanelClose');
    var chatNewBtn = S('chatNewBtn');
    var chatMessages = S('chatMessages');
    var chatInput = S('chatInput');
    var chatSendBtn = S('chatSendBtn');
    var voiceBtn = S('voiceBtn');
    var voiceStatus = S('voiceStatus');
    var stopSpeakBtn = S('stopSpeakBtn');
    var quickActions = S('quickActions');
    var chatHeaderName = S('chatHeaderName');

    var allSpots = [], isChatOpen = false, pendingChats = 0;
    var conversationId = null;
    var api = window.AuthGuard.apiFetch;
    // 从登录信息读取（localStorage 只作显示缓存，真实身份以 /api/auth/me 为准）
    var currentUserId = localStorage.getItem('userId') || '';
    var currentInterest = localStorage.getItem('interest') || '';

    // ===== 景点 =====
    function loadSpots() {
        fetch('/api/spots').then(function(r) { return r.json(); }).then(function(d) {
            allSpots = d; renderSpots(d);
        }).catch(function() {
            spotsGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:60px;color:#999;">景点数据加载中...</p>';
        });
    }

    function renderSpots(spots) {
        spotsGrid.innerHTML = '';
        spotCount.textContent = '共 ' + spots.length + ' 个景点';
        if (spots.length === 0) {
            spotsGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:60px;color:#999;">未找到匹配的景点</p>';
            return;
        }
        spots.forEach(function(s, i) {
            var card = document.createElement('div');
            card.className = 'spot-card';
            card.style.animationDelay = (i * 0.06) + 's';
            card.style.animation = 'cardIn 0.5s ease forwards';
            card.style.opacity = '0';
            card.innerHTML =
                '<div class="spot-card-image">' +
                '<div class="spot-card-image-bg" style="background:' + s.gradient + ';"></div>' +
                '<span class="spot-card-icon">' + (s.icon || '🏞️') + '</span>' +
                '<span class="spot-card-badge">' + s.category + '</span>' +
                '</div>' +
                '<div class="spot-card-body">' +
                '<div class="spot-card-name">' + s.name + '</div>' +
                '<div class="spot-card-brief">' + s.brief + '</div>' +
                '<div class="spot-card-footer"><span>📍 ' + s.address.substring(0, 12) + '...</span><span>查看详情 →</span></div>' +
                '</div>';
            card.addEventListener('click', function() { openDetail(s); });
            spotsGrid.appendChild(card);
        });
    }

    var cs = document.createElement('style');
    cs.textContent = '@keyframes cardIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(cs);

    searchInput.addEventListener('input', function() {
        var kw = this.value.trim();
        renderSpots(kw ? allSpots.filter(function(s) {
            return s.name.indexOf(kw) !== -1 || s.brief.indexOf(kw) !== -1 || s.category.indexOf(kw) !== -1;
        }) : allSpots);
    });

    // ===== 景点详情弹窗 =====
    function openDetail(s) {
        modalBody.innerHTML =
            '<div class="detail-header"><div class="spot-card-image-bg" style="background:' + s.gradient + ';position:absolute;inset:0;"></div><span class="detail-icon">' + (s.icon || '🏞️') + '</span></div>' +
            '<div class="detail-name">' + s.name + '</div><div class="detail-category">' + s.category + '</div>' +
            '<p class="detail-brief">' + s.brief + '</p>' +
            '<div class="detail-section"><h3>📖 历史典故</h3><p>' + s.history + '</p></div>' +
            '<div class="detail-section"><h3>📍 地址</h3><p>' + s.address + '</p></div>' +
            '<div class="detail-section"><h3>🕐 开放时间</h3><p>' + s.openingHours + '</p></div>' +
            '<div class="detail-section"><h3>🎫 门票</h3><p>' + s.ticket + '</p></div>' +
            '<div class="detail-section"><h3>🚌 交通指南</h3><p>' + s.transportation + '</p></div>' +
            '<div class="detail-section"><h3>✨ 亮点推荐</h3><div class="detail-highlights">' + (s.highlights || []).map(function(h) { return '<span class="detail-highlight-tag">' + h + '</span>'; }).join('') + '</div></div>';
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    function closeDetail() { modalOverlay.classList.remove('active'); document.body.style.overflow = ''; }
    modalClose.addEventListener('click', closeDetail);
    modalOverlay.addEventListener('click', function(e) { if (e.target === modalOverlay) closeDetail(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeDetail(); });

    // ===== Live2D 数字人 =====
    var live2dReady = false;

    function initLive2D() {
        // 从舞台 CSS 读取实际尺寸，适配不同屏幕
        var stageRect = live2dStage.getBoundingClientRect();
        var cw = Math.floor(stageRect.width) || 380;
        var ch = Math.floor(stageRect.height) || 500;
        var isMobile = cw < 200; // 小屏手机判定

        live2dCanvas.width = cw;
        live2dCanvas.height = ch;
        live2dCanvas.style.pointerEvents = 'none';

        if (typeof PIXI === 'undefined' || !PIXI.live2d) {
            drawFallback(cw, ch); return;
        }

        PIXI.live2d.config.sound = false;

        var app = new PIXI.Application({
            view: live2dCanvas, width: cw, height: ch,
            transparent: true, backgroundColor: 0x000000, backgroundAlpha: 0,
            antialias: !isMobile, resolution: isMobile ? 1 : (window.devicePixelRatio || 1), autoDensity: true
        });

        PIXI.live2d.Live2DModel.from('/models/haru/haru.model.json').then(function(model) {
            app.stage.addChild(model);
            // 缩放：基准 0.16，按画布等比调整，但不低于 0.10
            var ratio = Math.min(cw / 380, ch / 500);
            var s = Math.max(0.16 * ratio, 0.10);
            model.scale.set(s * 12 / 16, s);
            model.anchor.set(0.5, 0.12);
            model.x = cw / 2;
            model.y = ch * (isMobile ? 0.48 : 0.44);
            live2dReady = true;
            window._live2dModel = model;
            window._live2dApp = app;
            // 探测 model 的真实结构和口型参数
            var im = model.internalModel;
            var cm = im && im.coreModel;
            var pm = cm || im; // 真正能调 setParamFloat 的对象
            window._paramTarget = pm;
            // 列出所有属性
            var keys = Object.keys(pm || {});
            console.log('Live2D就绪, 参数对象:', keys.slice(0,10).join(', '));
            if (pm && pm.parameters) {
                var ids = pm.parameters.ids || [];
                for (var j = 0; j < ids.length; j++) {
                    if (ids[j].toLowerCase().indexOf('mouth') !== -1) window._mouthParam = ids[j];
                }
                console.log('参数列表:', ids.slice(0,10).join(', '));
            }
            if (!window._mouthParam) window._mouthParam = 'PARAM_MOUTH_OPEN_Y';
            console.log('口型参数名:', window._mouthParam, '| 参数对象有setParamFloat?', typeof pm.setParamFloat);
            // 2 秒后微笑
            setTimeout(function() { try { model.expression('f01'); } catch(e) {} }, 2000);
        }).catch(function(e) {
            console.error('Live2D load fail:', e);
            drawFallback();
        });
    }

    function drawFallback(cw, ch) {
        var c = live2dCanvas, ctx = c.getContext('2d');
        if (!ctx) return;
        var cx = (cw || 380) / 2, cy = (ch || 500) * 0.44;
        ctx.fillStyle = '#ffd5a8'; ctx.beginPath(); ctx.arc(cx, cy, 65, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2c1810'; ctx.beginPath(); ctx.arc(cx - 22, cy - 18, 8, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(cx + 22, cy - 18, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c06040'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy + 8, 14, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        ctx.fillStyle = '#2d8f4e'; ctx.beginPath(); ctx.moveTo(cx - 65, cy + 60); ctx.lineTo(cx + 65, cy + 60); ctx.lineTo(cx + 80, cy + 180); ctx.lineTo(cx - 80, cy + 180); ctx.fill();
    }

    // ===== 聊天面板 =====
    live2dStage.addEventListener('click', function(e) { e.stopPropagation(); openChat(); });
    chatFab.addEventListener('click', function(e) { e.stopPropagation(); toggleChat(); });
    chatPanelClose.addEventListener('click', function(e) { e.stopPropagation(); closeChat(); });
    document.addEventListener('click', function(e) {
        if (isChatOpen && !chatPanelOverlay.contains(e.target) &&
            e.target !== chatFab && !chatFab.contains(e.target) &&
            e.target !== live2dStage && !live2dStage.contains(e.target)) { closeChat(); }
    });

    function toggleChat() { isChatOpen ? closeChat() : openChat(); }
    function openChat() {
        isChatOpen = true;
        chatPanelOverlay.classList.add('active');
        chatFab.style.display = 'none';
        setTimeout(function() { chatInput.focus(); }, 300);
    }
    function closeChat() {
        isChatOpen = false;
        chatPanelOverlay.classList.remove('active');
        chatFab.style.display = 'flex';
        stopTts();
    }

    // ===== 发送消息 =====
    chatNewBtn.addEventListener('click', function() {
        if (pendingChats || chatNewBtn.disabled) return;
        chatNewBtn.disabled = true;
        api('/api/chat/new', {method:'POST'}).then(function(r) {
            if (!r.ok) throw new Error('new conversation ' + r.status);
            return r.json();
        }).then(function(data) {
            conversationId = data.conversationId;
            stopTts();
            chatMessages.innerHTML = '';
            addMsg('bot', '新对话已开始。您可以继续提问。');
        }).catch(function() { addMsg('bot', '暂时无法开始新对话，请重试。'); })
          .then(function() { chatNewBtn.disabled = false; });
    });
    function sendMessage() {
        // 立即停止当前所有说话和口型
        stopTts();
        var text = chatInput.value.trim(); if (!text) return;
        pendingChats++; chatNewBtn.disabled = true;
        addMsg('user', text); chatInput.value = ''; showTyping();
        var body = { message: text, conversationId: conversationId };
        if (currentInterest) body.interest = currentInterest;

        api('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function(r) {
            if (r.status === 410) { throw new Error('对话已过期，请点“新对话”继续。'); }
            if (!r.ok) { throw new Error('chat ' + r.status); }
            return r.json();
        }).then(function(d) {
            conversationId = d.conversationId || conversationId;
            removeTyping();
            addMsg('bot', d.reply);
            if (d.recommendedRoutes && d.recommendedRoutes.length) {
                var div = document.createElement('div'); div.className = 'chat-msg bot';
                var h = '<div class="msg-bubble"><div class="route-card"><div class="route-title">🗺️ 推荐路线</div>';
                d.recommendedRoutes.forEach(function(r) { h += '<div class="route-path">📍 ' + r + '</div>'; });
                h += '</div></div>'; div.innerHTML = h; chatMessages.appendChild(div);
            }
            // 播放语音
            speak(d.reply);
        }).catch(function(error) { removeTyping(); addMsg('bot', error && /对话已过期/.test(error.message) ? error.message : '抱歉，我暂时无法回答。'); })
          .then(function() { pendingChats--; chatNewBtn.disabled = pendingChats > 0; });
    }

    function showTyping() {
        var d = document.createElement('div'); d.className = 'chat-msg bot typing'; d.id = 'typingIndicator';
        d.innerHTML = '<div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
        chatMessages.appendChild(d); chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    function removeTyping() { var e = S('typingIndicator'); if (e) e.remove(); }
    function addMsg(type, text) {
        var d = document.createElement('div'); d.className = 'chat-msg ' + type;
        d.innerHTML = '<div class="msg-bubble">' + esc(text) + '</div>';
        chatMessages.appendChild(d); chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    function esc(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    // ===== TTS 语音 + 自然口型动画 =====
    var mouthTargetTimer = null, mouthLerpRaf = null, mouthStopTimer = null;
    var _nativeTtsReady = false;  // Android 原生 TTS 状态

    // Android 原生 TTS 回调
    window.onTtsReady = function(ready) { _nativeTtsReady = ready; console.log('Native TTS ready: ' + ready); };
    window.onTtsStart = function() { console.log('Native TTS speaking'); };
    window.onTtsEnd = function() { };
    window.onTtsError = function(err) { console.log('Native TTS error: ' + err); };

    function hasNativeTts() {
        // 直接查询 Android 侧状态，不依赖异步回调（回调可能在页面加载前就触发过）
        try {
            return typeof window.AndroidSpeech !== 'undefined'
                && window.AndroidSpeech
                && window.AndroidSpeech.isTtsReady()
                && window.AndroidSpeech.isTtsReady() === true;
        } catch(e) { return false; }
    }

    function speak(text) {
        // 1. 先启动口型动画（完全不依赖声音）
        var clean = text
            .replace(/【.*?】/g, '').replace(/https?:\/\/\S+/g, '')
            .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
            .replace(/__(.+?)__/g, '$1').replace(/_(.+?)_/g, '$1')
            .replace(/#{1,6}\s?/g, '').replace(/`(.+?)`/g, '$1')
            .replace(/^[-*+]\s+/gm, '').replace(/^\d+[.、]\s*/gm, '').trim();
        if (!clean) return;

        stopTts();
        startMouthAnimation();
        if (mouthStopTimer) clearTimeout(mouthStopTimer);
        var estDuration = Math.max(Math.ceil(clean.length / 3.5 * 1000), 2000) + 2000;
        mouthStopTimer = setTimeout(function() { stopMouthAnimation(); }, estDuration);

        // 2. 优先使用 Android 原生 TTS
        if (hasNativeTts()) {
            try { window.AndroidSpeech.speak(clean); } catch(e) { console.log('Native TTS call failed'); }
            return;
        }

        // 3. Web Speech API 兜底
        if (!('speechSynthesis' in window)) return;
        try {
            var voices = speechSynthesis.getVoices();
            if (voices.length === 0) return;
            var hasChineseVoice = false;
            for (var i = 0; i < voices.length; i++) {
                if (voices[i].lang.indexOf('zh') !== -1) { hasChineseVoice = true; break; }
            }
            if (!hasChineseVoice) return;

            var u = new SpeechSynthesisUtterance(clean);
            u.lang = 'zh-CN'; u.rate = 1.05; u.pitch = 1.1; u.volume = 1.0;
            for (var j = 0; j < voices.length; j++) {
                if (voices[j].lang.indexOf('zh') !== -1) { u.voice = voices[j]; break; }
            }
            u.onerror = function(e) { console.log('Web TTS error: ' + (e.error || 'unknown')); };
            speechSynthesis.speak(u);
        } catch(e) {
            console.log('Web TTS failed, mouth-only mode');
        }
    }

    function startMouthAnimation() {
        // 已在跑就不重置，避免 onstart 二次触发导致嘴闪回 0
        if (window._mouthSpeaking) return;

        stopMouthAnimation();
        var p = window._paramTarget;
        if (!p || typeof p.setParamFloat !== 'function') return;

        window._mouthSpeaking = true;
        window._mouthCurrent = 0;
        window._mouthTarget = 0;

        // --- 目标值更新循环（随机间隔，模拟真实说话节奏）---
        function updateTarget() {
            if (!window._mouthSpeaking) return;
            var r = Math.random();
            if (r < 0.15) {
                // 15% 概率：近乎闭合（辅音/t/d/b/p/等）
                window._mouthTarget = 0.01 + Math.random() * 0.06;
            } else if (r < 0.38) {
                // 23%：微张
                window._mouthTarget = 0.1 + Math.random() * 0.2;
            } else if (r < 0.82) {
                // 44%：正常说话张开
                window._mouthTarget = 0.3 + Math.random() * 0.35;
            } else {
                // 18%：张大（元音/a/o/e/等）
                window._mouthTarget = 0.55 + Math.random() * 0.4;
            }
            // 可变间隔 60~180ms，模拟不同音素的持续时长
            mouthTargetTimer = setTimeout(updateTarget, 60 + Math.random() * 120);
        }

        // --- 平滑插值循环（60fps 丝滑过渡）---
        function lerpMouth() {
            if (!window._mouthSpeaking) return;
            var cur = window._mouthCurrent;
            var tgt = window._mouthTarget;
            // lerp 因子 0.32：既不太慢（拖沓）也不太快（跳跃）
            var next = cur + (tgt - cur) * 0.32;
            if (Math.abs(next - tgt) < 0.004) next = tgt;
            window._mouthCurrent = next;

            try { p.setParamFloat(window._mouthParam, next, 1); } catch(e) {}
            mouthLerpRaf = requestAnimationFrame(lerpMouth);
        }

        updateTarget();
        lerpMouth();
    }

    function stopMouthAnimation() {
        window._mouthSpeaking = false;
        if (mouthTargetTimer) { clearTimeout(mouthTargetTimer); mouthTargetTimer = null; }
        if (mouthLerpRaf) { cancelAnimationFrame(mouthLerpRaf); mouthLerpRaf = null; }
        resetMouth();
    }

    function stopTts() {
        stopMouthAnimation();
        if (mouthStopTimer) { clearTimeout(mouthStopTimer); mouthStopTimer = null; }
        // 取消所有 TTS 引擎
        if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch(e) {} }
        if (hasNativeTts()) { try { window.AndroidSpeech.stopSpeaking(); } catch(e) {} }
    }

    function resetMouth() {
        var p = window._paramTarget;
        if (p && window._mouthParam && typeof p.setParamFloat === 'function') {
            try { p.setParamFloat(window._mouthParam, 0, 1); } catch(e) {}
        }
    }

    // 加载声线配置（公开只读端点，无需登录；管理端配置接口仍需 ADMIN）
    fetch('/api/digital-human-config').then(function(r) { return r.json(); }).then(function(c) {
        if (c && c.name) {
            var lbl = document.querySelector('.live2d-label');
            if (lbl) lbl.textContent = 'AI导游' + c.name;
            if (chatHeaderName) chatHeaderName.textContent = 'AI导游' + c.name;
        }
    }).catch(function() {});

    // ===== 语音输入（优先原生 Android，兜底 Web Speech API） =====
    var recognition = null, listening = false;

    // Android 原生语音回调（由 APK 的 AndroidSpeech 桥调用）
    window.onSpeechStart = function() {
        listening = true;
        voiceBtn.classList.add('listening');
        voiceBtn.textContent = '🔴';
        voiceStatus.textContent = '正在聆听...';
        voiceStatus.classList.add('listening');
    };
    window.onSpeechPartial = function(text) {
        chatInput.value = text;
    };
    window.onSpeechResult = function(text) {
        chatInput.value = text;
        stopListen();
        if (text.trim()) setTimeout(function() { sendMessage(); }, 200);
    };
    window.onSpeechError = function(err) {
        console.log('原生语音错误: ' + err);
        if (err === 'permission-denied') voiceStatus.textContent = '请在设置中允许麦克风权限';
        else if (err === 'no-speech') voiceStatus.textContent = '未检测到语音，请重试';
        else if (err === 'network') voiceStatus.textContent = '语音识别服务不可用';
        else voiceStatus.textContent = '语音识别出错';
        stopListen();
    };

    function hasNativeSpeech() {
        return typeof window.AndroidSpeech !== 'undefined' && window.AndroidSpeech;
    }

    function initSR() {
        if (hasNativeSpeech()) {
            // 原生 Android 语音可用，展示按钮
            console.log('语音：使用 Android 原生识别');
            return;
        }
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { voiceBtn.style.display = 'none'; console.log('语音：不可用，隐藏按钮'); return; }
        recognition = new SR();
        recognition.lang = 'zh-CN';
        recognition.interimResults = true;
        recognition.continuous = false;  // 识别到一句话后自动停止，避免 onend 无限重启
        recognition.maxAlternatives = 1;

        recognition.onresult = function(e) {
            var t = '';
            for (var i = e.resultIndex; i < e.results.length; i++) {
                t += e.results[i][0].transcript;
            }
            chatInput.value = t;
            // 如果是最终结果，自动发送
            if (e.results[e.results.length - 1].isFinal && t.trim()) {
                stopListen();
                setTimeout(function() { sendMessage(); }, 200);
            }
        };

        recognition.onerror = function(e) {
            console.log('语音错误: ' + e.error);
            if (e.error === 'not-allowed') {
                voiceStatus.textContent = '请在浏览器设置中允许麦克风权限';
            } else if (e.error === 'network' || e.error === 'service-not-allowed') {
                voiceStatus.textContent = '语音识别网络不通（可换 Edge 浏览器试试）';
            } else if (e.error === 'no-speech') {
                voiceStatus.textContent = '未检测到语音，请重试';
            } else if (e.error === 'aborted') {
                // 正常中止，不显示错误
            } else {
                voiceStatus.textContent = '语音识别出错: ' + e.error;
            }
            stopListen();
        };

        recognition.onend = function() {
            if (listening) {
                // continuous=false 时到达停顿会自动 onend，重新开始
                try { recognition.start(); } catch(ex) { stopListen(); }
            }
        };

        console.log('语音：初始化完成');
    }

    voiceBtn.addEventListener('click', function() {
        if (hasNativeSpeech()) {
            // Android 原生语音
            if (listening) {
                window.AndroidSpeech.stopListening();
                stopListen();
                if (chatInput.value.trim()) setTimeout(sendMessage, 300);
            } else {
                window.AndroidSpeech.startListening();
            }
            return;
        }
        // Web Speech API 兜底
        if (!recognition) { voiceStatus.textContent = '当前浏览器不支持语音输入'; return; }
        if (listening) { stopListen(); if (chatInput.value.trim()) setTimeout(sendMessage, 300); }
        else { startListen(); }
    });

    function startListen() {
        // Web Speech API 专用
        listening = true;
        voiceBtn.classList.add('listening');
        voiceBtn.textContent = '🔴';
        voiceStatus.textContent = '正在聆听...';
        voiceStatus.classList.add('listening');
        try { recognition.start(); console.log('语音：开始聆听'); }
        catch(e) { console.log('语音：启动异常', e); voiceStatus.textContent = '语音启动失败'; stopListen(); }
    }

    function stopListen() {
        listening = false;
        voiceBtn.classList.remove('listening');
        voiceBtn.textContent = '🎤';
        setTimeout(function() {
            if (!listening) { voiceStatus.textContent = ''; voiceStatus.classList.remove('listening'); }
        }, 1500);
        // Android 原生
        if (hasNativeSpeech()) try { window.AndroidSpeech.stopListening(); } catch(e) {}
        // Web Speech API
        try { if (recognition) recognition.stop(); } catch(e) {}
    }

    // ===== 停止说话按钮 =====
    if (stopSpeakBtn) {
        stopSpeakBtn.addEventListener('click', function() { stopTts(); });
    }

    // ===== 个人信息弹窗 =====
    var profileOverlay = S('profileOverlay');
    var profileClose = S('profileClose');
    var profileBtn = S('profileBtn');
    var profileUsername = S('profileUsername');
    var profileMsg = S('profileMsg');
    var profileSave = S('profileSave');
    var profileLogout = S('profileLogout');
    var profileInterests = S('profileInterests');
    var headerUsername = S('headerUsername');

    // 显示用户名
    var savedUsername = localStorage.getItem('username') || '';
    if (headerUsername) headerUsername.textContent = savedUsername;

    // 打开弹窗
    profileBtn.addEventListener('click', function() {
        profileUsername.textContent = savedUsername || '未知';
        // 标记当前选中
        var all = profileInterests.querySelectorAll('.interest-btn');
        all.forEach(function(b) { b.classList.remove('selected'); });
        if (currentInterest) {
            all.forEach(function(b) {
                if (b.dataset.interest === currentInterest) b.classList.add('selected');
            });
        }
        profileOverlay.style.display = 'flex';
        profileMsg.textContent = '';
    });

    // 关闭弹窗
    profileClose.addEventListener('click', function() { profileOverlay.style.display = 'none'; });
    profileOverlay.addEventListener('click', function(e) { if (e.target === profileOverlay) profileOverlay.style.display = 'none'; });

    // 选择兴趣
    profileInterests.addEventListener('click', function(e) {
        var b = e.target.closest('.interest-btn');
        if (!b) return;
        var all = profileInterests.querySelectorAll('.interest-btn');
        all.forEach(function(x) { x.classList.remove('selected'); });
        b.classList.add('selected');
    });

    function showProfileMessage(text, isError) {
        profileMsg.textContent = text;
        profileMsg.className = 'form-msg' + (isError ? ' error' : ' success');
    }

    // 保存兴趣：必须等服务端确认成功后才更新本地缓存与提示
    function saveInterest(interest) {
        showProfileMessage('正在保存…', false);
        api('/api/auth/interest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interest: interest })
        }).then(function(res) {
            if (res.status === 401) {
                var error = new Error('登录状态已失效');
                error.status = 401;
                throw error;
            }
            if (!res.ok) { throw new Error('保存失败: HTTP ' + res.status); }
            return res.json();
        }).then(function(data) {
            if (!data || data.success !== true) { throw new Error('保存失败'); }
            currentInterest = interest;
            try { localStorage.setItem('interest', interest); } catch (e) { }
            showProfileMessage('兴趣爱好已更新！', false);
        }).catch(function(error) {
            if (error && error.status === 401) {
                // 会话过期：清掉过期身份缓存，引导重新登录
                window.AuthGuard.clearIdentity();
                window.location.href = '/login.html';
                return;
            }
            // 网络/服务端失败：保留上一次已保存的服务端状态，不写入本地缓存
            showProfileMessage('保存失败，请检查网络后重试', true);
        });
    }

    // 保存
    profileSave.addEventListener('click', function() {
        var selected = profileInterests.querySelector('.interest-btn.selected');
        if (!selected) {
            showProfileMessage('请选择一个兴趣偏好', true);
            return;
        }
        saveInterest(selected.dataset.interest);
    });

    // 退出登录：只有服务端确认退出后才清理缓存并跳转
    profileLogout.addEventListener('click', function() {
        profileLogout.disabled = true;
        window.AuthGuard.logout().then(function() {
            window.location.href = '/login.html';
        }).catch(function() {
            profileLogout.disabled = false;
            showProfileMessage('退出失败，请检查网络后重试', true);
        });
    });

    // ===== 快捷按钮 =====
    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    quickActions.addEventListener('click', function(e) { var b = e.target.closest('.quick-btn'); if (!b) return; chatInput.value = b.dataset.msg; sendMessage(); });

    // ===== 启动：先向服务端确认会话身份，localStorage 仅作显示缓存 =====
    window.AuthGuard.me().then(function(user) {
        if (!user) {
            window.location.href = '/login.html';
            return;
        }
        currentUserId = user.userId || '';
        // 以服务端返回为准：新账号没有兴趣时清掉上一个账号留下的缓存
        currentInterest = user.interest || '';
        try {
            localStorage.setItem('userId', currentUserId);
            localStorage.setItem('username', user.username || '');
            if (currentInterest) {
                localStorage.setItem('interest', currentInterest);
            } else {
                localStorage.removeItem('interest');
            }
        } catch (e) { }
        savedUsername = user.username || '';
        if (headerUsername) headerUsername.textContent = savedUsername;
        loadSpots();
        initLive2D();
        initSR();
    }).catch(function() {
        loadSpots();
        initLive2D();
        initSR();
    });
    if ('speechSynthesis' in window) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function() { speechSynthesis.getVoices(); }; }
})();
