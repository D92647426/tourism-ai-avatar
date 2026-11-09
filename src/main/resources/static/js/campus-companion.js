/* REQ-057 pure foreground invitation state. No DOM, network or player dependency.
 * See docs/superpowers/specs/2026-11-09-campus-assistant-design.md section 6. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CampusCompanion = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    /** Create an opt-in companion. now returns epoch milliseconds, places use catalog records.
     * update receives physical context. offer and accept return detached invitations or null.
     * The page sends accepted.messageToSend through the normal chat entry point.
     */
    function create(options) {
        options = options || {};
        var now = options.now || Date.now;
        var places = (options.places || []).map(function (place) {return Object.assign({}, place);});
        var regions = (options.regions || []).map(function (region) {return Object.assign({}, region);});
        var enabled = false;
        var snapshot = null;
        var firstSample = null;
        var lastSample = null;
        var pending = null;
        var sequence = 0;
        var lastShownAt = -Infinity;
        var mealDay = null;
        var shownMeals = new Set();
        var resumeAfter = -Infinity;

        function copy(value) {
            return value ? Object.assign({}, value) : null;
        }

        function clearEvidence() {
            firstSample = lastSample = pending = null;
        }

        function validCoordinates(position) {
            return Number.isFinite(position.latitude) && Math.abs(position.latitude) <= 90
                && Number.isFinite(position.longitude) && Math.abs(position.longitude) <= 180;
        }

        function distance(position, region) {
            var radians = Math.PI / 180;
            var latitudeDelta = (region.latitude - position.latitude) * radians;
            var longitudeDelta = (region.longitude - position.longitude) * radians;
            var arc = Math.sin(latitudeDelta / 2) ** 2
                + Math.cos(position.latitude * radians) * Math.cos(region.latitude * radians)
                * Math.sin(longitudeDelta / 2) ** 2;
            return 6371000 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(Math.max(0, 1 - arc)));
        }

        function geolocatedPlace(position) {
            if (!validCoordinates(position) || !Number.isFinite(position.accuracy)
                    || position.accuracy < 0 || position.accuracy > 40
                    || (position.coordinateSystem && position.coordinateSystem !== 'WGS84')) {
                return null;
            }
            var matches = regions.filter(function (region) {
                if (region.campusId !== snapshot.campusId || !validCoordinates(region)) {
                    return false;
                }
                var radius = lastSample && lastSample.source === 'geolocation'
                    && lastSample.place.id === region.placeId ? 150 : 100;
                return distance(position, region) + position.accuracy <= radius;
            });
            if (matches.length !== 1) {
                return null;
            }
            var region = matches[0];
            return places.find(function (place) {
                return place.id === region.placeId && place.campusId === region.campusId;
            }) || {id: region.placeId, campusId: region.campusId, category: region.category};
        }

        function validPosition() {
            var position = snapshot && snapshot.position;
            if (!position || !Number.isFinite(position.timestamp)
                    || position.timestamp <= resumeAfter || position.timestamp > now()
                    || now() - position.timestamp > 30000) {
                return null;
            }
            var place;
            if (position.source === 'geolocation') {
                place = geolocatedPlace(position);
            } else if (position.source === 'confirmed'
                    || (position.source === 'simulated' && snapshot.simulated === true)) {
                var placeId = position.placeId || snapshot.placeId;
                place = places.find(function (item) {
                    return item.id === placeId && item.campusId === snapshot.campusId;
                });
            }
            return place ? {place: place, timestamp: position.timestamp, source: position.source} : null;
        }

        function trigger() {
            var position = validPosition();
            if (!position || !firstSample || !lastSample
                    || position.place.id !== lastSample.place.id
                    || lastSample.timestamp - firstSample.timestamp < 20000
                    || now() - firstSample.timestamp < 30000) {
                return null;
            }
            var day = new Date(now() + 8 * 3600000).toISOString().slice(0, 10);
            if (mealDay !== day) {
                mealDay = day;
                shownMeals.clear();
            }
            var hour = snapshot.hour;
            var meal = null;
            if (Number.isFinite(hour) && hour >= 11 && hour < 13) {
                meal = 'lunch';
            }
            if (Number.isFinite(hour) && hour >= 17 && hour < 19) {
                meal = 'dinner';
            }
            var place = position.place;
            if (place.category === 'dining' && meal) {
                return {place: place, key: place.id + ':' + day + ':' + meal, dining: true};
            }
            if (place.category === 'library') {
                return {place: place, key: place.id + ':library', dining: false};
            }
            return null;
        }

        function refresh() {
            var current = enabled && snapshot && snapshot.visible === true ? trigger() : null;
            if (pending && (!current || pending.key !== current.key || now() >= pending.offer.expiresAt)) {
                pending = null;
            }
            if (!pending && current && now() - lastShownAt >= 600000
                    && !(current.dining && shownMeals.has(current.key))) {
                pending = {key: current.key, dining: current.dining, shown: false,
                    offer: {id: 'offer-' + (++sequence),
                        message: current.dining ? '到饭点了，要看看附近吃什么吗？' : '在图书馆附近，要看看这里可以做什么吗？',
                        placeId: current.place.id,
                        messageToSend: current.dining ? '看看附近吃什么' : '图书馆可以做什么？',
                        expiresAt: now() + 60000}};
            }
        }

        function update(next) {
            if (!next || !Number.isSafeInteger(next.contextRevision) || next.contextRevision < 0) {
                snapshot = null;
                clearEvidence();
                return;
            }
            if (snapshot && next.contextRevision < snapshot.contextRevision) {
                return;
            }
            if (snapshot && (next.contextRevision !== snapshot.contextRevision
                    || next.campusId !== snapshot.campusId || next.simulated !== snapshot.simulated)) {
                clearEvidence();
            }
            snapshot = Object.assign({}, next, {position: copy(next.position)});
            if (!enabled || snapshot.visible !== true) {
                clearEvidence();
                resumeAfter = now();
                return;
            }
            var position = validPosition();
            if (!position) {
                clearEvidence();
                return;
            }
            if (!lastSample || position.place.id !== lastSample.place.id
                    || position.source !== lastSample.source
                    || position.timestamp - lastSample.timestamp > 30000
                    || position.timestamp < lastSample.timestamp) {
                clearEvidence();
                firstSample = position;
            }
            lastSample = position;
            refresh();
        }

        function offer() {
            refresh();
            if (!pending || snapshot.busy) {
                return null;
            }
            if (!pending.shown) {
                pending.shown = true;
                lastShownAt = now();
                if (pending.dining) {
                    shownMeals.add(pending.key);
                }
            }
            return copy(pending.offer);
        }

        return {
            update: update,
            offer: offer,
            accept: function (id) {
                refresh();
                if (!pending || !pending.shown || snapshot.busy || pending.offer.id !== id) {
                    return null;
                }
                var accepted = copy(pending.offer);
                pending = null;
                return accepted;
            },
            dismiss: function () {pending = null;},
            reset: function () {
                snapshot = null;
                clearEvidence();
                shownMeals.clear();
                lastShownAt = -Infinity;
                resumeAfter = -Infinity;
            },
            setEnabled: function (value) {
                enabled = value === true;
                if (!enabled) {
                    clearEvidence();
                    resumeAfter = now();
                }
            }
        };
    }
    return {create: create};
});
