// REQ-031 / #6: one logical request, including response-body parsing, at a time.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.GuideChatRequest = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    /**
     * REQ-031: create a single-request lifecycle with a total response deadline.
     * @param {Object} options request(payload, signal) returns a Promise of a
     * response with ok and json(); optional onStart(payload, isRetry),
     * onState(state), onSuccess(result), timeoutMs (default 30000) and timer hooks.
     * Callbacks run synchronously and must not throw. Payload fields are scalar.
     * @returns {Object} send/retry/cancel return acceptance booleans;
     * isPending returns a boolean and getState returns a detached state snapshot.
     * @throws {TypeError} If request is missing or is not a function.
     * @throws {RangeError} If timeoutMs is not finite and positive.
     * Change lifecycle policy here; DOM/voice adapters live in main.js.
     * @see ../../../../../docs/chat_reliability.md (REQ-031 and integration contract)
     */
    function create(options) {
        if (!options || typeof options.request !== 'function') throw new TypeError('request is required');
        var timeoutMs = options.timeoutMs === undefined ? 30000 : options.timeoutMs;
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('Invalid timeout');
        var schedule = options.setTimeout || setTimeout;
        var unschedule = options.clearTimeout || clearTimeout;
        var active = null, retryPayload = null;
        var state = { status: 'idle', canRetry: false };

        function publish(status, reason) {
            state = { status: status, reason: reason || '', canRetry: !!retryPayload && !active };
            if (options.onState) options.onState(Object.assign({}, state));
        }

        /** REQ-031: settle only the current request; obsolete identities are ignored.
         * Inputs: request identity, optional failure reason and parsed result.
         * Returns nothing; transport errors become state, not thrown exceptions.
         * Policy and callback contract: docs/chat_reliability.md; change cleanup here.
         */
        function finish(request, reason, result) {
            if (active !== request) return;
            active = null;
            unschedule(request.timer);
            if (reason === 'timeout' || reason === 'cancelled') {
                if (request.controller) request.controller.abort();
            }
            retryPayload = reason ? request.payload : null;
            publish(reason === 'cancelled' ? 'cancelled' : reason ? 'failed' : 'succeeded', reason);
            if (!reason && options.onSuccess) options.onSuccess(result);
        }

        /** REQ-031: accept a scalar payload snapshot unless empty or already busy.
         * Returns acceptance; async transport/parse errors are handled by finish.
         * isRetry controls user-bubble reuse; callback contract is documented above.
         * See docs/chat_reliability.md; change dispatch/deadline ordering here.
         */
        function begin(payload, isRetry) {
            if (active || !payload || typeof payload.message !== 'string' || !payload.message.trim()) return false;
            // Values in the existing API are scalar; callers cannot mutate a retry snapshot.
            var request = { payload: Object.assign({}, payload), controller: null, timer: null };
            if (typeof AbortController !== 'undefined') request.controller = new AbortController();
            active = request;
            retryPayload = null;
            request.timer = schedule(function () { finish(request, 'timeout'); }, timeoutMs);
            if (options.onStart) options.onStart(Object.assign({}, request.payload), !!isRetry);
            if (active === request) publish('pending');

            Promise.resolve().then(function () {
                if (active !== request) return null;
                return options.request(Object.assign({}, request.payload), request.controller && request.controller.signal);
            }).then(function (response) {
                if (active !== request) return null;
                if (!response || !response.ok) {
                    var error = new Error('Unsuccessful HTTP response');
                    error.chatReason = response && response.status === 410 ? 'expired' : 'http';
                    throw error;
                }
                // The deadline remains active while json() is pending.
                return response.json();
            }).then(function (result) {
                if (active !== request) return;
                if (!result || typeof result.reply !== 'string' || !result.reply.trim()) {
                    finish(request, 'invalid-response');
                    return;
                }
                finish(request, '', result);
            }, function (error) {
                if (active !== request) return;
                finish(request, error && error.chatReason || (error instanceof SyntaxError ? 'invalid-response' : 'network'));
            });
            return true;
        }

        return {
            send: function (payload) { return begin(payload, false); },
            retry: function () { return retryPayload ? begin(retryPayload, true) : false; },
            cancel: function () {
                if (!active) return false;
                finish(active, 'cancelled');
                return true;
            },
            reset: function () { if (active) finish(active, "cancelled"); retryPayload = null; publish("idle"); },
            isPending: function () { return !!active; },
            getState: function () { return Object.assign({}, state); }
        };
    }
    return { create: create };
});
