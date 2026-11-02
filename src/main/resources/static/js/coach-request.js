/* REQ-033: immutable coach requests with the existing deadline/cancellation rules. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./chat-request.js'));
    else root.GuideCoachRequest = factory(root.GuideChatRequest);
})(typeof window !== 'undefined' ? window : globalThis, function (requests) {
    'use strict';
    function invalid() { var error = new Error('讲解建议格式有误'); error.chatReason = 'invalid-response'; throw error; }
    function boundedText(value, max) { return typeof value === 'string' && value.trim() && value.length <= max; }
    /** REQ-033: validate feedback against its exact source snapshot before rendering.
     * Input: untrusted parsed response and accepted request; output: detached fields.
     * Throws invalid-response on missing fields, false mode or changed sources.
     * Change response contract here; docs/exploration_coach_design.md API-033.
     */
    function validate(result, context) {
        if (!result || !boundedText(result.reply, 2400) || !boundedText(result.followUp, 160) || !boundedText(result.notice, 600)) invalid();
        if (result.mode !== 'local-coach' && result.mode !== 'model-coach') invalid();
        if (result.fallback !== (result.mode === 'local-coach')) invalid();
        var source = result.source, expected = context.task.source;
        if (result.reference !== context.task.reference || !source || source.title !== expected.title || source.url !== expected.url || source.status !== expected.status) invalid();
        return { reply: result.reply, followUp: result.followUp, notice: result.notice, mode: result.mode, fallback: result.fallback,
            reference: result.reference, source: { title: source.title, url: source.url, status: source.status } };
    }
    /** REQ-033: create a coach client; context is serialized before async dispatch.
     * options.transport(bodyString, signal) returns a Response Promise; callbacks and
     * optional fake timers follow GuideChatRequest. Returns send/cancel/isPending.
     * TypeError for missing transport; context must be JSON-serializable and valid.
     * Validation lives in exploration-core.js and on the server. No automatic retry.
     * Change request policy here; see docs/exploration_coach_design.md.
     */
    function create(options) {
        if (!options || typeof options.transport !== 'function') throw new TypeError('transport is required');
        var lifecycle = requests.create({
            timeoutMs: 20000, setTimeout: options.setTimeout, clearTimeout: options.clearTimeout,
            onState: options.onState, onSuccess: options.onSuccess,
            request: function (payload, signal) {
                var context = JSON.parse(payload.message);
                return Promise.resolve(options.transport(payload.message, signal)).then(function (response) {
                    if (!response || !response.ok) return response;
                    return { ok: true, json: function () { return response.json().then(function (data) { return validate(data, context); }); } };
                });
            }
        });
        return {
            send: function (context) { return lifecycle.isPending() ? false : lifecycle.send({ message: JSON.stringify(context) }); },
            cancel: lifecycle.cancel,
            isPending: lifecycle.isPending
        };
    }
    return { create: create };
});
