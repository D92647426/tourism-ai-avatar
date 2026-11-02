// REQ-036 / GitHub #7: one truthful speech task at a time.
// The page state follows real synthesis/native events; every task carries a
// page-level nonce so callbacks from a replaced task or an old page load can
// never rewrite the current state. Contract and acceptance:
// docs/speech_lifecycle.md. main.js owns DOM, mouth interpolation and Android
// adapter wiring; this module owns the lifecycle only.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.GuideSpeech = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    /** REQ-036: startup event deadline, measured from the speak() submission. */
    var START_TIMEOUT_MS = 8000;
    /** REQ-036: fixed speaking-failure cap, re-armed on every real start/resume. */
    var SPEAK_TIMEOUT_MS = 120000;
    /** REQ-036: bounded wait for asynchronously loaded Web voices. */
    var VOICE_WAIT_MS = 1500;

    var ACTIVITIES = ['idle', 'listening', 'thinking'];
    var MESSAGES = {
        unsupported: '当前环境不支持语音合成，文字内容仍可阅读',
        noVoice: '未检测到中文语音，文字内容仍可阅读',
        legacyApk: '；当前 APK 语音协议过旧，请重建 APK',
        startTimeout: '语音启动超时，文字内容仍可阅读',
        speakTimeout: '语音播放异常已停止，文字内容仍可阅读',
        engineError: '语音播放失败，文字内容仍可阅读'
    };

    /**
     * REQ-036: page-level random nonce. A reload creates a new module instance
     * with a new nonce, so an old task id from the previous page (or a replaced
     * task) cannot match the current active task.
     * @returns {string} at least 12 lowercase base36 characters.
     */
    function createNonce() {
        var text = '';
        while (text.length < 12) text += Math.random().toString(36).slice(2);
        return text.slice(0, 12);
    }

    /**
     * REQ-036: first Chinese Web voice (lang zh*), mirroring the old page rule.
     * @param {Array} voices Voices returned by synthesis.getVoices().
     * @returns {Object|null} A voice or null when no Chinese voice is loaded.
     */
    function findChineseVoice(voices) {
        for (var i = 0; i < voices.length; i++) {
            var voice = voices[i];
            if (voice && typeof voice.lang === 'string' && /^zh/i.test(voice.lang)) return voice;
        }
        return null;
    }

    /**
     * REQ-036: create the speech lifecycle for the current page.
     *
     * Injected options (no global window/engine access):
     * - synthesis: Web Speech compatible object (getVoices, speak, cancel and
     *   optionally addEventListener/removeEventListener for voiceschanged).
     * - Utterance: SpeechSynthesisUtterance-compatible constructor.
     * - nativeBridge: Android protocol-2 object; only speakWithId is trusted.
     *   Legacy bridges (no getTtsProtocolVersion() === 2) are ignored and the
     *   module degrades to Web speech without using unreliable old callbacks.
     * - onChange({status,message}): page callback; must not throw.
     * - onMouth(boolean): page callback; true only after a real onstart/resume.
     * - setTimeout/clearTimeout: test clock hooks (default global timers).
     *
     * Status: idle | listening | thinking | queued | speaking | paused | error.
     * A task enters queued while the engine is selected and becomes speaking
     * only on a real start event. Speech completion returns to the current
     * page activity, so callers that were thinking/listening must call
     * setActivity('idle') when that activity is over.
     *
     * @param {Object} options Injected engine/page/test hooks described above.
     * @returns {{speak: Function, stop: Function, setActivity: Function,
     *   nativeEvent: Function, destroy: Function, getState: Function}}
     * @see ../../../../../docs/speech_lifecycle.md (REQ-036 / #7 contract)
     */
    function create(options) {
        options = options || {};
        var schedule = options.setTimeout || setTimeout;
        var unschedule = options.clearTimeout || clearTimeout;
        var synthesis = options.synthesis || null;
        var UtteranceCtor = options.Utterance || null;
        var nonce = createNonce();
        var sequence = 0;
        var active = null;
        var activity = 'idle';
        var destroyed = false;
        var mouth = false;
        var state = { status: 'idle', message: '' };

        /** REQ-036: publish a state snapshot only when it actually changes. */
        function notify(status, message) {
            message = message || '';
            if (state.status === status && state.message === message) return;
            state = { status: status, message: message };
            if (options.onChange) options.onChange({ status: status, message: message });
        }

        /** REQ-036: the only place the rendering layer toggles the mouth. */
        function setMouth(value) {
            value = !!value;
            if (mouth === value) return;
            mouth = value;
            if (options.onMouth) options.onMouth(value);
        }

        /** Read Web voices; a hostile/absent synthesis behaves as "no voices". */
        function readVoices() {
            if (!synthesis || typeof synthesis.getVoices !== 'function') return [];
            try {
                var voices = synthesis.getVoices();
                return voices || [];
            } catch (error) {
                return [];
            }
        }

        function currentBridge() {
            var bridge = options.nativeBridge;
            return bridge && typeof bridge === 'object' ? bridge : null;
        }

        function clearTimer(task, key) {
            if (task.timers[key] == null) return;
            unschedule(task.timers[key]);
            task.timers[key] = null;
        }

        /** REQ-036: event-target style listener removal (never overwrite on*). */
        function removeVoiceListener(task) {
            if (!task.voiceListener) return;
            try {
                if (synthesis && typeof synthesis.removeEventListener === 'function') {
                    synthesis.removeEventListener('voiceschanged', task.voiceListener);
                }
            } catch (error) { /* best effort; state is already settled */ }
            task.voiceListener = null;
        }

        /** REQ-036: drop every timer/listener/handler owned by one task. */
        function clearTask(task) {
            if (!task) return;
            clearTimer(task, 'start');
            clearTimer(task, 'cap');
            clearTimer(task, 'voices');
            removeVoiceListener(task);
            if (task.utterance) {
                task.utterance.onstart = null;
                task.utterance.onend = null;
                task.utterance.onerror = null;
                task.utterance.onpause = null;
                task.utterance.onresume = null;
                task.utterance = null;
            }
        }

        /** REQ-036: stop only the engine that belonged to an isolated task. */
        function cancelEngine(task) {
            if (!task) return;
            try {
                if (task.engine === 'web') {
                    if (synthesis && typeof synthesis.cancel === 'function') synthesis.cancel();
                } else if (task.engine === 'native') {
                    var bridge = task.bridge;
                    if (bridge && typeof bridge.stopSpeaking === 'function') bridge.stopSpeaking();
                }
            } catch (error) { /* the task is already settled; never throw to page */ }
        }

        /**
         * REQ-036: isolate the active identity BEFORE touching the engine, so a
         * synchronous onend/onerror fired by cancel() cannot pollute the state.
         */
        function detach() {
            var task = active;
            if (!task) return null;
            active = null;
            clearTask(task);
            setMouth(false);
            return task;
        }

        /** REQ-036: settle exactly one task; stale identities are ignored. */
        function finish(task, status, message, cancel) {
            if (active !== task) return false;
            active = null;
            clearTask(task);
            setMouth(false);
            if (cancel) cancelEngine(task);
            notify(status, message);
            return true;
        }

        function engineMessage(reason) {
            return typeof reason === 'string' && reason
                ? '语音播放失败（' + reason + '），文字内容仍可阅读'
                : MESSAGES.engineError;
        }

        function noVoiceMessage(task) {
            return task.legacyBridge ? MESSAGES.noVoice + MESSAGES.legacyApk : MESSAGES.noVoice;
        }

        /** REQ-036: fixed failure cap for an already started utterance. */
        function armFailureCap(task) {
            clearTimer(task, 'cap');
            task.timers.cap = schedule(function () {
                if (active !== task) return;
                task.timers.cap = null;
                finish(task, 'error', MESSAGES.speakTimeout, true);
            }, SPEAK_TIMEOUT_MS);
        }

        /** REQ-036: mouth may open only here, on a genuine start event. */
        function handleStart(task) {
            if (active !== task || task.started) return false;
            task.started = true;
            clearTimer(task, 'start');
            setMouth(true);
            notify('speaking', '');
            armFailureCap(task);
            return true;
        }

        /** REQ-036: pause closes the mouth and freezes the failure cap. */
        function handlePause(task) {
            if (active !== task || !task.started) return false;
            clearTimer(task, 'cap');
            task.paused = true;
            setMouth(false);
            notify('paused', '');
            return true;
        }

        /** REQ-036: resume only the current task that really started. */
        function handleResume(task) {
            if (active !== task || !task.started || !task.paused) return false;
            task.paused = false;
            setMouth(true);
            notify('speaking', '');
            armFailureCap(task);
            return true;
        }

        /** REQ-036: natural end or native stop; no engine cancel needed. */
        function handleEnd(task) {
            if (active !== task) return false;
            return finish(task, activity, '', false);
        }

        /** REQ-036: immediate failure: close mouth, clean up, report error. */
        function handleError(task, reason) {
            if (active !== task) return false;
            return finish(task, 'error', engineMessage(reason), true);
        }

        /** REQ-036: speak through Web Speech with the page's original defaults. */
        function speakThroughWeb(task, voice) {
            if (active !== task) return;
            clearTimer(task, 'voices');
            removeVoiceListener(task);
            if (!synthesis || typeof synthesis.speak !== 'function' || typeof UtteranceCtor !== 'function') {
                finish(task, 'error', MESSAGES.unsupported, false);
                return;
            }
            var utterance;
            try {
                utterance = new UtteranceCtor(task.text);
                utterance.lang = 'zh-CN';
                utterance.voice = voice;
                utterance.rate = task.settings ? task.settings.speechRate : 1.05;
                utterance.pitch = 1.1;
                utterance.volume = task.settings ? task.settings.volume : 1;
            } catch (error) {
                finish(task, 'error', MESSAGES.unsupported, false);
                return;
            }
            utterance.onstart = function () { handleStart(task); };
            utterance.onend = function () { handleEnd(task); };
            utterance.onerror = function (event) { handleError(task, event && event.error); };
            utterance.onpause = function () { handlePause(task); };
            utterance.onresume = function () { handleResume(task); };
            task.engine = 'web';
            task.utterance = utterance;
            try {
                synthesis.speak(utterance);
            } catch (error) {
                finish(task, 'error', MESSAGES.engineError, true);
            }
        }

        /**
         * REQ-036: Web voices often load after the page; wait for voiceschanged
         * with event-target registration (never assignment) and a 1500 ms bound.
         */
        function waitForVoices(task) {
            if (synthesis && typeof synthesis.addEventListener === 'function') {
                task.voiceListener = function () {
                    if (active !== task) return;
                    var voice = (options.selectVoice ? options.selectVoice(readVoices(), task.settings) : findChineseVoice(readVoices()));
                    if (voice) speakThroughWeb(task, voice);
                };
                try {
                    synthesis.addEventListener('voiceschanged', task.voiceListener);
                } catch (error) {
                    task.voiceListener = null;
                }
            }
            task.timers.voices = schedule(function () {
                if (active !== task) return;
                task.timers.voices = null;
                var voice = (options.selectVoice ? options.selectVoice(readVoices(), task.settings) : findChineseVoice(readVoices()));
                if (voice) speakThroughWeb(task, voice);
                else finish(task, 'error', noVoiceMessage(task), false);
            }, VOICE_WAIT_MS);
        }

        function beginWeb(task) {
            if (!synthesis || typeof synthesis.speak !== 'function' || typeof UtteranceCtor !== 'function') {
                finish(task, 'error', MESSAGES.unsupported, false);
                return;
            }
            var voice = (options.selectVoice ? options.selectVoice(readVoices(), task.settings) : findChineseVoice(readVoices()));
            if (voice) speakThroughWeb(task, voice);
            else waitForVoices(task);
        }

        /**
         * REQ-036: protocol 2 is preferred only when it also reports ready.
         * Legacy bridges are not used (their callbacks carry no task id); the
         * task falls back to Web and remembers the legacy state for the hint.
         * Bridge query exceptions are treated as "not usable" and never thrown.
         * @returns {boolean} true when a native task was submitted.
         */
        function beginNative(task) {
            if (typeof options.getSettings === "function") return false; // Current native protocol cannot apply settings.
            var bridge = currentBridge();
            if (!bridge) return false;
            var version = null;
            try {
                if (typeof bridge.getTtsProtocolVersion === 'function') version = bridge.getTtsProtocolVersion();
            } catch (error) {
                version = null;
            }
            if (typeof bridge.speakWithId !== 'function' || version !== 2) {
                task.legacyBridge = true;
                return false;
            }
            var ready = false;
            try {
                ready = typeof bridge.isTtsReady === 'function' && bridge.isTtsReady() === true;
            } catch (error) {
                ready = false;
            }
            if (!ready) return false;
            task.engine = 'native';
            task.bridge = bridge;
            try {
                bridge.speakWithId(task.text, task.id);
            } catch (error) {
                finish(task, 'error', MESSAGES.engineError, true);
            }
            return true;
        }

        /**
         * REQ-036: speak already-cleaned text (trim only). Starting a new task
         * isolates and cancels the previous one first.
         * @param {string} text Text to speak.
         * @returns {boolean} true when a task was accepted.
         */
        function speak(text) {
            if (destroyed) return false;
            var clean = typeof text === 'string' ? text.trim() : '';
            if (!clean) return false;
            var previous = detach();
            if (previous) cancelEngine(previous);
            var task = {
                id: 'gs-' + nonce + '-' + (++sequence),
                text: clean,
                settings: typeof options.getSettings === 'function' ? options.getSettings() : null,
                engine: null,
                bridge: null,
                utterance: null,
                voiceListener: null,
                started: false,
                paused: false,
                legacyBridge: false,
                timers: { start: null, cap: null, voices: null }
            };
            active = task;
            notify('queued', '');
            task.timers.start = schedule(function () {
                if (active !== task) return;
                task.timers.start = null;
                finish(task, 'error', MESSAGES.startTimeout, true);
            }, START_TIMEOUT_MS);
            if (beginNative(task)) return true;
            beginWeb(task);
            return true;
        }

        /**
         * REQ-036: cancel current speech (idempotent) and return to page activity.
         * @returns {boolean} true when a task was actually cancelled.
         */
        function stop() {
            if (destroyed || !active) return false;
            var task = detach();
            cancelEngine(task);
            notify(activity, '');
            return true;
        }

        /**
         * REQ-036: page activity is shown whenever no speech task is active.
         * Speech is stopped before the activity changes.
         * @param {string} next idle | listening | thinking.
         * @returns {boolean} true when applied.
         * @throws {TypeError} If next is not a known activity.
         */
        function setActivity(next) {
            if (destroyed) return false;
            if (ACTIVITIES.indexOf(next) === -1) throw new TypeError('Unknown activity: ' + next);
            if (active) {
                var task = detach();
                cancelEngine(task);
            }
            activity = next;
            notify(next, '');
            return true;
        }

        /**
         * REQ-036: Android protocol-2 callbacks. Only the exact current task id
         * is accepted; a missing or foreign id is ignored. Unknown kinds are
         * rejected. Bridge-originated errors become error state, never throws.
         * @param {string} kind start | end | error | stop.
         * @param {string} id Task id passed to speakWithId.
         * @param {*} [error] Optional error detail for kind="error".
         * @returns {boolean} true when the event was accepted.
         */
        function nativeEvent(kind, id, error) {
            if (destroyed) return false;
            var task = active;
            if (!task || task.engine !== 'native') return false;
            if (typeof id !== 'string' || id !== task.id) return false;
            var name = typeof kind === 'string' ? kind.toLowerCase() : '';
            if (name === 'start') return handleStart(task);
            if (name === 'end' || name === 'stop') return handleEnd(task);
            if (name === 'error') return handleError(task, typeof error === 'string' ? error : '');
            return false;
        }

        /**
         * REQ-036: tear the module down (pagehide/close chat). Isolates the task,
         * clears timers/listeners, closes the mouth and silences callbacks.
         * @returns {boolean} true on the first call, false afterwards.
         */
        function destroy() {
            if (destroyed) return false;
            destroyed = true;
            var task = active;
            active = null;
            if (task) {
                clearTask(task);
                setMouth(false);
                cancelEngine(task);
            }
            activity = 'idle';
            state = { status: 'idle', message: '' };
            return true;
        }

        /** REQ-036: detached snapshot of the state shared with UI text. */
        function getState() {
            return { status: state.status, message: state.message };
        }

        return {
            speak: speak,
            stop: stop,
            setActivity: setActivity,
            nativeEvent: nativeEvent,
            destroy: destroy,
            getState: getState
        };
    }

    return { create: create };
});
