/* REQ-061: explicit virtual location draft, manual clock and map test dialog. */
(function (root) {
    'use strict';
    /** Bind the environment APIs for explicit, page-local virtual positioning. */
    function create(options) {
        var byId = function (id) { return document.getElementById(id); };
        var dialog = byId('locationLab'), map = null, points = [], previewPoint = null, loadGeneration = 0, disposed = false, busy = false;
        var controls = ['labCampus','labPlace','labLatitude','labLongitude','labAccuracy','labTime','applyVirtualPosition'];
        function campus() { return options.catalog.campuses.find(function (item) { return item.id === byId('labCampus').value; }); }
        function status(message) { byId('labStatus').textContent = message; }
        function number(id) { var value = byId(id).value.trim(); return value ? Number(value) : NaN; }
        function draft() {
            var time = /^(\d{2}):(\d{2})$/.exec(byId('labTime').value);
            var sample = {campusId:byId('labCampus').value,placeId:byId('labPlace').value || null,
                hour:time ? Number(time[1]) : NaN,minute:time ? Number(time[2]) : NaN};
            if (byId('labLatitude').value.trim() || byId('labLongitude').value.trim()) {
                sample.latitude = number('labLatitude'); sample.longitude = number('labLongitude'); sample.accuracy = number('labAccuracy');
            }
            return sample;
        }
        function preview(point) {
            if (!point || busy || disposed) return;
            byId('labLatitude').value = point.latitude.toFixed(6); byId('labLongitude').value = point.longitude.toFixed(6);
            byId('labPlace').value = point.placeId || '';
            previewPoint = Object.assign({},point);
            if (map) map.setPreview(point);
            status('虚拟位置草稿已选中，点击“应用虚拟定位”开始测试。');
        }
        function choosePlace() {
            var point = points.find(function (item) { return item.placeId === byId('labPlace').value; });
            if (point) preview(point);
            else {
                byId('labLatitude').value = ''; byId('labLongitude').value = '';
                previewPoint = null;
                if (map) map.setPreview(null);
                status(byId('labPlace').value ? '该地点坐标待补充，可按模拟地点测试问答与提醒。' : '在地图点选坐标，或手动填写经纬度。');
            }
        }
        function populatePlaces() {
            var selected = byId('labPlace').value;
            var select = byId('labPlace'); select.replaceChildren(CampusScene.element('option','仅坐标，建筑未知'));
            select.children[0].value = '';
            options.catalog.places.filter(function (place) { return place.campusId === campus().id; }).forEach(function (place) {
                var known = points.some(function (point) { return point.placeId === place.id; });
                var option = CampusScene.element('option',place.name + (known ? '（OSM参考点）' : '（坐标待补充）')); option.value = place.id; select.appendChild(option);
            });
            select.value = options.catalog.places.some(function (place) { return place.id === selected && place.campusId === campus().id; }) ? selected : '';
        }
        function openMap(resetDraft) {
            var own = ++loadGeneration, selectedCampus = campus();
            if (map) map.destroy(); points = [];
            if (resetDraft) { byId('labPlace').value = ''; byId('labLatitude').value = ''; byId('labLongitude').value = ''; previewPoint = null; }
            populatePlaces();
            map = CampusMap.create({campus:selectedCampus,catalog:options.catalog,environment:options.environment.snapshot(),onSelect:preview});
            if (previewPoint) map.setPreview(previewPoint);
            byId('labMap').replaceChildren(map.element);
            CampusMap.loadData(selectedCampus.id).then(function (data) {
                if (disposed || own !== loadGeneration) return;
                points = data.points; populatePlaces();
            }).catch(function () { if (!disposed && own === loadGeneration) status('地图参考点暂未读取，可手动填写坐标或选择模拟地点。'); });
        }
        function update(snapshot) {
            if (disposed) return;
            if (map) map.update(snapshot);
            controls.forEach(function (id) { byId(id).disabled = busy; });
            byId('advanceVirtualTime').disabled = busy || !snapshot.simulated || !snapshot.position;
            byId('exitVirtualPosition').disabled = busy || !snapshot.simulated;
            var p = options.catalog.places.find(function (place) { return snapshot.position && place.id === snapshot.position.placeId; });
            var clock = typeof snapshot.time === 'string' ? new Date(Date.parse(snapshot.time) + 8 * 3600000).toISOString().slice(11,19) : '';
            byId('labActiveState').textContent = !snapshot.simulated ? '尚未启用虚拟定位' : !snapshot.position ? '虚拟采样已暂停，请重新应用位置'
                : '虚拟定位进行中 · ' + (p ? p.name : '建筑未知') + ' · ' + clock;
            byId('labActiveState').dataset.simulated = String(!!snapshot.simulated);
        }
        async function apply(event) {
            event.preventDefault(); if (busy || disposed) return;
            busy = true; update(options.environment.snapshot()); status('正在应用虚拟条件…');
            try {
                var accepted = await options.environment.applyVirtualPosition(draft());
                if (disposed) return;
                if (accepted) { previewPoint = null; if (map) map.setPreview(null); status('虚拟定位已应用。可推进30秒采样，再返回对话测试。'); }
                else status('当前操作已失效，请重新应用虚拟位置。');
            } catch (_) { if (!disposed) status('请检查校区、地点、经纬度、精度和时间。坐标需成对填写。'); }
            finally { busy = false; if (!disposed) update(options.environment.snapshot()); }
        }
        options.catalog.campuses.forEach(function (item) { var option = CampusScene.element('option',item.name); option.value = item.id; byId('labCampus').appendChild(option); });
        byId('labCampus').value = options.catalog.campuses[0].id;
        // The dialog remains separate from the opening character stage and the normal composer.
        byId('openLocationLab').addEventListener('click',function () {
            if (disposed) return;
            dialog.showModal(); if (!map) openMap(false); else map.refresh(); update(options.environment.snapshot()); options.onState();
        });
        function close() { dialog.close(); }
        byId('closeLocationLab').addEventListener('click',close); byId('returnFromLocationLab').addEventListener('click',close);
        dialog.addEventListener('close',function () {
            if (dialog.open) return;
            loadGeneration++; if (map) map.destroy(); map = null; options.onState();
        });
        byId('labCampus').addEventListener('change',function () { openMap(true); }); byId('labPlace').addEventListener('change',choosePlace);
        ['labLatitude','labLongitude'].forEach(function (id) { byId(id).addEventListener('input',function () {
            byId('labPlace').value = ''; previewPoint = draft(); if (map) map.setPreview(previewPoint); status('坐标草稿已改变，点击应用后生效。');
        }); });
        byId('locationLabForm').addEventListener('submit',apply);
        byId('advanceVirtualTime').addEventListener('click',function () {
            if (busy) return;
            status(options.environment.advanceSimulation(30) ? '手动模拟时钟已推进30秒，并取得新的虚拟位置采样。' : '当前没有有效的虚拟采样，请重新应用位置。');
        });
        byId('exitVirtualPosition').addEventListener('click',async function () {
            if (busy || disposed) return;
            busy = true; update(options.environment.snapshot());
            try {
                var synced = await options.environment.exitSimulation();
                if (!disposed) status(synced ? '已退出虚拟定位，正在按设备权限获取真实位置。' : '虚拟条件已清除，请恢复连接后继续。');
            }
            catch (_) { if (!disposed) status('退出状态尚未同步，请重新连接后再试。'); }
            finally { busy = false; if (!disposed) update(options.environment.snapshot()); }
        });
        update(options.environment.snapshot());
        return {update:update,isOpen:function () { return dialog.open; },destroy:function () { disposed = true; loadGeneration++; if (map) map.destroy(); }};
    }
    root.CampusLocationLab = {create:create};
})(window);
