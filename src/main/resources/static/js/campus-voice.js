/* REQ-054: adapt existing speech lifecycle and recognition to one campus send path. */
(function (root) {
    'use strict';
    function create(options) {
        var byId = function (id) { return document.getElementById(id); };
        var settings = GuideVoiceSettings.normalize({}), muted = false, quiet = false, configEdited = false;
        var recognition = null, recognitionVersion = 0, recognitionRequested = false, recognitionTimer = null;
        var local = GuideLocalSpeech.create({fetch:AuthGuard.apiFetch,Audio:root.Audio,URL:root.URL,AbortController:root.AbortController});
        var controller = GuideSpeech.create({synthesis:root.speechSynthesis,Utterance:root.SpeechSynthesisUtterance,
            nativeBridge:root.AndroidSpeech,localEngine:local,getSettings:function () { return settings; },
            selectVoice:function (voices,config) { return GuideVoiceSettings.choose(config,voices).voice; },
            onMouth:function (value) { byId('avatar').classList.toggle('speaking',value); },
            onChange:function (state) {
                var labels = {idle:'我在这里',listening:'正在听你说',thinking:'正在查找校园资料',queued:'正在准备声音',speaking:'正在讲给你听',paused:'声音已暂停',error:'可以继续阅读文字'};
                var message = state.message;
                if (state.status === 'error' && /not-allowed|尚未允许|未允许/.test(message)) message = '点击回听，让我讲给你听';
                else if (state.status === 'error' && /语音播放失败（/.test(message)) message = '声音暂时不可用，可以继续阅读文字';
                byId('speechStatus').textContent = message || labels[state.status] || '';
                options.onActivity();
            }});
        function buttonState() {
            byId('soundToggle').textContent = quiet ? '安静环境已静音' : muted || settings.volume === 0 ? '声音已关' : '声音已开';
            byId('soundToggle').setAttribute('aria-pressed',String(!muted && !quiet && settings.volume > 0));
        }
        function cancelRecognition() {
            recognitionVersion++; recognitionRequested = false; clearTimeout(recognitionTimer);
            if (recognition) { try { recognition.abort(); } catch (_) {} recognition = null; }
            try { if (root.AndroidSpeech && root.AndroidSpeech.stopListening) root.AndroidSpeech.stopListening(); } catch (_) {}
            byId('voiceInput').textContent = '说话';
            if (controller && controller.getState().status === 'listening') controller.setActivity('idle');
        }
        function stop() { cancelRecognition(); controller.stop(); controller.setActivity('idle'); options.onActivity(); }
        function speak(text) { cancelRecognition(); if (!muted && !quiet && settings.volume > 0 && !document.hidden) controller.speak(text); }
        function received(text, final, token) {
            if (!recognitionRequested || token !== recognitionVersion || document.hidden) return;
            options.onDraft(text); if (!final) return;
            recognitionRequested = false; byId('voiceInput').textContent = '说话'; controller.setActivity('idle');
            recognitionTimer = setTimeout(function () {
                if (token !== recognitionVersion || document.hidden || options.readDraft() !== text || options.isRequestBusy()) return;
                options.onSubmit(text);
            },200);
        }
        function startRecognition() {
            if (recognitionRequested) { stop(); return; }
            if (options.isRequestBusy()) return;
            stop(); var token = recognitionVersion; recognitionRequested = true;
            byId('speechStatus').textContent = '正在申请麦克风';
            function started() { if (recognitionRequested && token === recognitionVersion) { controller.setActivity('listening'); byId('voiceInput').textContent = '停止'; options.onActivity(); } }
            function failed() { if (token !== recognitionVersion) return; stop(); byId('speechStatus').textContent = '语音输入暂不可用，可以直接打字'; }
            try {
                if (root.AndroidSpeech && root.AndroidSpeech.startListening) {
                    root.onSpeechStart = started;
                    root.onSpeechPartial = function (text) { received(text,false,token); };
                    root.onSpeechResult = function (text) { received(text,true,token); };
                    root.onSpeechError = failed;
                    root.AndroidSpeech.startListening();
                } else {
                    var Constructor = root.SpeechRecognition || root.webkitSpeechRecognition;
                    if (!Constructor) { failed(); return; }
                    recognition = new Constructor(); recognition.lang = 'zh-CN'; recognition.interimResults = true; recognition.continuous = false; recognition.maxAlternatives = 1;
                    recognition.onstart = started; recognition.onerror = failed;
                    recognition.onresult = function (event) {
                        var text = '', final = false;
                        for (var i = event.resultIndex || 0; i < event.results.length; i++) { text += event.results[i][0].transcript; final = final || event.results[i].isFinal; }
                        received(text.trim(),final,token);
                    };
                    recognition.onend = function () { if (recognitionRequested && token === recognitionVersion) { recognitionRequested = false; byId('voiceInput').textContent = '说话'; controller.setActivity('idle'); options.onActivity(); } };
                    recognition.start();
                }
            } catch (_) { failed(); }
        }
        function voices() {
            var list = GuideVoiceSettings.chinese(root.speechSynthesis ? root.speechSynthesis.getVoices() : []), select = byId('voiceSelect');
            select.replaceChildren();
            [{voiceURI:'auto',name:'系统中文'},{voiceURI:'local:character',name:'角色声线'}].concat(list).forEach(function (v) { var option = document.createElement('option'); option.value = v.voiceURI; option.textContent = v.name || v.voiceURI; select.appendChild(option); });
            if (!['auto','local:character'].concat(list.map(function (v) { return v.voiceURI; })).includes(settings.voiceType)) {
                var stored = document.createElement('option'); stored.value = settings.voiceType; stored.textContent = '已设声线，设备可用时播放'; select.appendChild(stored);
            }
            select.value = settings.voiceType;
        }
        byId('voiceInput').addEventListener('click',startRecognition);
        byId('stopSpeech').addEventListener('click',stop);
        byId('soundToggle').addEventListener('click',function () { muted = !muted; if (muted) stop(); buttonState(); });
        byId('voiceSelect').addEventListener('change',function () { configEdited = true; stop(); settings = GuideVoiceSettings.normalize(Object.assign({},settings,{voiceType:byId('voiceSelect').value})); });
        if (root.speechSynthesis && root.speechSynthesis.addEventListener) root.speechSynthesis.addEventListener('voiceschanged',voices);
        var ready = options.get('/api/digital-human-config').then(function (raw) {
            if (configEdited) return;
            settings = GuideVoiceSettings.normalize({voiceType:raw.voiceType,volume:raw.volume,speechRate:raw.speechRate}); buttonState(); voices();
        }).catch(function () { buttonState(); });
        voices();
        document.addEventListener('visibilitychange',function () { if (document.hidden) stop(); });
        return {ready:ready,speak:speak,stop:stop,cancelRecognition:cancelRecognition,
            activity:function (value) { cancelRecognition(); controller.setActivity(value); },
            busy:function () { return recognitionRequested || ['speaking','queued','listening'].includes(controller.getState().status); },
            setQuiet:function (value) { var entering = value && !quiet; quiet = value; if (entering) stop(); buttonState(); },
            destroy:function () { cancelRecognition(); controller.destroy(); if (root.speechSynthesis && root.speechSynthesis.removeEventListener) root.speechSynthesis.removeEventListener('voiceschanged',voices); }};
    }
    root.CampusVoice = {create:create};
})(window);
