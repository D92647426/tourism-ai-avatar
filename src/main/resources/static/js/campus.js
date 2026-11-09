/* REQ-054–059: sole owner of the campus conversation, request attempts and page lifecycle. */
(function () {
    'use strict';
    var byId = function (id) { return document.getElementById(id); };
    var context = null, catalog = null, scene = null, environment = null, voice = null;
    var active = null, failed = null, barrier = null, generation = 0, serial = 0, ready = false, disposed = false;
    var draftRevision = 0, lastSpeech = '嗨，我是燕小北。今天在校园里，想做些什么？';
    var welcomeTimer = null;
    var nonce = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
    async function api(path, body, signal) {
        var opts = body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
        if (signal) opts.signal = signal;
        var response = await AuthGuard.apiFetch(path,opts);
        if (!response.ok) {
            var error = new Error('request-failed'); error.status = response.status;
            try { error.code = (await response.json()).code; } catch (_) {}
            throw error;
        }
        return response.json();
    }
    function requestBusy() { return !!active || !!barrier || !ready || disposed; }
    function update() {
        byId('sendMessage').disabled = requestBusy();
        byId('cancelRequest').hidden = !active;
        byId('retryRequest').hidden = !failed || !!active || !!barrier || !ready;
        byId('voiceInput').disabled = requestBusy();
        byId('replaySpeech').disabled = !!active || !!barrier;
        byId('newConversation').disabled = !!barrier || !ready && !active;
        if (environment) environment.update();
    }
    function adopt(snapshot) {
        context = Object.assign({},snapshot); ready = true;
        if (environment) environment.setContext(context);
    }
    function choices(items) {
        var target = byId('campusChoices'); target.replaceChildren();
        var list = (items || []).filter(function (item) { return item && ['ask','followup','custom'].includes(item.kind); });
        var asks = list.filter(function (item) { return item.kind === 'ask'; }).slice(0,4);
        var follow = list.find(function (item) { return item.kind === 'followup'; }) || {label:'继续追问',message:'我还想了解更多',kind:'followup'};
        var custom = list.find(function (item) { return item.kind === 'custom'; }) || {label:'自定义',kind:'custom'};
        if (asks.length < 2) asks.push({label:'查看校园地点',message:'我想了解校园地点',kind:'ask'});
        if (asks.length < 2) asks.push({label:'了解校园办事',message:'我想了解校园办事',kind:'ask'});
        asks.concat([follow,custom]).slice(0,6).forEach(function (item) {
            var button = CampusScene.element('button',item.label); button.type = 'button'; button.dataset.kind = item.kind;
            button.addEventListener('click',function () {
                if (requestBusy()) return;
                if (item.kind === 'custom' || item.kind === 'followup' && !item.message) { byId('campusInput').focus(); return; }
                if (byId('campusInput').value.trim()) { byId('requestStatus').textContent = '输入框里还有草稿，可以先发送或修改。'; byId('campusInput').focus(); return; }
                submit(item.message,'choice');
            }); target.appendChild(button);
        });
    }
    function render(turn) {
        byId('campusReply').textContent = turn.reply;
        byId('replyMode').textContent = turn.mode === 'deepseek' ? '校园资料与智能回答' : turn.mode === 'local-fallback' ? '已使用校园资料回答' : '校园资料回答';
        byId('greeting').textContent = '我陪你一起看看。';
        choices(turn.choices); byId('referenceLinks').replaceChildren();
        (turn.references || []).forEach(function (reference) { byId('referenceLinks').appendChild(CampusScene.link(reference.title,reference.url)); });
        scene.render(turn); lastSpeech = turn.speech || turn.reply;
    }
    function payload(message,origin) {
        var campusId = environment.campusId() || null, destination = scene.place(context.placeId);
        return {requestId:'campus-' + nonce + '-' + (++serial),conversationId:context.conversationId,
            contextRevision:context.contextRevision,message:message,campusId:campusId,
            placeId:destination && destination.campusId === campusId ? destination.id : null,audience:context.audience || 'student',origin:origin || 'user',context:environment.snapshot()};
    }
    /** A retry retains the frozen payload; explicit cancellation alone creates a new attempt. */
    async function run(attempt) {
        var own = ++generation, controller = new AbortController();
        active = {attempt:attempt,controller:controller,owner:own}; failed = null;
        if (voice) voice.activity('thinking');
        scene.invalidate(); byId('requestStatus').textContent = '正在查找校园资料…'; update();
        var timer = setTimeout(function () { if (active && active.owner === own) controller.abort(); },25000);
        try {
            var turn = await api('/api/campus/chat',attempt.payload,controller.signal);
            if (!active || generation !== own || disposed) return;
            if (turn.conversationId !== attempt.payload.conversationId || !Number.isInteger(turn.contextRevision) || turn.contextRevision <= attempt.payload.contextRevision) throw Error('invalid-turn');
            active = null;
            adopt(Object.assign({},turn.context,{conversationId:turn.conversationId,contextRevision:turn.contextRevision}));
            render(turn); byId('requestStatus').textContent = ''; voice.activity('idle'); voice.speak(lastSpeech);
        } catch (error) {
            if (!active || generation !== own || disposed) return;
            active = null; failed = attempt;
            if (!byId('campusInput').value && draftRevision === attempt.draftRevision) byId('campusInput').value = attempt.message;
            byId('requestStatus').textContent = error.status === 409 ? '这条消息的状态正在同步，请稍后重试。' : '暂时没有收到回答。消息已保留，可以重试。';
            voice.activity('idle');
            if (error.status === 409 && error.code !== 'REQUEST_IN_PROGRESS') {
                ready = false; attempt.payload = null;
                try {
                    var synchronized = await api('/api/campus/context');
                    if (generation === own && !disposed) { adopt(synchronized); byId('requestStatus').textContent = '对话状态已同步。可以重试这条消息。'; }
                } catch (_) { if (generation === own) byId('reloadContext').hidden = false; }
            }
        } finally { clearTimeout(timer); if (generation === own) update(); }
    }
    async function submit(message,origin) {
        message = String(message || '').trim();
        if (!message || message.length > 2000 || requestBusy()) return;
        if (failed && failed.payload) {
            var previousGeneration = generation;
            if (!await cancel() || generation !== previousGeneration + 1) return;
        }
        voice.stop(); clearTimeout(welcomeTimer);
        if (byId('campusInput').value.trim() === message) byId('campusInput').value = '';
        var attempt = {message:message,origin:origin || 'user',payload:payload(message,origin),draftRevision:draftRevision};
        byId('userMessage').textContent = '你说 ' + message; byId('userMessage').hidden = false;
        run(attempt);
    }
    /** Invalidate UI ownership before abort/cancel. Only a synced context can accept the next send. */
    async function cancel() {
        if (barrier) { await barrier; return ready; }
        var task = active ? active.attempt : failed;
        generation++; if (active) active.controller.abort(); active = null;
        if (voice) voice.stop(); if (scene) scene.invalidate();
        if (!task || !task.payload && !task.payloadToCancel) { failed = null; update(); return ready; }
        task.payloadToCancel = task.payloadToCancel || task.payload;
        failed = task; ready = false;
        var own = generation;
        barrier = api('/api/campus/cancel',{conversationId:task.payloadToCancel.conversationId,requestId:task.payloadToCancel.requestId})
            .then(function (snapshot) {
                if (own !== generation || disposed) return;
                adopt(snapshot); task.payload = null; task.payloadToCancel = null;
                byId('requestStatus').textContent = '已取消等待。你可以重试这条消息，或输入新问题。';
            }).catch(function () {
                if (own !== generation) return;
                byId('requestStatus').textContent = '取消状态尚未同步，请重新连接后继续。'; byId('reloadContext').hidden = false;
            }).finally(function () { if (own === generation) { barrier = null; update(); } });
        update(); await barrier; return ready;
    }
    async function newConversation() {
        var own = ++generation; ready = false;
        if (active) active.controller.abort(); active = null; failed = null; barrier = null;
        voice.stop(); environment.reset(); scene.clear(); clearTimeout(welcomeTimer);
        byId('campusChoices').replaceChildren(); byId('referenceLinks').replaceChildren(); byId('userMessage').hidden = true;
        byId('greeting').textContent = '下一段校园时光，想聊些什么？';
        byId('campusReply').textContent = '想去哪里，或有什么事要办？'; byId('replyMode').textContent = '';
        lastSpeech = '想去哪里，或有什么事要办？';
        byId('requestStatus').textContent = '正在开启新对话…'; update();
        try {
            var snapshot = await api('/api/campus/new',{});
            if (generation !== own || disposed) return;
            adopt(snapshot); byId('requestStatus').textContent = ''; byId('reloadContext').hidden = true;
        } catch (_) { if (generation === own) { byId('requestStatus').textContent = '新对话暂未连接，可以重新连接。'; byId('reloadContext').hidden = false; } }
        update();
    }
    async function initialize() {
        var own = generation;
        try {
            var data = await Promise.all([api('/api/campus/catalog'),api('/api/campus/context')]);
            if (disposed || generation !== own) return;
            catalog = data[0]; scene = CampusScene.create({catalog:catalog,onChoice:function (message) {
                if (byId('campusInput').value.trim()) { byId('requestStatus').textContent = '输入框里还有草稿，可以先发送或修改。'; byId('campusInput').focus(); return; } submit(message,'choice');
            }});
            voice = CampusVoice.create({get:api,onActivity:function () { if (environment) environment.update(); },isRequestBusy:requestBusy,
                readDraft:function () { return byId('campusInput').value; },onDraft:function (text) { byId('campusInput').value = text; },onSubmit:submit});
            environment = CampusEnvironment.create({catalog:catalog,get:api,onBoundary:cancel,
                isBusy:function () { return requestBusy() || !!byId('campusInput').value.trim() || !!voice && voice.busy(); },
                onQuiet:function (quiet) { if (voice) voice.setQuiet(quiet); },onAccept:function (message) { submit(message,'proactive_accept'); }});
            adopt(data[1]); byId('requestStatus').textContent = ''; byId('reloadContext').hidden = true; update();
            voice.ready.then(function () { if (!document.hidden && generation === own && !disposed && !active) voice.speak(lastSpeech); });
        } catch (_) {
            byId('requestStatus').textContent = '校园资料暂未连接。输入的内容会保留，请重新连接。'; byId('reloadContext').hidden = false; update();
        }
    }
    byId('campusForm').addEventListener('submit',function (event) { event.preventDefault(); submit(byId('campusInput').value,'user'); });
    byId('campusInput').addEventListener('keydown',function (event) { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); submit(byId('campusInput').value,'user'); } });
    byId('campusInput').addEventListener('input',function () { draftRevision++; if (voice) voice.cancelRecognition(); update(); });
    byId('cancelRequest').addEventListener('click',cancel);
    byId('newConversation').addEventListener('click',function () { if (scene && voice && environment) newConversation(); });
    byId('retryRequest').addEventListener('click',function () {
        if (!failed || requestBusy()) return;
        if (!failed.payload) failed.payload = payload(failed.message,failed.origin);
        if (byId('campusInput').value.trim() === failed.message) byId('campusInput').value = '';
        run(failed);
    });
    byId('reloadContext').addEventListener('click',async function () {
        if (barrier || active) return;
        if (!catalog || !environment) { initialize(); return; }
        if (failed && failed.payloadToCancel) { await cancel(); return; }
        try { adopt(await api('/api/campus/context')); byId('reloadContext').hidden = true; byId('requestStatus').textContent = ''; update(); }
        catch (_) { byId('requestStatus').textContent = '暂未连接，请稍后再试。'; }
    });
    byId('replaySpeech').addEventListener('click',function () { if (voice && !requestBusy()) { voice.stop(); voice.speak(lastSpeech); } });
    window.addEventListener('pagehide',function () {
        disposed = true; generation++; clearTimeout(welcomeTimer);
        if (active) { active.controller.abort(); api('/api/campus/cancel',{conversationId:active.attempt.payload.conversationId,requestId:active.attempt.payload.requestId}).catch(function () {}); }
        if (voice) voice.destroy(); if (environment) environment.destroy(); if (scene) scene.invalidate();
    });
    welcomeTimer = setTimeout(function () { byId('conversation').hidden = false; byId('campusControls').hidden = false; },1400);
    update(); initialize();
})();
