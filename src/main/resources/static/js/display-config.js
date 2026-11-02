// REQ-038 / API-038: safe public fields, bounded loading and theme tokens.
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.GuideDisplayConfig = factory();
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';
    var DEFAULTS = { name: '灵灵',
        welcomeMessage: '阿弥陀佛！我是您的AI导游灵灵，欢迎来到灵山胜境，愿您在此感悟灵山，吉祥平安！',
        primaryColor: '#c8963e' };

    /** REQ-038: detached per-field defaults, without interpreting HTML or voice settings.
     * Text/color validation and fallback policy: docs/display_config.md.
     */
    function normalize(raw) {
        raw = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        var out = Object.assign({}, DEFAULTS);
        ['name', 'welcomeMessage'].forEach(function(key) {
            var value = raw[key];
            if (typeof value !== 'string') return;
            value = value.trim();
            var controls = key === 'name' ? /[\u0000-\u001f\u007f-\u009f]/ : /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/;
            if (value && value.length <= (key === 'name' ? 40 : 500) && !controls.test(value)) out[key] = value;
        });
        if (typeof raw.primaryColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.primaryColor)) out.primaryColor = raw.primaryColor.toLowerCase();
        return out;
    }

    /** REQ-038: theme colors and contrasting foreground from a validated six-digit hex.
     * Dark surfaces use at most RGB102, retaining readable labels for light themes.
     */
    function palette(color) {
        var rgb = color.slice(1).match(/../g).map(function(x) { return parseInt(x, 16); });
        function hex(values) { return '#' + values.map(function(c) { return Math.round(c).toString(16).padStart(2, '0'); }).join(''); }
        var dark = hex(rgb.map(function(c) { return c * 0.4; }));
        var linear = rgb.map(function(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
        var l = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
        return { '--primary': color, '--primary-dark': dark, '--primary-light': hex(rgb.map(function(c) { return c * 0.08 + 255 * 0.92; })),
            '--primary-text': dark, '--on-primary': (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#000000' : '#ffffff' };
    }

    /** REQ-038: defaults immediately, then one public read with a 5000ms JSON-inclusive
     * deadline. Inject document/fetch/canUpdateWelcome and optional timer/abort hooks.
     * stop() aborts and fences late data. See docs/display_config.md.
     */
    function load(options) {
        var doc = options.document, schedule = options.setTimeout || setTimeout;
        var clear = options.clearTimeout || clearTimeout, active = true, timer;
        var Abort = options.AbortController || (typeof AbortController !== 'undefined' ? AbortController : null);
        var controller = Abort ? new Abort() : null;
        function apply(config) {
            var label = doc.querySelector('.live2d-label'), header = doc.getElementById('chatHeaderName');
            if (label) label.textContent = 'AI导游' + config.name;
            if (header) header.textContent = 'AI导游' + config.name;
            var welcome = doc.getElementById('chatWelcome');
            if (welcome && options.canUpdateWelcome()) welcome.textContent = config.welcomeMessage;
            var tokens = palette(config.primaryColor);
            Object.keys(tokens).forEach(function(key) { doc.documentElement.style.setProperty(key, tokens[key]); });
        }
        function stop() {
            if (!active) return;
            active = false; clear(timer);
            if (controller) controller.abort();
        }
        apply(normalize(null));
        timer = schedule(stop, 5000);
        var done = Promise.resolve().then(function() {
            if (!active) return null;
            return options.fetch('/api/digital-human-config', {signal: controller && controller.signal});
        }).then(function(response) {
            if (!active) return null;
            if (!response || !response.ok) throw new Error('Public config unavailable');
            return response.json();
        }).then(function(raw) {
            if (!active) return;
            active = false; clear(timer); apply(normalize(raw));
        }).catch(function() { stop(); });
        return {stop:stop, done:done};
    }
    return {normalize:normalize, palette:palette, load:load};
});
