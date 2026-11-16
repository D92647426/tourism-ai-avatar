/* REQ-061: local Leaflet map, OSM reference geometry and live environment overlays. */
(function (root) {
    'use strict';
    var dataRequests = {};
    function node(tag, text, className) {
        var item = document.createElement(tag);
        if (text != null) item.textContent = text;
        if (className) item.className = className;
        return item;
    }
    function coordinates(value) {
        return !!value && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90
            && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
    }
    /** Load packaged reference data once. Failed reads may be retried on the next opening. */
    function loadData(campusId) {
        if (campusId !== 'pingleyuan') return Promise.resolve({features:{type:'FeatureCollection',features:[]},points:[]});
        if (!dataRequests[campusId]) {
            dataRequests[campusId] = Promise.all(['pingleyuan-features.geojson','campus-map-points.json'].map(function (file) {
                return fetch('/media/campus/' + file).then(function (response) {
                    if (!response.ok) throw new Error('map-data-unavailable');
                    return response.json();
                });
            })).then(function (data) {
                if (data[0].type !== 'FeatureCollection' || !Array.isArray(data[0].features) || !Array.isArray(data[1].points)) throw new Error('invalid-map-data');
                return {features:data[0],points:data[1].points.filter(function (point) {
                    return coordinates(point) && point.coordinateStatus === 'reference' && point.entranceVerified === false;
                })};
            }).catch(function (error) { delete dataRequests[campusId]; throw error; });
        }
        return dataRequests[campusId];
    }
    /** REQ-061. Returns a DOM element and a disposable live map. See docs/campus_map_lab.md. */
    function create(options) {
        var campus = options.campus, L = root.L, map = null, overlays = null, destroyed = false;
        var points = [], latest = options.environment || {}, preview = null, overlayKey = null;
        var area = node('section', null, 'campus-map-panel');
        var heading = node('h2', '校园参考地图'), surface = node('div', null, 'campus-map');
        surface.setAttribute('aria-label', campus.name + '可缩放校园地图'); surface.setAttribute('tabindex','0');
        var status = node('p', '正在读取本地地图资料…', 'map-caption'); status.setAttribute('role','status');
        var positionText = node('p', '当前位置未确认', 'map-position');
        var note = node('p', '地图采用WGS84坐标。建筑中心为OSM参考点，入口与校内可通行路线待核验。', 'map-caption');
        var reset = node('button', '回到校区', 'text-button'); reset.type = 'button';
        area.append(heading, surface, positionText, status, reset, note);
        var source = node('a', '© OpenStreetMap contributors · ODbL');
        source.href = 'https://www.openstreetmap.org/copyright'; source.target = '_blank'; source.rel = 'noopener noreferrer'; area.appendChild(source);
        if (campus.mapPreview && campus.mapPreview.bbox) {
            var online = node('details',null,'map-online'); online.appendChild(node('summary','打开在线底图'));
            online.addEventListener('toggle',function () {
                if (!online.open || online.dataset.loaded || destroyed) return;
                online.dataset.loaded = 'true';
                var frame = node('iframe'); frame.title = campus.name + ' OpenStreetMap在线底图'; frame.loading = 'lazy'; frame.referrerPolicy = 'no-referrer';
                frame.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + campus.mapPreview.bbox.join('%2C') + '&layer=mapnik';
                online.appendChild(frame);
            });
            area.appendChild(online);
        }
        function center() {
            if (!map) return;
            var box = campus.mapPreview && campus.mapPreview.bbox;
            if (box) map.fitBounds([[box[1],box[0]],[box[3],box[2]]], {padding:[18,18],animate:false});
            else if (coordinates(preview || latest.position)) map.setView([ (preview || latest.position).latitude, (preview || latest.position).longitude ],17,{animate:false});
            else map.setView([39.9042,116.4074],12,{animate:false});
        }
        function markerLabel(point) {
            var body = node('div'); body.appendChild(node('strong', point.name));
            body.appendChild(node('p', 'OSM地图参考点，建筑入口待核验。'));
            if (options.onSelect) {
                var select = node('button', '用作虚拟位置'); select.type = 'button';
                select.addEventListener('click', function () { options.onSelect({latitude:point.latitude,longitude:point.longitude,placeId:point.placeId}); });
                body.appendChild(select);
            } else if (options.onChoice) {
                var ask = node('button', '了解这个地点'); ask.type = 'button';
                ask.addEventListener('click', function () { options.onChoice('介绍' + point.name); }); body.appendChild(ask);
            }
            return body;
        }
        function update(snapshot) {
            latest = snapshot || {};
            if (!map || destroyed) return;
            var position = latest.position, reference = null;
            if (position && !coordinates(position)) reference = points.find(function (point) { return point.placeId === position.placeId; });
            var current = coordinates(position) ? position : reference;
            var target = points.find(function (point) { return point.placeId === options.targetPlaceId; });
            var key = JSON.stringify([current,position && position.source,latest.simulated,latest.campusId,preview,target]);
            if (key === overlayKey) return;
            overlayKey = key; overlays.clearLayers();
            var differentCampus = latest.campusId && latest.campusId !== campus.id;
            if (differentCampus) current = null;
            positionText.textContent = !position ? '当前位置未确认' : differentCampus ? '当前位置属于其他校区'
                : latest.simulated ? '虚拟定位测试中' : reference ? '当前确认地点的地图参考位置' : '设备位置';
            if (current) {
                positionText.textContent += ' · ' + current.latitude.toFixed(6) + ', ' + current.longitude.toFixed(6);
                var color = latest.simulated ? '#aa6419' : '#277765';
                if (!reference && Number.isFinite(position.accuracy) && position.accuracy >= 0) L.circle([current.latitude,current.longitude], {radius:position.accuracy,color:color,weight:1,fillOpacity:.1}).addTo(overlays);
                L.circleMarker([current.latitude,current.longitude], {radius:7,color:'#fff',weight:2,fillColor:color,fillOpacity:1}).addTo(overlays)
                    .bindTooltip(node('span',latest.simulated ? '虚拟位置' : '当前位置'));
            }
            if (target) {
                L.circleMarker([target.latitude,target.longitude], {radius:8,color:'#183b66',weight:2,fillColor:'#a8d8ee',fillOpacity:1}).addTo(overlays)
                    .bindTooltip(node('span',target.name + '（参考点）'),{permanent:true,direction:'top'});
                if (current) {
                    L.polyline([[current.latitude,current.longitude],[target.latitude,target.longitude]],{color:'#52677c',weight:2,dashArray:'5 7'}).addTo(overlays);
                    positionText.textContent += ' · 虚线表示方向参考';
                }
            }
            if (coordinates(preview)) L.circleMarker([preview.latitude,preview.longitude],{radius:9,color:'#aa6419',weight:2,fillOpacity:.25}).addTo(overlays)
                .bindTooltip(node('span','待应用的虚拟位置'),{permanent:true,direction:'top'});
        }
        function initialize(data) {
            if (destroyed) return;
            points = data.points.filter(function (point) { return options.catalog.places.some(function (place) { return place.id === point.placeId && place.campusId === campus.id; }); });
            var reduce = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
            map = L.map(surface,{zoomControl:false,minZoom:3,maxZoom:21,zoomSnap:.25,scrollWheelZoom:false,zoomAnimation:!reduce,fadeAnimation:!reduce,markerZoomAnimation:!reduce});
            center();
            L.control.zoom({zoomInTitle:'放大地图',zoomOutTitle:'缩小地图'}).addTo(map);
            L.control.scale({imperial:false}).addTo(map);
            L.geoJSON(data.features,{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',style:function (feature) {
                var kind = feature.properties.kind;
                if (kind === 'road') return {color:'#fff',weight:4,opacity:1};
                if (kind === 'water') return {color:'#7dbed6',weight:1,fillColor:'#a8d8ee',fillOpacity:1};
                if (kind === 'sports') return {color:'#95bda9',weight:1,fillColor:'#cce0d3',fillOpacity:.8};
                return {color:'#aabcca',weight:1,fillColor:kind === 'campus' ? '#e9f0ed' : '#cdd9e3',fillOpacity:.85};
            }}).addTo(map);
            points.forEach(function (point) {
                L.circleMarker([point.latitude,point.longitude],{radius:4,color:'#52677c',weight:1,fillColor:'#fff',fillOpacity:1}).addTo(map)
                    .bindTooltip(node('span',point.name)).bindPopup(markerLabel(point));
            });
            overlays = L.layerGroup().addTo(map);
            if (options.onSelect) map.on('click',function (event) { options.onSelect({latitude:event.latlng.lat,longitude:event.latlng.lng}); });
            update(latest);
            status.textContent = campus.id === 'pingleyuan' ? '离线建筑与道路参考底图 · 拖动、双指缩放，点击圆点查看地点' : '该校区详细底图待补充，可输入WGS84坐标测试';
        }
        reset.addEventListener('click',center);
        var ready = !L ? Promise.resolve().then(function () { status.textContent = '交互地图库暂未加载，可继续查看校园边界与地址资料。'; })
            : loadData(campus.id).catch(function () {
                status.textContent = '详细地图暂未加载，当前显示校园范围。重新打开地图可重试。';
                var boundary = campus.mapPreview && campus.mapPreview.boundary;
                return {features:{type:'FeatureCollection',features:boundary ? [{type:'Feature',properties:{kind:'campus'},geometry:{type:'Polygon',coordinates:[boundary]}}] : []},points:[],fallback:true};
            }).then(function (data) {
                if (destroyed) return;
                try { initialize(data); }
                catch (error) {
                    console.warn('Campus map initialization failed',error);
                    try { if (map) map.remove(); } catch (_) { /* A partially initialized renderer may already be detached. */ }
                    map = null; status.textContent = '交互地图暂不可用，可继续查看地点地址或输入虚拟坐标。';
                }
                if (data.fallback) status.textContent = '详细地图暂未加载，当前显示校园范围。重新打开地图可重试。';
            });
        return {element:area,ready:ready,update:update,
            setPreview:function (position) { preview = coordinates(position) ? Object.assign({},position) : null; update(latest); },
            refresh:function () { if (map && !destroyed) { map.invalidateSize({pan:false}); center(); } },
            destroy:function () { destroyed = true; if (map) map.remove(); map = null; }};
    }
    root.CampusMap = {create:create,loadData:loadData,coordinates:coordinates};
})(window);
