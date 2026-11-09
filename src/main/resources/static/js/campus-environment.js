/* REQ-057/059: physical evidence, weather and explicitly simulated companion clock. */
(function (root) {
    'use strict';
    function create(options) {
        var confirmedPosition = null, devicePosition = null, simulatedPosition = null;
        var simulated = false, demoTime = 0, demoAnchor = 0, enabled = false;
        var generation = 0, actionGeneration = 0, demoTimer = null, pulseTimer = null, currentOffer = null, weather = null;
        var context = {}, disposed = false, serverOffset = null, watchId = null, pollTimer = null;
        var weatherGeneration = 0, lastWeatherAt = -Infinity;
        var environmentRevision = 0, environmentIdentity = null, recheck = null;
        var companion = CampusCompanion.create({now:now, places:options.catalog.places, regions:[]});
        var byId = function (id) { return document.getElementById(id); };
        function now() { return simulated ? demoTime + Date.now() - demoAnchor : Date.now(); }
        function place(id) { return options.catalog.places.find(function (p) { return p.id === id; }); }
        function displayTime() { return now() + (!simulated && serverOffset !== null ? serverOffset : 0); }
        function hour() { return new Date(displayTime() + 8 * 3600000).getUTCHours(); }
        // One request position keeps a single truthful source. GPS never supplies a building claim.
        function physicalPosition() { return simulated ? simulatedPosition : confirmedPosition || devicePosition; }
        function quiet() { var position = physicalPosition(), p = place(position && position.placeId); return !!p && (p.category === 'library' || p.category === 'library-area'); }
        function clearOffer() { currentOffer = null; byId('proactiveOffer').hidden = true; }
        // Timestamps are observations. Only identity/lifecycle boundaries begin a new physical epoch.
        function syncEnvironment(position) {
            var identity = JSON.stringify([context.conversationId,context.campusId,simulated,enabled,document.hidden,
                position && position.placeId,position && position.source]);
            if (identity !== environmentIdentity) {
                environmentIdentity = identity; environmentRevision++; recheck = null;
            }
        }
        function update() {
            if (disposed) return;
            var busy = options.isBusy(), position = physicalPosition();
            syncEnvironment(position);
            companion.update({visible:!document.hidden, busy:busy, contextRevision:context.contextRevision || 0,
                environmentRevision:environmentRevision,
                campusId:simulated ? 'pingleyuan' : context.campusId, placeId:position && position.placeId,
                position:position, hour:hour(), simulated:simulated, quiet:quiet()});
            currentOffer = companion.offer();
            byId('proactiveOffer').hidden = !currentOffer;
            if (currentOffer) byId('offerMessage').textContent = currentOffer.message;
            var p = place(position && position.placeId);
            var clockText = new Date(displayTime() + 8 * 3600000).toISOString().slice(11,16);
            byId('environmentStatus').textContent = simulated ? '模拟时间 ' + clockText + ' · ' + (p ? p.name : '位置待定')
                : '真实时间 ' + clockText + ' · 上海 · ' + (serverOffset === null ? '设备时间' : '服务器校时');
            byId('environmentStatus').dataset.simulated = String(simulated);
            byId('positionStatus').textContent = p ? (simulated ? '模拟位置 ' : '已确认在 ') + p.name : position ? '已获取设备位置，具体建筑未确认' : '当前位置未确认';
            byId('companionToggle').textContent = enabled ? '陪伴已开' : '开启陪伴';
            byId('companionToggle').setAttribute('aria-pressed', String(enabled));
            var canRecheck = enabled && !simulated && !document.hidden && confirmedPosition && !busy
                && Number.isFinite(confirmedPosition.timestamp) && now() - confirmedPosition.timestamp >= 20000;
            byId('recheckPosition').hidden = !canRecheck;
            byId('recheckHelp').hidden = !enabled || simulated || !confirmedPosition || document.hidden;
            recheck = canRecheck ? {revision:environmentRevision,placeId:confirmedPosition.placeId,timestamp:confirmedPosition.timestamp} : null;
            options.onQuiet(quiet());
        }
        function pulse() { update(); pulseTimer = setTimeout(pulse, 1000); }
        function weatherEvidence(result) {
            var area = byId('weatherEvidence'); area.replaceChildren();
            if (simulated) { area.textContent = '模拟天气，仅用于课堂情境演示。'; return; }
            if (!result || result.status === 'unavailable') { area.textContent = '暂未取得可用天气资料。'; return; }
            area.appendChild(CampusScene.element('p', '天气资料时间 ' + (result.dataTime || result.time || '未提供') + ' · 上海时间'));
            var fetched = Date.parse(result.fetchedAt);
            area.appendChild(CampusScene.element('p', '获取时间 ' + (Number.isFinite(fetched) ? new Date(fetched + 8 * 3600000).toISOString().slice(0,19).replace('T',' ') + ' · 上海时间' : '未提供')));
            area.appendChild(CampusScene.element('p', result.stale ? '当前展示上次资料，请留意资料时间。' : '当前展示最近取得的资料。'));
            if (result.sourceUrl) area.appendChild(CampusScene.link(result.provider || '天气来源',result.sourceUrl));
        }
        async function loadWeather(token) {
            var weatherToken = ++weatherGeneration; lastWeatherAt = Date.now();
            var query = devicePosition ? '?latitude=' + devicePosition.latitude + '&longitude=' + devicePosition.longitude : '';
            try {
                var result = await options.get('/api/campus/weather' + query);
                if (token !== generation || weatherToken !== weatherGeneration || simulated || disposed) return;
                weather = result;
                byId('weatherStatus').textContent = result.status === 'unavailable' ? '天气暂不可用' : result.label + ' ' + result.temperatureC + '℃' + (result.stale ? ' · 上次资料' : '');
                weatherEvidence(result);
            } catch (_) { if (token === generation && weatherToken === weatherGeneration && !simulated) { byId('weatherStatus').textContent = '天气暂不可用'; weatherEvidence(null); } }
        }
        function stopWatch() {
            if (watchId !== null && navigator.geolocation && navigator.geolocation.clearWatch) navigator.geolocation.clearWatch(watchId);
            watchId = null; clearTimeout(pollTimer); pollTimer = null;
        }
        function locate() {
            if (simulated || document.hidden || disposed) return;
            stopWatch(); var token = ++generation; devicePosition = null; update();
            if (!confirmedPosition) byId('positionStatus').textContent = '正在获取位置';
            if (!navigator.geolocation) {
                if (!confirmedPosition) byId('positionStatus').textContent = '设备不支持定位，可在对话中说明起点';
                loadWeather(token); return;
            }
            function received(result) {
                if (token !== generation || simulated || document.hidden || disposed) return;
                var c = result.coords;
                if (![c.latitude,c.longitude,c.accuracy].every(Number.isFinite) || c.accuracy < 0 || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180) return;
                devicePosition = {latitude:c.latitude,longitude:c.longitude,accuracy:c.accuracy,timestamp:result.timestamp,source:'geolocation'};
                update(); if (Date.now() - lastWeatherAt >= 60000 || !weather) loadWeather(token);
            }
            function failed() {
                if (token !== generation || simulated || disposed) return;
                devicePosition = null; update();
                if (!confirmedPosition) byId('positionStatus').textContent = '定位未获许可或暂不可用，可在对话中说明起点';
                loadWeather(token);
            }
            var settings = {enableHighAccuracy:true,timeout:10000,maximumAge:0};
            if (enabled && navigator.geolocation.watchPosition) watchId = navigator.geolocation.watchPosition(received,failed,settings);
            else {
                // Older WebViews can keep one bounded poll, never overlapping requests.
                function sample() {
                    navigator.geolocation.getCurrentPosition(function (result) { received(result); again(); },function () { failed(); again(); },settings);
                }
                function again() {
                    if (enabled && token === generation && !simulated && !document.hidden && !disposed) pollTimer = setTimeout(sample,20000);
                }
                sample();
            }
        }
        function resetEvidence() {
            generation++; stopWatch(); clearTimeout(demoTimer); demoTimer = null; clearOffer(); companion.reset();
            environmentRevision++; recheck = null;
            confirmedPosition = null; devicePosition = null; simulatedPosition = null;
        }
        async function startDemo(id) {
            var intent = ++actionGeneration;
            if (await options.onBoundary() === false) return;
            if (intent !== actionGeneration || disposed || document.hidden) return;
            resetEvidence(); simulated = true; enabled = true; companion.setEnabled(true);
            demoTime = Date.parse(new Date().toISOString().slice(0,10) + 'T04:00:00Z');
            demoAnchor = Date.now();
            simulatedPosition = {placeId:id,source:'simulated',timestamp:demoTime};
            byId('weatherStatus').textContent = '模拟天气 晴 18℃'; weatherEvidence(null); update();
            byId('demoPanel').hidden = true; byId('demoToggle').setAttribute('aria-expanded','false');
            var token = generation;
            demoTimer = setTimeout(function () {
                if (token !== generation || !simulated || document.hidden) return;
                demoTime += 30000; demoAnchor = Date.now(); simulatedPosition = {placeId:id,source:'simulated',timestamp:demoTime}; update();
            }, 1000);
        }
        async function exitDemo() {
            var intent = ++actionGeneration;
            var boundary = options.onBoundary();
            resetEvidence(); simulated = false; weather = null; weatherEvidence(null); update();
            await boundary;
            if (intent === actionGeneration && !disposed) {
                // Cancellation may echo the server's pre-demo confirmation. Leaving the demo
                // explicitly discards it before establishing fresh real-world evidence.
                resetEvidence(); locate();
            }
        }
        function setContext(next) {
            context = next;
            var serverTime = typeof next.serverTime === 'string' ? Date.parse(next.serverTime) : NaN;
            if (Number.isFinite(serverTime)) serverOffset = serverTime - Date.now();
            var physical = place(next.position && next.position.placeId);
            if (!simulated) {
                if (Object.prototype.hasOwnProperty.call(next,'position') && next.position === null) confirmedPosition = null;
                else if (physical && physical.campusId === next.campusId && next.position.source === 'confirmed') {
                    confirmedPosition = {placeId:physical.id,source:'confirmed',timestamp:next.position.timestamp};
                }
                if (confirmedPosition && Object.prototype.hasOwnProperty.call(next,'campusId')
                        && place(confirmedPosition.placeId).campusId !== next.campusId) confirmedPosition = null;
            }
            update();
        }
        function accept() {
            if (!currentOffer || options.isBusy()) return;
            var accepted = companion.accept(currentOffer.id); clearOffer();
            if (accepted) options.onAccept(accepted.messageToSend);
        }
        byId('recheckPosition').addEventListener('click', function () {
            var offered = recheck;
            syncEnvironment(physicalPosition());
            if (!offered || offered.revision !== environmentRevision || disposed || document.hidden || simulated || !enabled
                    || options.isBusy() || !confirmedPosition || offered.placeId !== confirmedPosition.placeId
                    || offered.timestamp !== confirmedPosition.timestamp || now() - offered.timestamp < 20000) return;
            confirmedPosition = {placeId:offered.placeId,source:'confirmed',timestamp:now()};
            update();
        });
        byId('acceptOffer').addEventListener('click', accept);
        byId('dismissOffer').addEventListener('click', function () { companion.dismiss(); clearOffer(); });
        byId('companionToggle').addEventListener('click', function () {
            enabled = !enabled; companion.setEnabled(enabled);
            if (!enabled) { generation++; stopWatch(); clearOffer(); }
            update(); if (enabled && !simulated) locate();
        });
        byId('locatePosition').addEventListener('click', locate);
        byId('demoToggle').addEventListener('click', function () { var panel = byId('demoPanel'); panel.hidden = !panel.hidden; byId('demoToggle').setAttribute('aria-expanded',String(!panel.hidden)); });
        byId('demoDining').addEventListener('click', function () { startDemo('pingleyuan-north-dining'); });
        byId('demoLibrary').addEventListener('click', function () { startDemo('pingleyuan-library'); });
        byId('exitDemo').addEventListener('click', exitDemo);
        document.addEventListener('visibilitychange', function () {
            actionGeneration++; generation++; stopWatch(); clearTimeout(demoTimer); clearOffer();
            if (document.hidden) { devicePosition = null; simulatedPosition = null; update(); }
            else if (!simulated) { update(); if (enabled) locate(); }
            else { simulatedPosition = null; update(); byId('positionStatus').textContent = '模拟采样已暂停，请重新选择情境'; }
        });
        loadWeather(generation); pulse();
        return {update:update,setContext:setContext,quiet:quiet,
            snapshot:function () {
                var position = physicalPosition();
                return {simulated:simulated,position:position ? Object.assign({},position) : null,hour:hour(),time:new Date(displayTime()).toISOString(),weather:simulated ? {status:'simulated',label:'晴',temperatureC:18} : weather};
            },
            campusId:function () { return simulated ? 'pingleyuan' : context.campusId; },
            reset:function () {
                actionGeneration++; resetEvidence(); simulated = false; weather = null; context = {}; weatherEvidence(null); update();
                if (enabled && !document.hidden) locate(); else loadWeather(generation);
            },
            destroy:function () { disposed = true; actionGeneration++; generation++; stopWatch(); clearTimeout(demoTimer); clearTimeout(pulseTimer); companion.reset(); clearOffer(); }};
    }
    root.CampusEnvironment = {create:create};
})(window);
