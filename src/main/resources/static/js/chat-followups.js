/* REQ-049: editable, station-bound follow-up questions. docs/followups_design.md. */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.GuideChatFollowups = factory();
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    var questions = [
        {label: '抓重点', prompt: '请把核心看点压缩为三句，方便我边走边听。'},
        {label: '换个生活比喻', prompt: '请用一个生活中的比喻解释最有代表性的看点，并区分比喻与史实。'},
        {label: '带我看一个细节', prompt: '请给出一个可在现场留意的细节，并说明怎样观察；资料不足时请说明。'}
    ];

    /** Append a collapsed follow-up card for a validated spot, or return null.
     * Inputs: DOM document/parent, spot {id,name}, prepare(text,spotId) callback.
     * The callback returns {accepted,reason}; it owns chat guards and context changes.
     * Names are snapshotted and rendered as text. No I/O, auto-send or mode change.
     * Invalid spots are ignored; DOM/callback errors propagate to the caller.
     * REQ-049 / docs/followups_design.md. Edit question templates above.
     */
    function append(doc, parent, spot, prepare) {
        if (!spot || !Number.isSafeInteger(spot.id) || spot.id <= 0 ||
            typeof spot.name !== 'string' || !spot.name.trim() || spot.name.length > 200) return null;

        var spotId = spot.id, spotName = spot.name;
        var card = doc.createElement('details');
        card.className = 'chat-followups';
        var summary = doc.createElement('summary');
        summary.textContent = '继续了解 ' + spotName;
        card.appendChild(summary);
        var hint = doc.createElement('p');
        hint.textContent = '选一个方向准备问题，确认后发送。';
        card.appendChild(hint);
        var actions = doc.createElement('div');
        actions.className = 'chat-followup-actions';
        var status = doc.createElement('p');
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        questions.forEach(function(question) {
            var button = doc.createElement('button');
            button.type = 'button';
            button.textContent = question.label;
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                var result = prepare('关于【' + spotName + '】，' + question.prompt, spotId);
                status.textContent = result.accepted ? '已准备 ' + spotName + ' 的问题，请确认后发送。' : result.reason;
            });
            actions.appendChild(button);
        });
        card.appendChild(actions);
        card.appendChild(status);
        parent.appendChild(card);
        return card;
    }
    return {append: append};
});
