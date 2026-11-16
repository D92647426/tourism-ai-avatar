/* REQ-062: RuiC-2D character, pointer gaze and truthful speech-driven mouth.
 * Integration and asset provenance: docs/campus_avatar.md. */
(function (root) {
    'use strict';
    var ASSET_BASE = '/media/campus/yanxiaobei-v8/';
    var ACTION_BASE = '/media/campus/yanxiaobei-actions/';
    var STORAGE_KEY = 'campus.avatar.appearance.v1';
    var APPEARANCES = [
        {id:'overalls',label:'背带裤'}, {id:'hoodie',label:'兜帽衫'}, {id:'tshirt',label:'短袖'}
    ];
    function knownAppearance(id) { return APPEARANCES.some(function (item) { return item.id === id; }); }
    function savedAppearance() {
        try { var id = root.localStorage.getItem(STORAGE_KEY); return knownAppearance(id) ? id : 'overalls'; }
        catch (_) { return 'overalls'; }
    }
    function clamp(value, limit) { return Math.max(-limit, Math.min(limit, value)); }

    /** Create one character renderer. Input is canvas and fallback image.
     * Returns ready, setSpeaking, attachAudio, getState and idempotent destroy.
     * Rendering failures retain the matching static portrait. REQ-062. */
    function create(options) {
        var canvas = options.canvas, fallback = options.fallback;
        var model = null, disposed = false, frameId = null, elapsed = 0, lastTime = null;
        var speaking = false, speechTime = 0, mouthLevel = 0, nextBlink = 4.8, blinkStart = -1;
        var pointer = null, gaze = {x:0,y:0}, visible = true, parameters = {}, faceCentre = null;
        var context = null, audioTap = null, observer = null;
        var abort = null, loadVersion = 0, loading = false, appearance = savedAppearance(), remembered = true;
        var action = 'idle', pose = 'idle', desiredAppearance = appearance, desiredAction = 'idle', actionTime = 0;
        function getState() { return {ready:!!model && canvas.dataset.avatarState === 'ready',appearance:appearance,action:action,
            requestedAction:desiredAction,loading:loading,remembered:remembered,speaking:speaking,parameters:Object.assign({},parameters)}; }
        function emit() { if (options.onChange) options.onChange(getState()); }
        function remember(id) {
            try { root.localStorage.setItem(STORAGE_KEY,id); remembered = true; }
            catch (_) { remembered = false; }
        }
        var reduced = root.matchMedia('(prefers-reduced-motion: reduce)');

        function render(delta) {
            var moving = !reduced.matches;
            elapsed += delta;
            speechTime += delta;
            actionTime += delta;
            var motion = root.CampusAvatarActions.sample(action,actionTime);
            var targetX = 0, targetY = 0;
            if (pointer && moving) {
                var rect = canvas.getBoundingClientRect();
                // Convert the rig's eye centre into the current contain-fit viewport.
                var viewport = model.getViewport(), pixelRatio = canvas.width / rect.width;
                var eyeX = rect.left + (viewport.offset[0] + faceCentre.x * viewport.scale) / pixelRatio;
                var eyeY = rect.top + (viewport.offset[1] + faceCentre.y * viewport.scale) / pixelRatio;
                targetX = clamp((pointer.x - eyeX) / Math.max(180, rect.width), 1);
                targetY = clamp((eyeY - pointer.y) / Math.max(180, rect.height), 1);
            }
            var smoothing = 1 - Math.exp(-delta * 9);
            gaze.x += (targetX - gaze.x) * smoothing;
            gaze.y += (targetY - gaze.y) * smoothing;
            if (moving && elapsed >= nextBlink) { blinkStart = elapsed; nextBlink = elapsed + 4.8 + Math.random() * 2.2; }
            var blinkPhase = (elapsed - blinkStart) / 0.34;
            var eyeOpen = moving && blinkStart >= 0 && blinkPhase < 1 ? 1 - Math.sin(blinkPhase * Math.PI) : 1;
            var mouthTarget = 0;
            if (speaking) {
                if (audioTap) {
                    audioTap.analyser.getFloatTimeDomainData(audioTap.waveform);
                    var energy = audioTap.waveform.reduce(function (sum, value) { return sum + value * value; },0);
                    mouthTarget = Math.min(1, Math.max(0, (Math.sqrt(energy / audioTap.waveform.length) - 0.012) * 8));
                } else {
                    mouthTarget = Math.max(0, Math.sin(speechTime * 12.5)) * (0.55 + 0.4 * Math.pow(Math.sin(speechTime * 3.4),2));
                }
            }
            mouthLevel += (mouthTarget - mouthLevel) * (1 - Math.exp(-delta * 25));
            if (!speaking) mouthLevel = 0;
            parameters = {
                gazeX:moving ? gaze.x * 0.8 : 0, gazeY:moving ? gaze.y * 0.65 + motion.gazeY : 0,
                angleX:moving ? gaze.x * 16 : 0,
                angleY:moving ? gaze.y * 6 + motion.pitch + (speaking ? Math.sin(speechTime * 4) * 0.7 : 0) : 0,
                angleZ:moving ? Math.sin(elapsed * 0.55) * .5 + motion.roll : 0,
                bodyAngleX:moving ? gaze.x * (action === 'study' ? 1.5 : 5) : 0,
                bodyAngleZ:moving ? gaze.x * 3 + motion.body + Math.sin(elapsed * .42) * .4 : 0,
                breath:moving ? (Math.sin(elapsed * 1.25) + 1) * .16 : 0,
                eyeLOpen:eyeOpen * motion.eyeL,eyeROpen:eyeOpen * motion.eyeR,eyeSmile:motion.smile,
                browY:motion.brow,browAngle:motion.browAngle,blush:motion.blush,mouthOpen:mouthLevel,
                mouthForm:speaking && !audioTap ? [0,-0.8,0.5,0.9][Math.floor(speechTime * 2.4) % 4] : 0
            };
            var fixedDesk = action === 'study';
            var host = canvas.parentElement;
            host.style.setProperty('--body-x',(moving && !fixedDesk ? gaze.x * 10 : 0).toFixed(2) + 'px');
            host.style.setProperty('--body-y',(moving && !fixedDesk ? -gaze.y * 3 + motion.lift : 0).toFixed(2) + 'px');
            host.style.setProperty('--body-roll',(moving && !fixedDesk ? gaze.x * 1.8 + motion.roll * .25 : 0).toFixed(2) + 'deg');
            model.setSwayGain(moving ? .48 : 0);
            model.setParameters(parameters);
            model.advance(delta,60);
        }
        function frame(now) {
            frameId = null;
            if (disposed || !model || canvas.dataset.avatarState !== 'ready' || root.document.hidden || !visible) return;
            var delta = lastTime === null ? 1 / 60 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
            lastTime = now;
            render(delta);
            frameId = root.requestAnimationFrame(frame);
        }
        function wake() {
            if (disposed || !model || canvas.dataset.avatarState !== 'ready' || root.document.hidden || !visible || frameId !== null) return;
            lastTime = null;
            frameId = root.requestAnimationFrame(frame);
        }
        function stopFrames() {
            if (frameId !== null) root.cancelAnimationFrame(frameId);
            frameId = null; lastTime = null;
        }
        function move(event) {
            if (event.pointerType === 'touch' || reduced.matches) return;
            pointer = {x:event.clientX,y:event.clientY};
        }
        function centre() { pointer = null; }
        function pointerOut(event) { if (!event.relatedTarget) centre(); }
        function visibility() {
            centre();
            if (root.document.hidden) { setSpeaking(false); stopFrames(); }
            else wake();
        }
        function motionPreference() { centre(); gaze.x = gaze.y = 0; }
        function unlockAudio() {
            if (disposed) return;
            var Constructor = root.AudioContext || root.webkitAudioContext;
            if (!Constructor) return;
            try {
                context = context || new Constructor();
                if (context.state === 'suspended') context.resume().catch(function () {});
            } catch (_) { /* Speech remains available through its existing media path. */ }
        }
        /** Attach an optional running-context analyser to a local speech element.
         * Returns an idempotent detach callback. Suspended audio uses rhythmic lips. */
        function attachAudio(audio) {
            if (disposed || !context || context.state !== 'running') return;
            if (audioTap) audioTap.detach();
            var source, analyser;
            try {
                analyser = context.createAnalyser(); analyser.fftSize = 1024;
                source = context.createMediaElementSource(audio);
                // Keep playback connected even if the analysis branch fails.
                source.connect(context.destination); source.connect(analyser);
            } catch (_) { return; }
            var tap = {analyser:analyser,waveform:new Float32Array(analyser.fftSize),detached:false,
                detach:function () {
                    if (tap.detached) return;
                    tap.detached = true;
                    source.disconnect(); analyser.disconnect();
                    if (audioTap === tap) { audioTap = null; mouthLevel = 0; }
                }};
            audioTap = tap;
            return tap.detach;
        }
        /** Only real start/resume events open the mouth. Stops close it immediately. */
        function setSpeaking(value) {
            if (disposed) return;
            speaking = !!value;
            speechTime = 0;
            if (!speaking) {
                mouthLevel = 0;
                parameters.mouthOpen = 0;
                if (model) { model.setParameters(parameters); model.advance(0,60); }
            }
        }
        function staticPortrait() {
            stopFrames();
            canvas.hidden = true; fallback.hidden = false;
            canvas.dataset.avatarState = 'static';
        }
        function contextLost(event) {
            if (event.target !== canvas) return;
            event.preventDefault(); staticPortrait();
            if (model) { model.destroy(); model = null; }
        }
        root.document.addEventListener('pointermove',move,{passive:true});
        root.document.addEventListener('pointerleave',centre);
        root.document.addEventListener('pointerout',pointerOut);
        root.addEventListener('blur',centre);
        root.document.addEventListener('visibilitychange',visibility);
        root.document.addEventListener('pointerdown',unlockAudio,{passive:true});
        root.document.addEventListener('keydown',unlockAudio);
        if (reduced.addEventListener) reduced.addEventListener('change',motionPreference);
        if (root.IntersectionObserver) {
            observer = new root.IntersectionObserver(function (entries) {
                var entry = entries.find(function (item) { return item.target === canvas; });
                if (!entry) return;
                visible = entry.isIntersecting;
                if (visible) wake(); else stopFrames();
            });
        }
        /** REQ-064. Prepare a replacement offscreen, then commit only the newest choice.
         * The stable controller retains live speech and audio analysis across outfits.
         * Failure preserves the active model. Initial GPU failure uses its portrait. */
        async function loadModel(id, nextAction) {
            var nextPose = root.CampusAvatarActions.profile(nextAction).pose;
            if (disposed) return false;
            if (model && id === appearance && pose === nextPose) {
                loadVersion++; if (abort) abort.abort(); loading = false;
                action = nextAction; actionTime = 0; canvas.dataset.avatarAction = action;
                render(0); emit(); return true;
            }
            var own = ++loadVersion, candidate = null, loaded = null, portraitReady = false;
            if (abort) abort.abort();
            abort = new root.AbortController();
            var signal = abort.signal, base = nextPose === 'idle' ? ASSET_BASE + id + '/' : ACTION_BASE + id + '/' + nextPose + '/';
            loading = true; emit();
            try {
                var portrait = new root.Image(); portrait.src = base + 'source.png';
                await portrait.decode(); portraitReady = true;
                if (disposed || own !== loadVersion) return false;
                if (!root.MeshAvatar) throw new Error('runtime-unavailable');
                var response = await root.fetch(base + 'rig.json',{signal:signal});
                if (!response.ok) throw new Error('rig-unavailable');
                var rig = await response.json();
                if (disposed || own !== loadVersion) return false;
                if (nextPose === 'idle') {
                    rig.head.maxRoll = .045; rig.head.shiftX = 18; rig.body.maxRoll = .035;
                    rig.appendages = [
                        {name:'left-rear-wing',kind:'ear',outline:[[353,790],[468,789],[442,1088],[325,980]],pivot:[433,795],tip:[376,1050],amplitude:.055,period:3.8,feather:16},
                        {name:'right-rear-wing',kind:'ear',outline:[[780,790],[899,790],[922,980],[810,1090]],pivot:[815,795],tip:[870,1050],amplitude:-.055,period:3.8,phase:.2,feather:16}
                    ];
                }
                candidate = root.document.createElement('canvas');
                candidate.className = 'character-canvas appearance-pending';
                candidate.setAttribute('aria-hidden','true');
                canvas.parentElement.appendChild(candidate);
                loaded = await root.MeshAvatar.createMeshAvatar(candidate,{rig:rig,assetsBase:base + 'built/',manual:true,padTop:0.025,padSide:0.025});
                if (disposed || own !== loadVersion) return false;
                loaded.setAutoIdle(false); loaded.setAutoMotion(false); loaded.setAppendageGain(0.4);
                stopFrames();
                var previousCanvas = canvas, previousModel = model;
                if (observer) observer.unobserve(previousCanvas);
                previousCanvas.removeEventListener('webglcontextlost',contextLost);
                candidate.id = previousCanvas.id;
                candidate.setAttribute('role','img');
                candidate.setAttribute('aria-label',previousCanvas.getAttribute('aria-label'));
                candidate.removeAttribute('aria-hidden');
                candidate.className = 'character-canvas character-arriving';
                previousCanvas.replaceWith(candidate);
                canvas = candidate; candidate = null; model = loaded; loaded = null;
                faceCentre = {x:(rig.face.eyeA.cx + rig.face.eyeB.cx) / 2,y:(rig.face.eyeA.cy + rig.face.eyeB.cy) / 2};
                canvas.addEventListener('webglcontextlost',contextLost);
                canvas.hidden = false; fallback.hidden = true; canvas.dataset.avatarState = 'ready';
                canvas.dataset.appearance = id;
                fallback.setAttribute('src',base + 'source.png');
                appearance = id; visible = true;
                action = nextAction; pose = nextPose; actionTime = 0; canvas.dataset.avatarAction = action;
                if (observer) observer.observe(canvas);
                render(1 / 60); wake();
                if (previousModel) previousModel.destroy();
                remember(id);
                return true;
            } catch (_) {
                if (!disposed && own === loadVersion && !model) {
                    if (portraitReady) {
                        fallback.setAttribute('src',base + 'source.png'); appearance = id; action = nextAction; pose = nextPose;
                        canvas.dataset.avatarAction = action;
                        canvas.dataset.appearance = id; remember(id);
                    }
                    staticPortrait();
                    return portraitReady;
                }
                if (!disposed && own === loadVersion) { desiredAppearance = appearance; desiredAction = action; }
                return false;
            } finally {
                if (loaded) loaded.destroy();
                if (candidate) candidate.remove();
                if (own === loadVersion) { loading = false; emit(); }
            }
        }
        function setAppearance(id) {
            if (!knownAppearance(id)) return Promise.resolve(false);
            desiredAppearance = id;
            return loadModel(id,desiredAction);
        }
        function setAction(id) {
            if (!root.CampusAvatarActions.profile(id)) return Promise.resolve(false);
            desiredAction = id;
            return loadModel(desiredAppearance,id);
        }
        canvas.dataset.avatarState = 'loading';
        fallback.setAttribute('src',ASSET_BASE + appearance + '/source.png');
        var ready = setAppearance(appearance);
        return {ready:ready,setSpeaking:setSpeaking,attachAudio:attachAudio,setAppearance:setAppearance,setAction:setAction,
            getAppearances:function () { return APPEARANCES.map(function (item) { return {id:item.id,label:item.label,portrait:ASSET_BASE + item.id + '/source.png'}; }); },
            getState:getState,
            destroy:function () {
                if (disposed) return;
                setSpeaking(false); disposed = true; loadVersion++; if (abort) abort.abort(); stopFrames();
                if (observer) observer.disconnect();
                if (audioTap) audioTap.detach();
                if (context) context.close().catch(function () {});
                if (model) model.destroy();
                root.document.removeEventListener('pointermove',move);
                root.document.removeEventListener('pointerleave',centre);
                root.document.removeEventListener('pointerout',pointerOut);
                root.removeEventListener('blur',centre);
                root.document.removeEventListener('visibilitychange',visibility);
                root.document.removeEventListener('pointerdown',unlockAudio);
                root.document.removeEventListener('keydown',unlockAudio);
                if (reduced.removeEventListener) reduced.removeEventListener('change',motionPreference);
                canvas.removeEventListener('webglcontextlost',contextLost);
            }};
    }
    root.CampusAvatar = {create:create};
})(window);
