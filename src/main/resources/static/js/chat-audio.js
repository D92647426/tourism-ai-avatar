/* REQ-051: replay an answer or one original paragraph. docs/segmented_audio_design.md. */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.GuideAudioCard = factory();
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    /** Split original text at blank lines, merging all overflow into the twelfth part.
     * Input: answer string; output: detached strings, empty for invalid/blank input.
     * No I/O/errors. Keep the cap and TEST-051 in sync when changing segmentation.
     */
    function paragraphs(text) {
        if (typeof text !== 'string' || !text.trim()) return [];
        var parts = text.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/);
        if (parts.length > 12) parts = parts.slice(0, 11).concat(parts.slice(11).join('\n\n'));
        return parts;
    }

    /** Append safe replay controls and return {render}, or null for empty text.
     * Inputs: DOM document/parent, answer snapshot, play(text,card,index)/stop(card).
     * Play returns accepted/reason. Caller owns speech, guards and state events.
     * render(state,index) marks only queued/speaking/paused as active; -1 is full text.
     * No network/storage. DOM/callback errors propagate. REQ-051 design document above.
     */
    function append(doc, parent, text, callbacks) {
        var parts = paragraphs(text);
        if (!parts.length) return null;
        var card = doc.createElement('details'); card.className = 'chat-audio';
        var summary = doc.createElement('summary'); summary.textContent = '按段听讲解'; card.appendChild(summary);
        var actions = doc.createElement('div'); actions.className = 'chat-audio-actions';
        var status = doc.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
        var buttons = [];
        var handle = {render: function(state, index) {
            var active = ['queued', 'speaking', 'paused'].indexOf(state.status) !== -1;
            buttons.forEach(function(item) { item.button.setAttribute('aria-pressed', String(active && item.index === index)); });
            stop.disabled = !active;
            var target = index === -1 ? '全文' : '第 ' + (index + 1) + ' 段';
            var labels = {queued: '正在准备声音', speaking: '正在播放', paused: '播报已暂停', idle: '本条播报已结束或停止'};
            status.textContent = state.message || ((labels[state.status] || '播报失败') + (active ? ' · ' + target : ''));
        }};
        function playButton(label, value, index) {
            var button = doc.createElement('button'); button.type = 'button'; button.textContent = label;
            button.setAttribute('aria-pressed', 'false');
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                var result = callbacks.play(value, handle, index);
                if (!result.accepted) status.textContent = result.reason;
            });
            buttons.push({button: button, index: index});
            return button;
        }
        actions.appendChild(playButton('重听全文', text, -1));
        var stop = doc.createElement('button'); stop.type = 'button'; stop.textContent = '停止本条播报'; stop.disabled = true;
        stop.addEventListener('click', function(event) { event.stopPropagation(); callbacks.stop(handle); });
        actions.appendChild(stop); card.appendChild(actions);
        if (parts.length > 1) {
            var list = doc.createElement('ol');
            parts.forEach(function(part, index) {
                var row = doc.createElement('li');
                var preview = Array.from(part.replace(/\s+/g, ' ').trim()).slice(0, 44).join('');
                row.appendChild(playButton('听第 ' + (index + 1) + ' 段 · ' + preview, part, index)); list.appendChild(row);
            });
            card.appendChild(list);
        }
        status.textContent = '选择想听的内容，播放后可随时停止。'; card.appendChild(status);
        parent.appendChild(card);
        return handle;
    }
    return {paragraphs: paragraphs, append: append};
});
