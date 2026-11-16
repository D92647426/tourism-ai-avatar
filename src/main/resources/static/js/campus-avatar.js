/* REQ-062: RuiC-2D character, pointer gaze and truthful speech-driven mouth.
 * Integration and asset provenance: docs/campus_avatar.md. */
(function (root) {
    'use strict';
    var ASSET_BASE = '/media/campus/yanxiaobei-avatar/';
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
        var abort = new root.AbortController();
        var reduced = root.matchMedia('(prefers-reduced-motion: reduce)');

        function render(delta) {
            var moving = !reduced.matches;
            elapsed += delta;
            speechTime += delta;
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
                gazeX:moving ? gaze.x * 0.8 : 0, gazeY:moving ? gaze.y * 0.65 : 0,
                angleX:moving ? gaze.x * 7 : 0,
                angleY:moving ? gaze.y * 3 + (speaking ? Math.sin(speechTime * 4) * 0.7 : 0) : 0,
                angleZ:moving ? Math.sin(elapsed * 0.55) * 0.35 : 0,
                bodyAngleZ:moving ? Math.sin(elapsed * 0.42) * 0.15 : 0,
                breath:moving ? (Math.sin(elapsed * 1.25) + 1) * 0.12 : 0,
                eyeLOpen:eyeOpen,eyeROpen:eyeOpen,mouthOpen:mouthLevel,
                mouthForm:speaking && !audioTap ? [0,-0.8,0.5,0.9][Math.floor(speechTime * 2.4) % 4] : 0
            };
            model.setSwayGain(moving ? 0.28 : 0);
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
        canvas.addEventListener('webglcontextlost',contextLost);
        canvas.dataset.avatarState = 'loading';
        var ready = (async function () {
            try {
                if (!root.MeshAvatar) throw new Error('runtime-unavailable');
                var response = await root.fetch(ASSET_BASE + 'rig.json',{signal:abort.signal});
                if (!response.ok) throw new Error('rig-unavailable');
                var rig = await response.json();
                if (disposed) return false;
                faceCentre = {x:(rig.face.eyeA.cx + rig.face.eyeB.cx) / 2,y:(rig.face.eyeA.cy + rig.face.eyeB.cy) / 2};
                var loaded = await root.MeshAvatar.createMeshAvatar(canvas,{rig:rig,assetsBase:ASSET_BASE + 'built/',manual:true,padTop:0.035,padSide:0.035});
                if (disposed) { loaded.destroy(); return false; }
                model = loaded; model.setAutoIdle(false); model.setAutoMotion(false); model.setAppendageGain(0.4);
                canvas.hidden = false; fallback.hidden = true; canvas.dataset.avatarState = 'ready';
                if (root.IntersectionObserver) {
                    observer = new root.IntersectionObserver(function (entries) {
                        visible = entries[0].isIntersecting;
                        if (visible) wake(); else stopFrames();
                    });
                    observer.observe(canvas);
                }
                render(1 / 60); wake();
                return true;
            } catch (_) {
                if (!disposed) staticPortrait();
                return false;
            }
        })();
        return {ready:ready,setSpeaking:setSpeaking,attachAudio:attachAudio,
            getState:function () { return {ready:!!model && canvas.dataset.avatarState === 'ready',speaking:speaking,parameters:Object.assign({},parameters)}; },
            destroy:function () {
                if (disposed) return;
                setSpeaking(false); disposed = true; abort.abort(); stopFrames();
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
