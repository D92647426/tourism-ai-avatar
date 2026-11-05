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
    var requestStatus = S('chatRequestStatus');
    var cancelRequestBtn = S('chatCancelBtn');
    var retryRequestBtn = S('chatRetryBtn');

    var allSpots = [], isChatOpen = false, pendingChats = 0;
    var conversationId = null;
    var selectedSpot = null, resettingConversation = false;
    var pendingSpot = null, contextReady = false, contextGeneration = 0;
    var tourChatActive = false, tourNeedsSelection = false;
    var chatContext = S('chatContext');
    var narrationSelect = S('chatNarrationMode'), narrationHint = S('chatNarrationHint');
    var narrationMode = 'standard';
    var NARRATION_LABELS = {standard:'标准讲解',family:'亲子讲解',brief:'精简讲解'};
    var NARRATION_HINTS = {standard:'自然介绍，适合第一次了解景点。',family:'用容易理解的短句，邀请孩子一起观察。',brief:'先说重点，适合边走边听。'};
    var hasStartedChat = false;
    var api = window.AuthGuard.apiFetch;
    // 从登录信息读取（localStorage 只作显示缓存，真实身份以 /api/auth/me 为准）
    var speechGeneration = 0;
    var voiceSettings = window.GuideVoiceSettings.normalize(null);
    var speech = null, speechSendTimer = null, focusTimer = null, expressionTimer = null;
    var activeAudioCard = null, activeAudioPart = -1;
    var currentUserId = localStorage.getItem('userId') || '';
    var currentInterest = localStorage.getItem('interest') || '';

    // ===== 景点 =====
    function loadSpots() {
        var restoreGeneration = contextGeneration;
        fetch('/api/spots').then(function(r) { return r.json(); }).then(function(d) {
            allSpots = d; renderSpots(d);
            if (window.GuideDirectorPage) window.GuideDirectorPage.mount(window, d);
            if (restoreGeneration !== contextGeneration) return;
            return api('/api/chat/context').then(function(r) {
                if (!r.ok) throw new Error('context ' + r.status);
                return r.json();
            }).then(function(snapshot) {
                if (restoreGeneration !== contextGeneration) return;
                conversationId = snapshot.conversationId || null;
                narrationMode = normalizeNarration(snapshot.narrationMode);
                selectedSpot = allSpots.find(function(spot) { return spot.id === snapshot.spotId; }) || null;
                contextReady = true; renderChatContext(); renderNarration();
            }).catch(function() {
                if (restoreGeneration === contextGeneration) chatContext.textContent = '会话状态未同步，请点击“新对话”后提问。';
            });
        }).catch(function() {
            if (S('directorStatus')) S('directorStatus').textContent = '景点读取失败，请刷新页面后重试。';
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
            var card = document.createElement('button'); card.type = 'button';
            card.className = 'spot-card';
            var index = document.createElement('span'); index.className='spot-index'; index.textContent=String(i+1).padStart(2,'0');card.appendChild(index);
            var body=document.createElement('span');body.className='spot-card-body';
            var name=document.createElement('strong');name.className='spot-card-name';name.textContent=s.name;body.appendChild(name);
            var brief=document.createElement('span');brief.className='spot-card-brief';brief.textContent=s.brief;body.appendChild(brief);card.appendChild(body);
            var category=document.createElement('span');category.className='spot-card-category';category.textContent=s.category || '景点';card.appendChild(category);
            var more=document.createElement('span');more.className='spot-card-more';more.textContent='查看详情 ↗';card.appendChild(more);
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
        // REQ-040: explicit selection only; the next user submission carries the validated API spotId.
        var ask = document.createElement('button');
        ask.type = 'button'; ask.className = 'detail-ask';
        ask.textContent = '问问 AI 导游';
        ask.addEventListener('click', function(e) {
            e.stopPropagation();
            if (pendingChats || resettingConversation || !contextReady) {
                ask.textContent = '请等待当前请求结束，再选择景点';
                return;
            }
            if (chatInput.value.trim()) { ask.textContent='聊天框里有草稿，请先发送或清空再选择景点'; return; }
            chatRequest.reset();
            tourChatActive=false; tourNeedsSelection=false;
            if(window.GuideTour)window.GuideTour.clearSelection();
            selectedSpot = s;
            pendingSpot = s;
            renderChatContext(); closeDetail(); openChat();
        });
        modalBody.appendChild(ask);
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
            fitLive2D(app, model);
            live2dReady = true;
            window._live2dModel = model;
            window._live2dApp = app;
            // 探测 model 的真实结构和口型参数
            var im = model.internalModel;
            var cm = im && im.coreModel;
            var pm = cm || im; // 真正能调 setParamFloat 的对象
            window._paramTarget = pm;
            // Apply after idle motions/expressions, immediately before rendering.
            // The model may finish loading during an already-started utterance.
            if (im && typeof im.on === 'function') im.on('beforeModelUpdate', function() {
                if (pm && typeof pm.setParamFloat === 'function') {
                    pm.setParamFloat(window._mouthParam || 'PARAM_MOUTH_OPEN_Y', window._mouthSpeaking ? window._mouthCurrent || 0 : 0, 1);
                }
            });
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
            expressionTimer = setTimeout(function() { expressionTimer = null; try { model.expression('f01'); } catch(e) {} }, 2000);
            if (speech && speech.getState().status === 'speaking') startMouthAnimation();
        }).catch(function(e) {
            console.error('Live2D load fail:', e);
            drawFallback();
        });
    }

    /** REQ-032: fit the existing model to its actual stage, including a compact phone dock.
     * Inputs: current PIXI app/model; output: no value; does not reload assets.
     * Browser/PIXI errors follow the existing model initialization error path.
     * Change scale/position here; see docs/exploration_guide.md, page verification.
     */
    function fitLive2D(app, model) {
        var rect = live2dStage.getBoundingClientRect();
        var width = Math.max(1, Math.floor(rect.width)), height = Math.max(1, Math.floor(rect.height));
        app.renderer.resize(width, height);
        var scale = Math.max(0.16 * Math.min(width / 380, height / 500), 0.025);
        model.scale.set(scale * 12 / 16, scale);
        model.anchor.set(0.5, 0.12);
        model.x = width / 2;
        model.y = height * (width < 200 ? 0.48 : 0.44);
    }
    if (typeof window.addEventListener === 'function') window.addEventListener('resize', function() {
        if (live2dReady && window._live2dApp && window._live2dModel) fitLive2D(window._live2dApp, window._live2dModel);
    });

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
    // REQ-040: render local selection/server snapshot as text; no requests. See docs/spot_chat_entry.md#L3.
    function renderChatContext() {
        if(tourNeedsSelection){chatContext.textContent='方案已更新，请重新选讲解站；原草稿已保留，也可开始新对话。';return;}
        chatContext.textContent = selectedSpot ? '当前景点：' + selectedSpot.name + '（下次提问时使用）' : '当前：通用导览';
        var tour=window.GuideTour&&window.GuideTour.snapshot();
        if(tour&&tour.current&&selectedSpot&&tour.current.id===selectedSpot.id)chatContext.textContent+='；'+(tour.next?'下一站：'+tour.next.name:'方案最后一站');
    }
    /** REQ-046: map only allowlisted modes to controls; no storage/network.
     * Unknown/missing values use standard. Change labels with docs/narration_design.md. */
    function normalizeNarration(value) {
        return typeof value === 'string' && Object.prototype.hasOwnProperty.call(NARRATION_LABELS,value) ? value : 'standard';
    }
    function renderNarration() {
        narrationSelect.value = narrationMode;
        narrationSelect.disabled = !contextReady || !!pendingChats || resettingConversation;
        narrationHint.textContent = '下次提问使用' + NARRATION_LABELS[narrationMode] + '。' + NARRATION_HINTS[narrationMode];
    }
    narrationSelect.addEventListener('change',function() {
        if (!contextReady || pendingChats || resettingConversation) { renderNarration(); return; }
        narrationMode = normalizeNarration(narrationSelect.value);
        chatRequest.reset(); // A retry must never replay a request with the previous mode.
        speechGeneration++; stopTts(); stopListen(); renderNarration();
    });
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
        if (focusTimer !== null) clearTimeout(focusTimer);
        focusTimer = setTimeout(function() { focusTimer = null; if (isChatOpen) chatInput.focus(); }, 300);
    }
    function closeChat() {
        speechGeneration++;
        if (speechSendTimer !== null) { clearTimeout(speechSendTimer); speechSendTimer = null; }
        if (focusTimer !== null) { clearTimeout(focusTimer); focusTimer = null; }
        stopListen();
        chatRequest.cancel();
        isChatOpen = false;
        chatPanelOverlay.classList.remove('active');
        chatFab.style.display = 'flex';
        stopTts();
    }

    // ===== 发送消息 =====
    chatNewBtn.addEventListener('click', function() {
        if (pendingChats || chatNewBtn.disabled) return;
        resettingConversation = true;
        contextGeneration++; contextReady = false;
        renderNarration();
        chatNewBtn.disabled = true;
        api('/api/chat/new', {method:'POST'}).then(function(r) {
            if (!r.ok) throw new Error('new conversation ' + r.status);
            return r.json();
        }).then(function(data) {
            chatRequest.reset();
            conversationId = data.conversationId;
            narrationMode = normalizeNarration(data.narrationMode);
            tourChatActive=false;tourNeedsSelection=false;
            if(window.GuideTour)window.GuideTour.clearSelection();
            selectedSpot = null; pendingSpot = null; contextReady = true; renderChatContext();
            stopTts();
            chatMessages.innerHTML = '';
            addMsg('bot', '新对话已开始。您可以继续提问。');
        }).catch(function() {
            chatContext.textContent = '新对话尚未确认，请重试“新对话”后提问。';
            addMsg('bot', '暂时无法开始新对话，请重试。');
        })
          .then(function() { resettingConversation = false; chatNewBtn.disabled = false; renderNarration(); });
    });
    // REQ-031: all entry points share one request lifecycle.
    var chatRequest = window.GuideChatRequest.create({
        requireCorrectionOn400: true,
        timeoutMs: 30000,
        request: function(body, signal) {
            var transport = window.AuthGuard ? window.AuthGuard.apiFetch : window.fetch.bind(window);
            return transport('/api/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body), signal: signal
            });
        },
        onStart: function(body, isRetry) {
            hasStartedChat = true;
            speechGeneration++;
            stopTts();
            stopListen();
            if (!isRetry) { addMsg('user', body.message); chatInput.value = ''; }
        },
        onState: function(state) {
            var busy = state.status === 'pending';
            pendingChats = busy ? 1 : 0; chatNewBtn.disabled = busy || resettingConversation;
            renderNarration();
            chatSendBtn.disabled = busy;
            voiceBtn.disabled = busy;
            quickActions.querySelectorAll('button').forEach(function(button) { button.disabled = busy; });
            cancelRequestBtn.hidden = !busy;
            retryRequestBtn.hidden = !state.canRetry;
            retryRequestBtn.disabled = busy;
            chatMessages.setAttribute('aria-busy', busy ? 'true' : 'false');
            if (busy) showTyping(); else removeTyping();
            var messages = {
                expired: '对话已过期，请点“新对话”继续。',
                timeout: '等待超过 30 秒，可重试上一个问题。',
                cancelled: '已取消等待，可重试上一个问题。',
                http: '服务暂时无法回答，请稍后重试。',
                network: '网络请求失败，请检查连接后重试。',
                'invalid-response': '收到的回答格式有误，请重试。',
                'invalid-request': '问题或景点信息无效，请修改问题，或刷新页面后重新选择讲解站。'
            };
            if (state.reason === 'expired') addMsg('bot', messages.expired);
            requestStatus.textContent = busy ? '正在思考…' : messages[state.reason] || '';
            if (speech) {
                speech.setActivity(busy ? 'thinking' : 'idle');
                if (state.status === 'failed') renderAvatarState({ status: 'error', message: messages[state.reason] });
            }
        },
        onSuccess: function(d) {
            conversationId = d.conversationId || conversationId; pendingSpot = null;
            narrationMode = normalizeNarration(d.narrationMode || narrationMode); renderNarration();
            selectedSpot = allSpots.find(function(spot) { return spot.id === d.spotId; }) || null; renderChatContext();
            if(window.GuideTour){
                window.GuideTour.syncSpot(d.spotId);
                if(!window.GuideTour.snapshot().current)tourChatActive=false;
            }
            var answer=addMsg('bot', d.reply, NARRATION_LABELS[narrationMode] + (d.fallback ? ' · 本地资料' : ''));
            if(window.GuideChatReferences)window.GuideChatReferences.append(document,answer,d);
            if(window.GuideChatFollowups)window.GuideChatFollowups.append(document,answer,selectedSpot,prepareFollowup);
            var audioCard = window.GuideAudioCard ? window.GuideAudioCard.append(document, answer, d.reply, {play: replayAnswer, stop: stopAnswer}) : null;
            chatMessages.scrollTop=chatMessages.scrollHeight;
            if (Array.isArray(d.recommendedRoutes) && d.recommendedRoutes.length) {
                var div = document.createElement('div'); div.className = 'chat-msg bot';
                var h = '<div class="msg-bubble"><div class="route-card"><div class="route-title">🗺️ 推荐路线</div>';
                d.recommendedRoutes.forEach(function(r) { h += '<div class="route-path">📍 ' + esc(String(r)) + '</div>'; });
                h += '</div></div>'; div.innerHTML = h; chatMessages.appendChild(div);
            }
            speak(d.reply, audioCard, -1);
        }
    });

    cancelRequestBtn.addEventListener('click', function() { chatRequest.cancel(); });
    retryRequestBtn.addEventListener('click', function() { if (!resettingConversation && contextReady) chatRequest.retry(); });

    /** REQ-032: prepare an explicit, editable exploration question without sending.
     * Input: nonempty question string (max 5000 chars), optional context.spotId from loaded spots;
     * output: acceptance/reason. Explicit context selects the pending place without sending.
     * REQ-047: context.tour marks itinerary-origin drafts for plan invalidation; it is not sent to the server.
     * Busy requests and existing drafts are preserved; no exceptions are expected.
     * Change handoff policy here; see docs/exploration_design.md, acceptance 5.
     */
    window.GuideChatDraft = function(text, context) {
        if (typeof text !== 'string' || !text.trim() || text.length > 5000) return { accepted: false, reason: '问题内容无效或过长，请精简后重试。' };
        if (!contextReady) return {accepted:false,reason:'会话状态尚未同步，请稍后重试，或先在聊天中点击“新对话”。'};
        if(tourNeedsSelection&&!(context&&Number.isSafeInteger(context.spotId)&&allSpots.some(function(spot){return spot.id===context.spotId;})))return {accepted:false,reason:'方案已更新，请先重新选择讲解站，或点击“新对话”；未发送草稿会保留。'};
        if (chatRequest.isPending() || resettingConversation) return { accepted: false, reason: '导游还在回答上一个问题，请等回答结束或先取消等待。' };
        if (chatInput.value.trim()) return { accepted: false, reason: '聊天框里还有草稿，请先发送或清空，再准备新的问题。' };
        if (context && context.spotId) {
            var spot=allSpots.find(function(item){return item.id===context.spotId;});
            if(!spot)return {accepted:false,reason:'景点信息尚未加载，请稍后重试。'};
            chatRequest.reset();selectedSpot=spot;pendingSpot=spot;renderChatContext();
        } else { pendingSpot=null; }
        tourChatActive=!!(context&&context.tour&&context.spotId);tourNeedsSelection=false;
        if(!tourChatActive&&window.GuideTour)window.GuideTour.clearSelection();
        speechGeneration++;
        stopTts();
        stopListen();
        chatInput.value = text;
        openChat();
        chatInput.focus();
        return { accepted: true };
    };

    /** REQ-049: explicitly prepare a historical answer's station-bound question.
     * Input text/id come from the validated card snapshot. Returns draft acceptance.
     * Existing guards handle refusal without changing state; same tour stop keeps relay.
     * No network or mode change. See docs/followups_design.md for template policy.
     */
    function prepareFollowup(text, spotId) {
        var tour = window.GuideTour && window.GuideTour.snapshot();
        return window.GuideChatDraft(text, {spotId: spotId, tour: !!(tour && tour.current && tour.current.id === spotId)});
    }

    function sendMessage() {
        if (chatRequest.isPending() || resettingConversation || !contextReady) return;
        if(tourNeedsSelection){requestStatus.textContent='方案已更新。原草稿已保留，请清空后重新选站，或点“新对话”继续。';return;}
        var text = chatInput.value.trim(); if (!text) return;
        var body = { message: text, conversationId: conversationId, narrationMode:narrationMode };
        if (pendingSpot) body.spotId = pendingSpot.id;
        if (currentInterest) body.interest = currentInterest;
        chatRequest.send(body);
    }

    function showTyping() {
        removeTyping();
        var d = document.createElement('div'); d.className = 'chat-msg bot typing'; d.id = 'typingIndicator';
        d.innerHTML = '<div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
        chatMessages.appendChild(d); chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    function removeTyping() { var e = S('typingIndicator'); if (e) e.remove(); }
    function addMsg(type, text, caption) {
        var d = document.createElement('div'); d.className = 'chat-msg ' + type;
        d.innerHTML = '<div class="msg-bubble">' + (caption ? '<div class="narration-caption">' + esc(caption) + '</div>' : '') + esc(text) + '</div>';
        chatMessages.appendChild(d); chatMessages.scrollTop = chatMessages.scrollHeight;
        return d;
    }
    function esc(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    // ===== REQ-036: real speech lifecycle; docs/speech_lifecycle.md =====
    var mouthTargetTimer = null, mouthLerpRaf = null;
    var stateLabels = {
        idle: '待机 · 点击开始对话', listening: '正在聆听…', thinking: '正在思考…',
        queued: '正在准备声音…', speaking: '正在讲解', paused: '播报已暂停', error: '暂时无法完成'
    };

    /** REQ-036: show actual activity in both avatar and chat; text survives errors.
     * Input is a lifecycle snapshot; textContent prevents engine messages becoming markup.
     * Change wording here; speech owns timers and stale-callback rejection.
     */
    function renderAvatarState(state) {
        if (activeAudioCard) {
            activeAudioCard.render(state, activeAudioPart);
            if (['queued', 'speaking', 'paused'].indexOf(state.status) === -1) activeAudioCard = null;
        }
        var text = state.message || stateLabels[state.status] || stateLabels.idle;
        [S('avatarState'), S('avatarChatState')].forEach(function(node) {
            if (node) { node.textContent = text; node.dataset.state = state.status; }
        });
        if (stopSpeakBtn) stopSpeakBtn.disabled = ['queued', 'speaking', 'paused'].indexOf(state.status) === -1;
    }

    speech = window.GuideSpeech.create({
        getSettings: function() { return Object.assign({},voiceSettings); },
        selectVoice: function(voices, settings) {
            var choice = window.GuideVoiceSettings.choose(settings || voiceSettings, voices);
            S('speechSettingsStatus').textContent = choice.notice + (window.AndroidSpeech ? ' Android 原生桥接不支持这些参数，使用浏览器语音。' : '');
            return choice.voice;
        },
        synthesis: window.speechSynthesis,
        Utterance: window.SpeechSynthesisUtterance,
        nativeBridge: window.AndroidSpeech,
        onChange: renderAvatarState,
        onMouth: function(active) { if (active) startMouthAnimation(); else stopMouthAnimation(); }
    });
    renderAvatarState(speech.getState());
    window.onTtsReady = function() {}; // readiness is queried for each utterance
    window.onTtsStart = function(id) { speech.nativeEvent('start', id); };
    window.onTtsEnd = function(id) { speech.nativeEvent('end', id); };
    window.onTtsError = function(error, id) { speech.nativeEvent('error', id, error); };
    window.onTtsStop = function(id) { speech.nativeEvent('stop', id); };

    /** REQ-036/051: normalize displayed answer markup for device speech, without I/O. */
    function speechText(text) {
        return text
            .replace(/【.*?】/g, '').replace(/https?:\/\/\S+/g, '')
            .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
            .replace(/__(.+?)__/g, '$1').replace(/_(.+?)_/g, '$1')
            .replace(/#{1,6}\s?/g, '').replace(/`(.+?)`/g, '$1')
            .replace(/^[-*+]\s+/gm, '').replace(/^\d+[.、]\s*/gm, '').trim();
    }

    /** REQ-036/051: submit readable text; only a real start event opens the mouth.
     * Returns false for empty speech text before stopping an existing task.
     * Unavailable voices remain an explicit lifecycle error. See segmented_audio_design.md.
     */
    function speak(text, audioCard, part) {
        var clean = speechText(text);
        if (!clean) return false;
        speech.setActivity('idle');
        activeAudioCard = audioCard || null; activeAudioPart = part == null ? -1 : part;
        return speech.speak(clean);
    }

    /** REQ-051: play an immutable answer/paragraph using current device voice settings.
     * Returns accepted/reason. Busy/unsynced refusal preserves current speech and draft.
     * Accepted replay cancels pending recognition sends, changes no chat/tour state.
     * No HTTP. See docs/segmented_audio_design.md and TEST-051.
     */
    function replayAnswer(text, card, part) {
        if (!contextReady || pendingChats || resettingConversation) return {accepted: false, reason: '请等当前提问或会话同步结束，再重听讲解。'};
        if (!speechText(text)) return {accepted: false, reason: '这一段没有可播报正文，请选择其他段落或阅读全文。'};
        speechGeneration++;
        if (speechSendTimer !== null) { clearTimeout(speechSendTimer); speechSendTimer = null; }
        stopListen();
        return speak(text, card, part) ? {accepted: true} : {accepted: false, reason: '播报尚未就绪，请稍后重试或阅读全文。'};
    }
    function stopAnswer(card) {
        if (activeAudioCard === card) stopTts();
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
                // 随机近乎闭合；仅表现视觉节奏，不对应任何音素
                window._mouthTarget = 0.01 + Math.random() * 0.06;
            } else if (r < 0.38) {
                // 23%：微张
                window._mouthTarget = 0.1 + Math.random() * 0.2;
            } else if (r < 0.82) {
                // 44%：正常说话张开
                window._mouthTarget = 0.3 + Math.random() * 0.35;
            } else {
                // 随机张大；并非元音识别
                window._mouthTarget = 0.55 + Math.random() * 0.4;
            }
            // 可变间隔60~180ms，非音素驱动的口型视觉节奏
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

    /** REQ-036: idempotent explicit stop, including voice-loading/paused tasks. */
    function stopTts() {
        if (speech) {
            speech.setActivity('idle');
            // Request/recognition errors are displayed by this adapter, so an
            // unchanged controller state must still clear the displayed error.
            renderAvatarState(speech.getState());
        }
        stopMouthAnimation();
    }

    function resetMouth() {
        var p = window._paramTarget;
        if (p && window._mouthParam && typeof p.setParamFloat === 'function') {
            try { p.setParamFloat(window._mouthParam, 0, 1); } catch(e) {}
        }
    }

    // REQ-038: labels/theme may load late; welcome cannot rewrite started chat.
    var displayConfig = window.GuideDisplayConfig.load({ document: document,
        fetch: window.fetch.bind(window), onConfig: function(raw) {
            voiceSettings = window.GuideVoiceSettings.normalize(raw);
            S('speechSettingsStatus').textContent = '语音设置已加载：语速 '+voiceSettings.speechRate+'，音量 '+voiceSettings.volume+'。'+(window.AndroidSpeech ? ' Android 原生桥接不支持这些参数，使用浏览器语音。' : '');
        }, canUpdateWelcome: function() { return !hasStartedChat; } });
    window.addEventListener('pagehide', function() { displayConfig.stop(); });

    // ===== 语音输入（优先原生 Android，兜底 Web Speech API） =====
    var recognition = null, listening = false, nativeSpeechRequested = false, webSpeechRequested = false;

    // A delayed recognition result must not send an edited draft or reopen a closed request.
    function scheduleSpeechSend(text, delay) {
        var generation = ++speechGeneration;
        if (speechSendTimer !== null) clearTimeout(speechSendTimer);
        speechSendTimer = setTimeout(function() {
            speechSendTimer = null;
            if (generation === speechGeneration && !chatRequest.isPending() && chatInput.value === text) sendMessage();
        }, delay);
    }

    // Android 原生语音回调（由 APK 的 AndroidSpeech 桥调用）
    window.onSpeechStart = function() {
        if (!nativeSpeechRequested || chatRequest.isPending()) return;
        listening = true;
        speech.setActivity('listening');
        voiceBtn.classList.add('listening');
        voiceBtn.textContent = '🔴';
        voiceStatus.textContent = '正在聆听...';
        voiceStatus.classList.add('listening');
    };
    window.onSpeechPartial = function(text) {
        if (!listening || chatRequest.isPending()) return;
        chatInput.value = text;
    };
    window.onSpeechResult = function(text) {
        if (!listening || chatRequest.isPending()) return;
        chatInput.value = text;
        stopListen();
        if (text.trim()) scheduleSpeechSend(text, 200);
    };
    window.onSpeechError = function(err) {
        if (!nativeSpeechRequested && !listening) return;
        console.log('原生语音错误: ' + err);
        var message = err === 'permission-denied' ? '请在设置中允许麦克风权限' :
            err === 'no-speech' ? '未检测到语音，请重试' : err === 'network' ? '语音识别服务不可用' : '语音识别出错';
        recognitionError(message);
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
        recognition.onstart = function() {
            if (!webSpeechRequested || chatRequest.isPending()) return;
            listening = true;
            speech.setActivity('listening');
            voiceBtn.classList.add('listening');
            voiceBtn.textContent = '🔴';
            voiceStatus.textContent = '正在聆听…';
        };

        recognition.onresult = function(e) {
            if (!listening || chatRequest.isPending()) return;
            var t = '';
            for (var i = e.resultIndex; i < e.results.length; i++) {
                t += e.results[i][0].transcript;
            }
            chatInput.value = t;
            // 如果是最终结果，自动发送
            if (e.results[e.results.length - 1].isFinal && t.trim()) {
                stopListen();
                scheduleSpeechSend(t, 200);
            }
        };

        recognition.onerror = function(e) {
            if (!webSpeechRequested && !listening) return;
            console.log('语音错误: ' + e.error);
            if (e.error === 'aborted') { stopListen(); return; }
            var message = e.error === 'not-allowed' ? '请在浏览器设置中允许麦克风权限' :
                e.error === 'network' || e.error === 'service-not-allowed' ? '语音识别网络不通，请稍后重试' :
                e.error === 'no-speech' ? '未检测到语音，请重试' : '语音识别出错';
            recognitionError(message);
        };

        recognition.onend = function() {
            if (webSpeechRequested || listening) stopListen();
        };

        console.log('语音：初始化完成');
    }

    voiceBtn.addEventListener('click', function() {
        if (chatRequest.isPending()) return;
        if (hasNativeSpeech()) {
            // Android 原生语音
            if (listening || nativeSpeechRequested) {
                stopListen();
                if (chatInput.value.trim()) scheduleSpeechSend(chatInput.value, 300);
            } else {
                speechGeneration++;
                stopTts();
                nativeSpeechRequested = true;
                voiceStatus.textContent = '正在申请语音输入…';
                try { window.AndroidSpeech.startListening(); }
                catch(e) { recognitionError('语音输入启动失败，请使用文字提问'); }
            }
            return;
        }
        // Web Speech API 兜底
        if (!recognition) { recognitionError('当前浏览器不支持语音输入，请使用文字提问'); return; }
        if (listening || webSpeechRequested) { stopListen(); if (chatInput.value.trim()) scheduleSpeechSend(chatInput.value, 300); }
        else { startListen(); }
    });

    function startListen() {
        // Web Speech API 专用
        speechGeneration++;
        stopTts();
        webSpeechRequested = true;
        voiceStatus.textContent = '正在申请语音输入…';
        try { recognition.start(); console.log('语音：开始聆听'); }
        catch(e) { recognitionError('语音启动失败，请使用文字提问'); }
    }

    function stopListen() {
        var wasListening = listening || nativeSpeechRequested || webSpeechRequested;
        listening = false;
        nativeSpeechRequested = false;
        webSpeechRequested = false;
        voiceBtn.classList.remove('listening');
        voiceBtn.textContent = '🎤';
        voiceStatus.textContent = '';
        voiceStatus.classList.remove('listening');
        if (speech && speech.getState().status === 'listening') speech.setActivity('idle');
        // Android 原生
        if (wasListening && hasNativeSpeech()) try { window.AndroidSpeech.stopListening(); } catch(e) {}
        // Web Speech API
        try { if (wasListening && recognition) recognition.stop(); } catch(e) {}
    }

    /** REQ-036: retain actionable recognition errors without implying listening. */
    function recognitionError(message) {
        stopListen();
        speech.setActivity('idle');
        voiceStatus.textContent = message;
        renderAvatarState({ status: 'error', message: message });
    }

    /** REQ-036: cancel background work, including delayed voice sends and focus.
     * Keep the controller reusable for back/forward-cache restores.
     */
    function silencePage() {
        closeChat();
        if (expressionTimer !== null) { clearTimeout(expressionTimer); expressionTimer = null; }
    }
    window.addEventListener('pagehide', silencePage);
    document.addEventListener('visibilitychange', function() { if (document.hidden) silencePage(); });

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
    quickActions.addEventListener('click', function(e) {
        if(chatRequest.isPending()||resettingConversation||!contextReady)return;
        var b=e.target.closest('.quick-btn');if(!b)return;
        if(tourNeedsSelection){sendMessage();return;}
        if(chatInput.value.trim()){requestStatus.textContent='聊天框里有草稿，请先发送或清空，再选择快捷问题。';return;}
        chatInput.value=b.dataset.msg;sendMessage();
    });

    /** REQ-047: invalidate only itinerary-origin chat when its plan changes.
     * Preserve draft, cancel late callbacks/retries, block stale context until explicit selection/reset.
     * Server work already received cannot be undone. docs/journey_references_design.md. */
    function invalidateTour(){
        if(!tourChatActive)return;
        tourNeedsSelection=true;pendingSpot=null;
        chatRequest.reset();speechGeneration++;stopTts();stopListen();renderChatContext();
        requestStatus.textContent='游览方案已改变，请重新选择讲解站。草稿已保留。';
    }
    if(window.GuideJourneyPage&&window.GuideJourney)window.GuideTour=window.GuideJourneyPage.mount(window,{invalidate:invalidateTour,changed:renderChatContext});

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
        if (window.GuideExplorationPage) window.GuideExplorationPage.mount(window, user.userId);
    }).catch(function() {
        loadSpots();
        initLive2D();
        initSR();
    });
})();
