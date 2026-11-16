/* REQ-065: contextual poses, expressions and bounded whole-body motion.
 * Selection and lifecycle documentation: docs/avatar_actions.md. */
(function (root) {
    'use strict';
    var PROFILES = {
        idle:{label:'自然待机',pose:'idle'}, study:{label:'桌前学习',pose:'study'},
        dining:{label:'端碗吃饭',pose:'dining'}, thinking:{label:'托腮思考',pose:'thinking'},
        hungry:{label:'馋嘴期待',pose:'hungry'}, happy:{label:'雀跃回应',pose:'idle'},
        confused:{label:'疑惑提醒',pose:'idle'}
    };
    function profile(id) { return Object.prototype.hasOwnProperty.call(PROFILES,id) ? PROFILES[id] : null; }
    /** Classify explicit user language. Negated activities do not trigger props.
     * Returns a known action id or null. REQ-065, offline and model paths share it. */
    function classify(message) {
        var text = String(message || '').trim();
        if (/^(?:停止动作|恢复待机|回到待机|取消动作|恢复默认)[。！!\s]*$/.test(text)) return 'idle';
        var original = text;
        text = text.replace(/(?:不想|不要|不去|不用|别|不)(?:再|去|想)?(?:学习|自习|看书|图书馆|吃饭|食堂|用餐|吃面|吃东西)/g,'');
        if (/饿了|好饿|肚子饿|馋|流口水|想吃/.test(text)) return 'hungry';
        if (/食堂|餐厅|吃饭|吃面|用餐|早餐|午餐|晚餐|美食|吃什么|饭点/.test(text)) return 'dining';
        if (/图书馆|学习|自习|读书|看书|课本|作业|复习|电脑/.test(text)) return 'study';
        if (/谢谢|感谢|真棒|太好了|成功|完成了|好耶/.test(text)) return 'happy';
        if (/找不到|迷路|不懂|不会|怎么办|没听懂/.test(text)) return 'confused';
        if (/想一想|思考|考虑一下|怎么选/.test(text)) return 'thinking';
        return original !== text ? 'idle' : null;
    }
    /** Resolve completed scene semantics without treating old assistant text as intent. */
    function fromTurn(turn, message, catalog) {
        var direct = classify(message);
        if (direct) return direct;
        var action = turn && turn.sceneAction || {};
        if (action.type === 'SHOW_DINING') return 'dining';
        var places = catalog && catalog.places || [];
        var ids = action.placeIds || [];
        var selected = places.filter(function (place) { return ids.includes(place.id); });
        if (selected.some(function (place) { return /dining|restaurant|canteen/.test(place.id); })) return 'dining';
        if (selected.some(function (place) { return /library/.test(place.id); })) return 'study';
        return action.type === 'KEEP_SCENE' ? null : 'idle';
    }
    /** Sample deterministic bounded action motion, independent of the display rate.
     * Speech mouth values are deliberately owned by CampusAvatar. */
    function sample(id, time) {
        var wave = Math.sin(time * 2.2), beat = Math.sin(time * 5);
        var frame = {pitch:0,roll:0,body:0,lift:0,eyeL:1,eyeR:1,smile:0,brow:0,browAngle:0,blush:0,gazeY:0};
        if (id === 'study') { frame.pitch = -3 + beat * .5; frame.eyeL = frame.eyeR = .92; frame.gazeY = -.18; }
        if (id === 'dining') { frame.pitch = -1 + wave * 1.7; frame.roll = wave * .7; frame.body = wave * .5; frame.blush = .16; }
        if (id === 'thinking') { frame.roll = -2.5 + wave * .5; frame.eyeL = frame.eyeR = .83; frame.brow = .3; frame.gazeY = .12; }
        if (id === 'hungry') { frame.body = beat * .7; frame.lift = -Math.abs(beat) * 2; frame.eyeL = frame.eyeR = 1.05; frame.blush = .32; frame.brow = .2; }
        if (id === 'happy') { frame.lift = -Math.abs(beat) * 7; frame.roll = wave * 1.7; frame.eyeL = beat > .7 ? .15 : 1; frame.smile = .8; frame.blush = .28; }
        if (id === 'confused') { frame.roll = -3 + wave * .45; frame.brow = .4; frame.browAngle = -.4; frame.eyeL = frame.eyeR = .9; }
        return frame;
    }
    /** Own contextual/preview state and invalidate timers on every conversation boundary.
     * A preview lasts eight seconds and is superseded by a new request. */
    function create(options) {
        var avatar = options.avatar, byId = function (id) { return root.document.getElementById(id); };
        var automatic = true, contextAction = 'idle', preview = null, timer = null, disposed = false;
        var buttons = [], pendingAction = 'idle', operation = 0;
        function refresh() {
            if (disposed) return;
            var state = avatar.getState(), item = profile(state.action) || profile('idle');
            byId('actionAutoToggle').setAttribute('aria-pressed',String(automatic));
            buttons.forEach(function (button) { button.setAttribute('aria-pressed',String(button.dataset.action === state.action)); });
            byId('actionStatus').textContent = state.loading ? '正在准备' + (profile(state.requestedAction) || item).label + '…'
                : item.label + (preview ? ' · 手动预览' : automatic ? ' · 跟随对话' : ' · 自动动作已暂停');
        }
        function clearPreview() { root.clearTimeout(timer); timer = null; preview = null; }
        async function apply(id) {
            if (disposed) return false;
            var own = ++operation; pendingAction = id;
            var work = avatar.setAction(id); refresh();
            var success = await work;
            if (disposed || own !== operation) return false;
            refresh();
            var state = avatar.getState();
            if (!success && !state.loading && state.action !== id) byId('actionStatus').textContent = '动作暂未载入，保留当前姿态。可再点一次重试。';
            return success;
        }
        function begin(message) {
            clearPreview(); var direct = classify(message);
            if (direct) contextAction = direct;
            if (automatic) apply(direct || 'thinking');
        }
        function complete(turn, message) {
            var next = fromTurn(turn,message,options.getCatalog());
            if (next) contextAction = next;
            if (automatic && !preview && pendingAction !== contextAction) apply(contextAction);
        }
        function reset() { clearPreview(); contextAction = 'idle'; apply('idle'); }
        function failed() { clearPreview(); contextAction = 'confused'; if (automatic) apply('confused'); }
        function previewAction(id) {
            clearPreview(); preview = id;
            apply(id).then(function (success) {
                if (success && !disposed && preview === id && root.matchMedia('(max-width: 650px)').matches) options.closePanel(true);
            });
            timer = root.setTimeout(function () { preview = null; timer = null; apply(automatic ? contextAction : 'idle'); },8000);
        }
        Object.keys(PROFILES).forEach(function (id) {
            var button = root.document.createElement('button'); button.type = 'button';
            button.dataset.action = id; button.textContent = PROFILES[id].label;
            button.addEventListener('click',function () { previewAction(id); });
            byId('actionChoices').appendChild(button); buttons.push(button);
        });
        function toggle() { automatic = !automatic; clearPreview(); apply(automatic ? contextAction : 'idle'); refresh(); }
        function visibility() { if (root.document.hidden && preview) { clearPreview(); apply(automatic ? contextAction : 'idle'); } }
        byId('actionAutoToggle').addEventListener('click',toggle);
        root.document.addEventListener('visibilitychange',visibility);
        refresh();
        return {begin:begin,complete:complete,reset:reset,failed:failed,refresh:refresh,
            destroy:function () { disposed = true; operation++; clearPreview(); byId('actionAutoToggle').removeEventListener('click',toggle); root.document.removeEventListener('visibilitychange',visibility); }};
    }
    root.CampusAvatarActions = {profile:profile,classify:classify,fromTurn:fromTurn,sample:sample,create:create};
})(window);
