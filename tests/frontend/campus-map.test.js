// REQ-061: real map module and scene lifecycle, with Leaflet isolated at its public boundary.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {page, turn, response, flush, deferred} = require('./campus-fixture.cjs');
const {leaflet} = require('./leaflet-fixture.cjs');

const media = path.resolve(__dirname, '../../src/main/resources/static/media/campus');
const features = JSON.parse(fs.readFileSync(path.join(media, 'pingleyuan-features.geojson'), 'utf8'));
const references = JSON.parse(fs.readFileSync(path.join(media, 'campus-map-points.json'), 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));
const localResponse = url => response(url.endsWith('.geojson') ? features : references);
const mapReads = p => p.calls.filter(call => call.url.startsWith('/media/campus/'));
const group = f => f.layers.find(layer => layer.type === 'layerGroup');
const currentMarkers = f => group(f).layers.filter(layer => layer.type === 'circleMarker');
const descendants = node => node.children.flatMap(child => [child, ...descendants(child)]);

test('online tiles load once only after explicit expansion and stop after disposal', async () => {
    const {view} = await initialized();
    const online = descendants(view.element).find(node=>node.tagName==='DETAILS');
    assert.equal(descendants(view.element).filter(node=>node.tagName==='IFRAME').length,0);
    online.open=true;online.fire('toggle');online.fire('toggle');
    const frames=descendants(view.element).filter(node=>node.tagName==='IFRAME');
    assert.equal(frames.length,1);assert.match(frames[0].src,/^https:\/\/www\.openstreetmap\.org\/export\/embed\.html/);
    const another=await initialized();another.view.destroy();
    const closed=descendants(another.view.element).find(node=>node.tagName==='DETAILS');closed.open=true;closed.fire('toggle');
    assert.equal(descendants(another.view.element).filter(node=>node.tagName==='IFRAME').length,0);
});

function create(p, options = {}) {
    return p.context.CampusMap.create({campus:p.catalog.campuses[0], catalog:p.catalog, ...options});
}

async function initialized(options = {}) {
    const f = leaflet({requireViewBeforeLayers:true, ...options.leaflet});
    const p = page({Leaflet:f.L, ...options.page}); await flush();
    const view = create(p, options.view); await view.ready;
    return {p, f, view};
}

async function answer(p, revision, placeId, extra = {}) {
    p.send('第' + revision + '个地图场景'); await flush();
    p.chats().at(-1).resolve(response(turn(revision, placeId, extra))); await flush();
}

test('packaged building geometry and reference points load once across map instances', async () => {
    const {p, f, view} = await initialized();
    assert.equal(view.element.tagName, 'SECTION');
    assert.equal(mapReads(p).length, 2);
    assert.equal(f.maps.length, 1);
    const geometry = f.layers.find(layer => layer.type === 'geoJSON');
    assert.equal(geometry.value.features.length, features.features.length);
    assert.equal(f.layers.filter(layer => layer.type === 'circleMarker' && layer.popup).length, references.points.length);
    assert.match(view.element.textContent, /离线建筑与道路参考底图/);
    assert.match(view.element.textContent, /WGS84/);
    assert.match(view.element.textContent, /OpenStreetMap contributors/);
    const second = create(p); await second.ready;
    assert.equal(mapReads(p).length, 2);
    assert.equal(f.maps.length, 2);
    view.destroy(); second.destroy();
});

test('map view is established before geometry is added and refresh/reset reuse the map', async () => {
    const {f, view} = await initialized();
    const map = f.maps[0];
    const geometryIndex = map.operations.findIndex(operation => operation.type === 'addLayer' && operation.layer.type === 'geoJSON');
    const viewIndex = map.operations.findIndex(operation => ['fitBounds', 'setView'].includes(operation.type));
    assert.ok(viewIndex >= 0 && viewIndex < geometryIndex);
    assert.equal(map.fitBoundsCalls.length, 1);
    view.refresh();
    assert.equal(map.invalidateSizeCalls.length, 1);
    assert.equal(map.fitBoundsCalls.length, 2);
    descendants(view.element).find(node => node.tagName === 'BUTTON' && node.textContent === '回到校区').fire('click');
    assert.equal(map.fitBoundsCalls.length, 3);
    view.destroy(); view.refresh();
    assert.equal(map.invalidateSizeCalls.length, 1);
});

test('missing Leaflet keeps a readable fallback without fetching map datasets', async () => {
    const p = page(); await flush(); const view = create(p); await view.ready;
    assert.match(view.element.textContent, /地图库暂未加载/);
    assert.equal(mapReads(p).length, 0);
    assert.doesNotThrow(() => { view.update({}); view.setPreview({latitude:39.87, longitude:116.47}); view.refresh(); view.destroy(); });
});

for (const failure of ['503', 'invalid JSON', 'invalid schema']) {
    test(failure + ' falls back to the campus boundary and a later opening retries', async () => {
        let failing = true;
        const f = leaflet({requireViewBeforeLayers:true});
        const p = page({Leaflet:f.L, mapFetch(url) {
            if (!failing) return Promise.resolve(localResponse(url));
            if (failure === '503') return Promise.resolve(response({}, 503));
            if (failure === 'invalid JSON') return Promise.resolve({ok:true, json:async () => { throw new SyntaxError('invalid JSON'); }});
            return Promise.resolve(response({type:'FeatureCollection', features:'invalid', points:null}));
        }}); await flush();
        const first = create(p); await first.ready;
        assert.match(first.element.textContent, /详细地图暂未加载.*校园范围/);
        const boundary = f.layers.find(layer => layer.type === 'geoJSON');
        assert.equal(boundary.value.features.length, 1);
        assert.equal(boundary.value.features[0].properties.kind, 'campus');
        assert.equal(mapReads(p).length, 2);
        failing = false;
        const second = create(p); await second.ready;
        assert.match(second.element.textContent, /离线建筑与道路参考底图/);
        assert.equal(mapReads(p).length, 4);
        assert.equal(f.layers.filter(layer => layer.type === 'circleMarker' && layer.popup).length, references.points.length);
        first.destroy(); second.destroy();
    });
}

test('map initialization failure resolves to a warning and remains disposable', async () => {
    const f = leaflet({throwOnMap:true}); const p = page({Leaflet:f.L}); await flush();
    const warnings = []; p.context.console = {...console, warn(...args) { warnings.push(args); }};
    const view = create(p); await view.ready;
    assert.match(view.element.textContent, /交互地图暂不可用/);
    assert.equal(f.maps.length, 0);
    assert.ok(warnings.length >= 1);
    assert.doesNotThrow(() => view.destroy());
});

test('partial initialization and a second cleanup failure still resolve to the fallback', async () => {
    const f = leaflet({requireViewBeforeLayers:true, throwOnRemove:true});
    f.L.geoJSON = () => { throw new Error('renderer unavailable'); };
    const p = page({Leaflet:f.L}); await flush();
    const warnings = []; p.context.console = {...console, warn(...args) { warnings.push(args); }};
    const view = create(p); await assert.doesNotReject(() => view.ready);
    assert.match(view.element.textContent, /交互地图暂不可用/);
    assert.equal(f.maps[0].removeCalls, 1);
    assert.ok(warnings.length >= 1);
    assert.doesNotThrow(() => view.destroy());
});

test('destroying before dataset completion prevents a late map and preserves shared cache reuse', async () => {
    const f = leaflet(); const jobs = [];
    const p = page({Leaflet:f.L, mapFetch(url) { const pending = deferred(); jobs.push({url, ...pending}); return pending.promise; }});
    await flush(); const view = create(p); view.destroy();
    for (const job of jobs) job.resolve(localResponse(job.url));
    await view.ready;
    assert.equal(f.maps.length, 0);
    const second = create(p); await second.ready;
    assert.equal(f.maps.length, 1);
    assert.equal(mapReads(p).length, 2);
    second.destroy();
});

test('device coordinates and nonnegative accuracy draw one actual position and precision circle', async () => {
    const snapshot = {campusId:'pingleyuan', simulated:false, position:{latitude:39.874, longitude:116.477, accuracy:12, source:'geolocation'}};
    const {f, view} = await initialized({view:{environment:snapshot}});
    assert.deepEqual(plain(currentMarkers(f)[0].value), [39.874, 116.477]);
    assert.equal(group(f).layers.find(layer => layer.type === 'circle').options.radius, 12);
    assert.match(view.element.textContent, /设备位置.*39\.874000, 116\.477000/);
    view.update({...snapshot, simulated:true});
    assert.match(view.element.textContent, /虚拟定位测试中/);
    assert.equal(currentMarkers(f)[0].tooltip.textContent, '虚拟位置');
    for (const accuracy of [-1, NaN, Infinity]) {
        view.update({...snapshot, position:{...snapshot.position, accuracy}});
        assert.equal(group(f).layers.filter(layer => layer.type === 'circle').length, 0);
    }
    view.update({...snapshot, position:{...snapshot.position, accuracy:0}});
    assert.equal(group(f).layers.find(layer => layer.type === 'circle').options.radius, 0);
    view.destroy();
});

test('invalid coordinates and positions on another campus never draw a local current position', async () => {
    const {f, view} = await initialized();
    for (const position of [{latitude:91, longitude:116}, {latitude:39, longitude:181}, {latitude:NaN, longitude:116}, {latitude:39}]) {
        view.update({campusId:'pingleyuan', position});
        assert.equal(currentMarkers(f).length, 0);
        assert.equal(group(f).layers.filter(layer => layer.type === 'polyline').length, 0);
    }
    view.update({campusId:'tongzhou', position:{latitude:39.874, longitude:116.477, accuracy:10, source:'geolocation'}});
    assert.equal(group(f).layers.length, 0);
    assert.match(view.element.textContent, /当前位置属于其他校区/);
    view.destroy();
});

test('confirmed places use only a known reference center and never invent precision or unknown building coordinates', async () => {
    const {f, view} = await initialized();
    const library = references.points.find(point => point.placeId === 'pingleyuan-library');
    view.update({campusId:'pingleyuan', position:{placeId:library.placeId, source:'confirmed', accuracy:5}});
    assert.deepEqual(plain(currentMarkers(f)[0].value), [library.latitude, library.longitude]);
    assert.equal(group(f).layers.filter(layer => layer.type === 'circle').length, 0);
    assert.match(view.element.textContent, /当前确认地点的地图参考位置/);
    view.update({campusId:'pingleyuan', position:{placeId:'pingleyuan-north-dining', source:'confirmed'}});
    assert.equal(group(f).layers.length, 0);
    view.update({campusId:'pingleyuan', position:{latitude:39.876, longitude:116.476, source:'geolocation'}});
    assert.deepEqual(plain(currentMarkers(f)[0].value), [39.876, 116.476]);
    assert.equal(currentMarkers(f).length, 1);
    assert.doesNotMatch(view.element.textContent, /当前确认地点的地图参考位置/);
    view.destroy();
});

test('target overlays show only a dashed direction reference and exact same snapshots reuse overlays', async () => {
    const snapshot = {campusId:'pingleyuan', position:{latitude:39.874, longitude:116.477, source:'geolocation'}};
    const {f, view} = await initialized({view:{targetPlaceId:'pingleyuan-library', environment:snapshot}});
    const target = references.points.find(point => point.placeId === 'pingleyuan-library');
    const line = group(f).layers.find(layer => layer.type === 'polyline');
    assert.ok(line.options.dashArray);
    assert.deepEqual(plain(line.value), [[39.874, 116.477], [target.latitude, target.longitude]]);
    assert.match(view.element.textContent, /虚线表示方向参考/);
    const clears = group(f).clearCalls, total = f.layers.length;
    view.update(plain(snapshot)); view.update({...snapshot, hour:13, time:'later', weather:{status:'available'}});
    assert.equal(group(f).clearCalls, clears);
    assert.equal(f.layers.length, total);
    view.destroy();
});

test('unknown destination coordinates create no guessed target or direction line', async () => {
    const {f, view} = await initialized({view:{targetPlaceId:'pingleyuan-north-dining', environment:{campusId:'pingleyuan', position:{latitude:39.874, longitude:116.477, source:'geolocation'}}}});
    assert.equal(currentMarkers(f).length, 1);
    assert.equal(group(f).layers.filter(layer => layer.type === 'polyline').length, 0);
    assert.doesNotMatch(view.element.textContent, /虚线表示方向参考/);
    view.destroy();
});

test('preview coordinates are detached, validated and cleared without altering the environment', async () => {
    const snapshot = {campusId:'pingleyuan', position:null};
    const {f, view} = await initialized({view:{environment:snapshot}});
    const preview = {latitude:39.875, longitude:116.475}; view.setPreview(preview); preview.latitude = 0;
    assert.deepEqual(plain(currentMarkers(f)[0].value), [39.875, 116.475]);
    assert.equal(currentMarkers(f)[0].tooltip.textContent, '待应用的虚拟位置');
    assert.equal(snapshot.position, null);
    view.setPreview({latitude:100, longitude:116}); assert.equal(group(f).layers.length, 0);
    view.destroy();
});

test('reference labels and popup contents stay text nodes and callbacks carry current explicit choices', async () => {
    const unsafe = '<img src=x onerror=alert(1)>';
    const changed = plain(references); changed.points[0].name = unsafe;
    const selected = [];
    const {f, view} = await initialized({page:{mapFetch:url => Promise.resolve(response(url.endsWith('.geojson') ? features : changed))}, view:{onSelect:value => selected.push(value)}});
    const point = f.layers.find(layer => layer.type === 'circleMarker' && layer.popup);
    assert.equal(point.tooltip.tagName, 'SPAN'); assert.equal(point.tooltip.textContent, unsafe);
    assert.equal(point.popup.tagName, 'DIV'); assert.match(point.popup.textContent, /<img src=x/);
    assert.equal(descendants(point.popup).some(node => node.tagName === 'IMG'), false);
    descendants(point.popup).find(node => node.tagName === 'BUTTON').fire('click');
    assert.deepEqual(plain(selected[0]), {latitude:changed.points[0].latitude, longitude:changed.points[0].longitude, placeId:changed.points[0].placeId});
    f.maps[0].fire('click', {latlng:{lat:39.875, lng:116.479}});
    assert.deepEqual(plain(selected[1]), {latitude:39.875, longitude:116.479});
    view.destroy(); f.maps[0].fire('click', {latlng:{lat:0, lng:0}}); assert.equal(selected.length, 2);
});

test('reference popup can continue through the normal scene choice callback', async () => {
    const choices = [];
    const {f, view} = await initialized({view:{onChoice:message => choices.push(message)}});
    const marker = f.layers.find(layer => layer.type === 'circleMarker' && layer.popup);
    descendants(marker.popup).find(node => node.tagName === 'BUTTON').fire('click');
    assert.deepEqual(choices, ['介绍' + references.points[0].name]);
    view.destroy();
});

test('campuses without packaged geometry keep a labeled empty view centered on the explicit position', async () => {
    const f = leaflet({requireViewBeforeLayers:true}); const p = page({Leaflet:f.L}); await flush();
    const campus = p.catalog.campuses.find(item => item.id === 'tongzhou');
    const view = create(p, {campus, environment:{campusId:'tongzhou', position:{latitude:39.95, longitude:116.7, source:'simulated'}, simulated:true}});
    await view.ready;
    assert.equal(mapReads(p).length, 0);
    assert.deepEqual(plain(f.maps[0].setViewCalls[0].center), [39.95, 116.7]);
    assert.match(view.element.textContent, /该校区详细底图待补充/);
    view.destroy();
});

test('scene replacements dispose maps, KEEP_SCENE retains them and page exit cleans the live scene', async () => {
    const f = leaflet({requireViewBeforeLayers:true}); const p = page({Leaflet:f.L}); await flush();
    await answer(p, 1, 'pingleyuan-library');
    assert.equal(f.maps.length, 1); const first = f.maps[0];
    await answer(p, 2, 'pingleyuan-library', {sceneAction:{type:'KEEP_SCENE'}});
    assert.equal(f.maps.length, 1); assert.equal(first.removeCalls, 0);
    await answer(p, 3, 'pingleyuan-moon-lake');
    assert.equal(first.removeCalls, 1); assert.equal(f.maps.length, 2);
    const second = f.maps[1];
    await answer(p, 4, null, {sceneAction:{type:'RETURN_STAGE', placeIds:[]}});
    assert.equal(second.removeCalls, 1);
    await answer(p, 5, 'pingleyuan-library'); const final = f.maps[2]; p.pagehide();
    assert.equal(final.removeCalls, 1);
});
