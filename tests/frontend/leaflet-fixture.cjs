// REQ-061: observable Leaflet boundary only. Real DOM, requests and app code come from campus-fixture.
function leaflet(options = {}) {
    const maps = [], layers = [];

    function layer(type, value, settings = {}) {
        const item = {
            type, value, options: settings, layers: [], additions: [], tooltip: null, popup: null,
            clearCalls: 0,
            addTo(target) {
                const owner = target.type === 'layerGroup' ? target.target : target;
                if (options.requireViewBeforeLayers && ['geoJSON', 'circleMarker', 'circle', 'polyline'].includes(this.type)
                        && !owner.viewInitialized) throw new Error('geometry requires an initialized map view');
                this.target = target;
                this.additions.push(target);
                target.layers.push(this);
                if (owner.operations) owner.operations.push({type: 'addLayer', layer: this});
                return this;
            },
            bindTooltip(content, settings = {}) {
                this.tooltip = content;
                this.tooltipOptions = settings;
                return this;
            },
            bindPopup(content, settings = {}) {
                this.popup = content;
                this.popupOptions = settings;
                return this;
            },
            clearLayers() {
                this.clearCalls++;
                this.layers = [];
                return this;
            }
        };
        layers.push(item);
        return item;
    }

    const L = {
        map(surface, settings) {
            if (options.throwOnMap) throw new Error('map initialization unavailable');
            const map = {
                surface, options: settings, layers: [], events: {}, onCalls: [], operations: [], viewInitialized: false,
                fitBoundsCalls: [], setViewCalls: [], invalidateSizeCalls: [], removeCalls: 0,
                fitBounds(bounds, settings) {
                    this.fitBoundsCalls.push({bounds, options: settings});
                    this.operations.push({type: 'fitBounds'}); this.viewInitialized = true;
                    return this;
                },
                setView(center, zoom, settings) {
                    this.setViewCalls.push({center, zoom, options: settings});
                    this.operations.push({type: 'setView'}); this.viewInitialized = true;
                    return this;
                },
                invalidateSize(settings) {
                    this.invalidateSizeCalls.push(settings);
                    return this;
                },
                on(type, callback) {
                    this.onCalls.push({type, callback});
                    (this.events[type] ||= []).push(callback);
                    return this;
                },
                fire(type, event) {
                    for (const callback of this.events[type] || []) callback(event);
                    return this;
                },
                remove() {
                    this.removeCalls++;
                    if (options.throwOnRemove) throw new Error('partial map removal failed');
                    this.removed = true;
                    this.events = {};
                    return this;
                }
            };
            maps.push(map);
            return map;
        },
        geoJSON(data, settings) { return layer('geoJSON', data, settings); },
        layerGroup() { return layer('layerGroup', null); },
        circleMarker(center, settings) { return layer('circleMarker', center, settings); },
        circle(center, settings) { return layer('circle', center, settings); },
        polyline(points, settings) { return layer('polyline', points, settings); },
        control: {
            zoom(settings) { return layer('zoomControl', null, settings); },
            scale(settings) { return layer('scaleControl', null, settings); }
        }
    };
    return {L, maps, layers};
}

module.exports = {leaflet};
