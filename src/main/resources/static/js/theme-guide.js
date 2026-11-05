/* REQ-052: page-local theme receipt and recap. See docs/superpowers/specs/2026-11-05-theme-guide-design.md. */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.GuideThemePage = factory();
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    /** Validate a theme against actual API spots, returning a detached view.
     * Invalid data throws TypeError before the current plan changes. No I/O.
     * Limits bound public response rendering; adjust with TEST-052 and the design.
     */
    function validate(theme, spots) {
        function text(value, max) {
            if (typeof value !== 'string' || !value.trim() || value.length > max) throw new TypeError('主题资料无效，请使用普通游览方案。');
            return value;
        }
        if (!theme || typeof theme.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(theme.id) || !Array.isArray(theme.stops) || theme.stops.length !== 3) throw new TypeError('主题站点无效，请使用普通游览方案。');
        var ids = new Set();
        return {id: theme.id, title: text(theme.title, 200), question: text(theme.question, 500), notice: text(theme.notice, 2000),
            stops: theme.stops.map(function(stop) {
                if (!stop || !Number.isSafeInteger(stop.spotId) || stop.spotId <= 0 || ids.has(stop.spotId) ||
                    !spots.some(function(spot) { return spot.id === stop.spotId && spot.name === stop.name; })) throw new TypeError('主题景点暂不可用，请使用普通游览方案。');
                ids.add(stop.spotId);
                return {spotId: stop.spotId, name: text(stop.name, 200), focus: text(stop.focus, 200),
                    question: text(stop.question, 500), bridge: text(stop.bridge, 2000), recap: text(stop.recap, 500)};
            })};
    }

    /** Mount catalog and transient receipt tracking once after spots/director load.
     * Inputs: window and current spots. Returns sync/success/reset/caption.
     * Only matching successful lecture responses count, never drafts or visits.
     * Fetch/data errors become visible feedback; no storage or automatic chat send.
     */
    function mount(win, spots) {
        var doc = win.document, $ = function(id) { return doc.getElementById(id); };
        var theme = null, revision = null, received = new Set();
        function current() { return win.GuideTour ? win.GuideTour.snapshot() : {}; }
        function active() { return theme && current().themeId === theme.id; }
        function render() {
            $('themeRecap').replaceChildren();
            $('themeProgress').textContent = active() ? '本轮已收到 ' + received.size + ' / ' + theme.stops.length + ' 站主题讲解' : '选择主题后，成功收到的讲解会进入本轮回顾。';
            if (!active()) return;
            theme.stops.forEach(function(stop) {
                if (!received.has(stop.spotId)) return;
                var item = doc.createElement('li'); item.textContent = stop.name + ' · ' + stop.focus + '——' + stop.recap;
                $('themeRecap').appendChild(item);
            });
        }
        function sync() {
            var state = current();
            if (state.revision !== revision) { revision = state.revision; received.clear(); }
            render();
        }
        $('themeUseBtn').disabled = true;
        $('themeUseBtn').addEventListener('click', function() {
            if (!theme || !win.GuideDirectorView) return;
            win.GuideDirectorView.showTheme(theme);
            $('themeStatus').textContent = '主题线已放入游览方案。请选择一站，准备并确认发送讲解。原草稿会保留。';
        });
        win.fetch('/api/themes').then(function(response) {
            if (!response.ok) throw new Error('主题目录读取失败，请稍后刷新。');
            return response.json();
        }).then(function(data) {
            if (!Array.isArray(data) || !data.length) throw new Error('主题所需景点暂不可用，普通导览仍可使用。');
            theme = validate(data[0], spots);
            $('themeTitle').textContent = theme.title; $('themeQuestion').textContent = theme.question;
            $('themeStatus').textContent = theme.notice; $('themeUseBtn').disabled = false; sync();
        }).catch(function(error) { $('themeStatus').textContent = error.message; });
        render();
        return {
            sync: sync,
            success: function(response) {
                if (!active() || !response || response.themeId !== theme.id || response.themeLecture !== true ||
                    typeof response.reply !== 'string' || !response.reply.trim() ||
                    !theme.stops.some(function(stop) { return stop.spotId === response.spotId; })) return;
                received.add(response.spotId); render();
            },
            reset: function() { received.clear(); render(); },
            caption: function(spotId) {
                if (!active()) return '';
                var stop = theme.stops.find(function(item) { return item.spotId === spotId; });
                return stop ? '主题线索为' + stop.focus + '。' + stop.question : '';
            }
        };
    }
    return {mount: mount, validate: validate};
});
