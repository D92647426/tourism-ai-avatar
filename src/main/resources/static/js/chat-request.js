// REQ-031 / #6: one logical request, including response-body parsing, at a time.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.GuideChatRequest = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

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

        function begin(payload, isRetry) {
            if (active || !payload || typeof payload.message !== 'string' || !payload.message.trim()) return false;
            // Values in the existing API are scalar; callers cannot mutate a retry snapshot.
            var request = { payload: Object.assign({}, payload), controller: null, timer: null };
            if (typeof AbortController !== 'undefined') request.controller = new AbortController();
            active = request;
            retryPayload = null;
            request.timer = schedule(function () { finish(request, 'timeout'); }, timeoutMs);
            publish('pending');
            if (options.onStart) options.onStart(Object.assign({}, request.payload), !!isRetry);

            Promise.resolve().then(function () {
                if (active !== request) return null;
                return options.request(Object.assign({}, request.payload), request.controller && request.controller.signal);
            }).then(function (response) {
                if (active !== request) return null;
                if (!response || !response.ok) {
                    var error = new Error('Unsuccessful HTTP response');
                    error.chatReason = 'http';
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
            isPending: function () { return !!active; },
            getState: function () { return Object.assign({}, state); }
        };
    }
    return { create: create };
});
