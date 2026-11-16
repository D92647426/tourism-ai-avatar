/* REQ-054/055/058: catalog-driven DOM rendering. No chat or physical-location writes. */
(function (root) {
    'use strict';
    function element(tag, text, className) {
        var node = document.createElement(tag);
        if (text != null) node.textContent = text;
        if (className) node.className = className;
        return node;
    }
    function safeUrl(url) {
        try { var parsed = new URL(url); return /^https?:$/.test(parsed.protocol) ? parsed.href : null; }
        catch (_) { return null; }
    }
    function link(text, url) {
        var node = element('a', text), safe = safeUrl(url);
        if (safe) { node.href = safe; node.target = '_blank'; node.rel = 'noopener noreferrer'; }
        return node;
    }
    /** Build a campus boundary only from finite catalog points. Entrances remain unknown. */
    function mapPanel(campus) {
        var container = element('div', null, 'map-preview'), data = campus.mapPreview;
        container.appendChild(element('h2', '校园范围示意'));
        if (!data || !Array.isArray(data.bbox) || data.bbox.length !== 4 || !data.bbox.every(Number.isFinite)) {
            container.appendChild(element('p', campus.address + '。校内地图资料待补充。')); return container;
        }
        var box = data.bbox, width = box[2] - box[0], height = box[3] - box[1];
        var points = (data.boundary || []).filter(function (p) { return Array.isArray(p) && p.length === 2 && p.every(Number.isFinite); });
        if (width <= 0 || height <= 0 || points.length < 3) return container;
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 480 240'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', campus.name + '校园范围，建筑入口待核验');
        var polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        var longitudeScale = Math.cos((box[1] + box[3]) / 2 * Math.PI / 180);
        var scale = Math.min(400 / (width * longitudeScale), 200 / height);
        var originX = (480 - width * longitudeScale * scale) / 2;
        polygon.setAttribute('points', points.map(function (p) {
            return (originX + (p[0] - box[0]) * longitudeScale * scale).toFixed(2) + ',' + (220 - (p[1] - box[1]) * scale).toFixed(2);
        }).join(' '));
        polygon.setAttribute('fill', '#c3dce8'); polygon.setAttribute('stroke', '#416e8f'); polygon.setAttribute('stroke-width', '2');
        svg.appendChild(polygon); container.appendChild(svg);
        container.appendChild(element('p', '校园边界来自 OpenStreetMap。建筑入口与步行路线待核验。', 'map-caption'));
        container.appendChild(link(data.attribution, data.sourceUrl));
        container.appendChild(element('span', ' · ')); container.appendChild(link('ODbL', 'https://www.openstreetmap.org/copyright'));
        container.appendChild(element('p', '地图数据 ' + String(data.dataTime).slice(0, 10), 'map-caption'));
        var details = element('details'), summary = element('summary', '打开在线底图'); details.appendChild(summary);
        details.addEventListener('toggle', function () {
            if (!details.open || details.dataset.loaded) return;
            details.dataset.loaded = 'true';
            var frame = element('iframe'); frame.title = 'OpenStreetMap 校园在线底图'; frame.loading = 'lazy';
            frame.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + box.join('%2C') + '&layer=mapnik';
            frame.referrerPolicy = 'no-referrer'; details.appendChild(frame);
        });
        container.appendChild(details); return container;
    }
    /** REQ-060: render catalog scenes with interruptible transitions and epoch-owned backgrounds. */
    function create(options) {
        var catalog = options.catalog, epoch = 0, displayedEpoch = 0, activeTransition = null, backgroundIndex = 0;
        var stage = document.getElementById('campusStage'), panel = document.getElementById('scenePanel');
        var content = document.getElementById('sceneContent'), backdrop = document.getElementById('sceneBackdrop');
        var backgroundLayers = [element('div', null, 'scene-backdrop-layer'), element('div', null, 'scene-backdrop-layer')];
        backgroundLayers.forEach(function (layer) { backdrop.appendChild(layer); });
        backdrop.style.backgroundImage = '';
        function invalidate(discardImages) {
            epoch++;
            if (discardImages) displayedEpoch = 0;
            if (activeTransition) { activeTransition.skipTransition(); activeTransition = null; }
            return epoch;
        }
        function clipSnapshots() {
            var bounds = stage.getBoundingClientRect();
            document.documentElement.style.setProperty('--scene-clip-top', Math.max(0, bounds.top) + 'px');
            document.documentElement.style.setProperty('--scene-clip-bottom', Math.max(0, root.innerHeight - bounds.bottom) + 'px');
        }
        /** Skip only animation on interruption. A delayed browser update still needs its epoch check. */
        function transition(update, own) {
            var committed = false;
            var animated = typeof document.startViewTransition === 'function' && !document.hidden
                && !root.matchMedia('(prefers-reduced-motion: reduce)').matches;
            function commit() {
                if (epoch !== own || committed) return;
                committed = true; panel.dataset.motion = animated ? 'view' : 'fallback'; update();
                if (animated) clipSnapshots();
            }
            if (!animated) { commit(); return; }
            try {
                clipSnapshots();
                var current = document.startViewTransition(commit); activeTransition = current;
                current.ready.catch(function () { animated = false; if (epoch === own) panel.dataset.motion = 'fallback'; });
                current.finished.catch(function () {}).then(function () { if (activeTransition === current) activeTransition = null; });
            } catch (_) { animated = false; commit(); }
        }
        function showBackground(path, own) {
            if (displayedEpoch !== own) return;
            if (!path) { backgroundLayers.forEach(function (layer) { layer.style.opacity = '0'; }); return; }
            backgroundIndex = 1 - backgroundIndex;
            var next = backgroundLayers[backgroundIndex], previous = backgroundLayers[1 - backgroundIndex];
            next.style.transition = 'none'; next.style.opacity = '0'; next.style.backgroundImage = 'url("' + path + '")';
            void next.offsetWidth;
            root.requestAnimationFrame(function () {
                if (displayedEpoch !== own) return;
                next.style.transition = ''; next.style.opacity = '1'; previous.style.opacity = '0';
            });
        }
        function place(id) { return catalog.places.find(function (p) { return p.id === id; }); }
        function photoFor(p) { return catalog.assets.find(function (a) { return a.placeId === p.id && a.kind === 'photo'; }); }
        function photo(asset, own, background) {
            var figure = element('figure', null, 'scene-photo'), img = element('img');
            img.alt = asset.alt; img.loading = 'lazy'; figure.appendChild(img);
            if (background) figure.style.viewTransitionName = 'campus-photo';
            var caption = element('figcaption', asset.alt + '。');
            caption.appendChild(link('官方来源', asset.sourceUrl));
            if (asset.placeId && /dining/.test(asset.placeId)) caption.appendChild(element('span', ' 官方介绍配图，拍摄时间未标明。当前菜品和价格请查看现场公示。'));
            figure.appendChild(caption);
            // These handlers own only their image, including a retained KEEP_SCENE after a new request.
            function revealPhoto() { img.classList.add('is-ready'); }
            img.addEventListener('load', function () {
                // A pending photo fades in after its snapshot is removed, avoiding a final-frame pop.
                if (activeTransition) activeTransition.finished.then(revealPhoto, revealPhoto);
                else revealPhoto();
            });
            img.addEventListener('error', function () { img.hidden = true; caption.textContent = '实景暂时未能加载，可以继续查看地点资料。'; });
            img.src = asset.path;
            if (img.complete && img.naturalWidth) revealPhoto();
            if (background) {
                var loader = new Image();
                loader.onload = function () { showBackground(asset.path, own); };
                loader.onerror = function () { showBackground(null, own); };
                loader.src = asset.path;
            }
            return figure;
        }
        function detailsFor(p, own, context, route) {
            var area = element('div'), campus = catalog.campuses.find(function (c) { return c.id === p.campusId; });
            var asset = photoFor(p); if (asset) area.appendChild(photo(asset, own, true));
            area.appendChild(element('p', p.summary));
            area.appendChild(element('p', p.address));
            area.appendChild(element('p', '建筑入口坐标待核验 · 资料核验 ' + p.verifiedAt, 'scene-meta'));
            if (route) {
                var start = place(context.position && context.position.placeId), address = element('div', null, 'route-address');
                address.appendChild(element('p', '从 ' + (start ? start.name + ' ' + start.address : '尚未确认的起点')));
                address.appendChild(element('p', '到 ' + p.name + ' ' + p.address)); area.appendChild(address);
            }
            var floor = catalog.assets.find(function (a) { return a.placeId === p.id && a.kind === 'floorplan'; });
            if (floor) {
                var layout = element('details', null, 'scene-details'); layout.appendChild(element('summary', '查看一层布局'));
                layout.appendChild(element('p', '查看入口、咨询台与阅览分区。可点击图片查看原尺寸。'));
                var full = element('a'); full.href = floor.path; full.target = '_blank'; full.rel = 'noopener noreferrer';
                var plan = element('img', null, 'floorplan'); plan.src = floor.path; plan.alt = floor.alt; plan.loading = 'lazy'; full.appendChild(plan); layout.appendChild(full);
                layout.appendChild(link('图书馆官方布局', floor.sourceUrl)); area.appendChild(layout);
            }
            if (campus) area.appendChild(mapPanel(campus));
            var actions = element('div', null, 'scene-actions');
            var keyword = '北京工业大学 ' + (campus ? campus.name : '') + ' ' + p.name + ' ' + p.address;
            actions.appendChild(link('在高德搜索这个地点', 'https://uri.amap.com/search?keyword=' + encodeURIComponent(keyword) + '&city=' + encodeURIComponent('北京') + '&view=map&src=bjut-campus-demo'));
            actions.appendChild(link('查看学校资料', p.sourceUrl)); area.appendChild(actions);
            area.appendChild(element('p', '外部地图搜索结果请先核对，再选择导航。', 'scene-meta'));
            return area;
        }
        function renderContent(turn, own) {
            var action = turn.sceneAction || {};
            displayedEpoch = own;
            content.replaceChildren(); stage.scrollTop = 0;
            var places = (action.placeIds || []).map(place).filter(Boolean), p = places[0];
            stage.classList.add('has-scene'); panel.hidden = false;
            var task = catalog.tasks.find(function (t) { return t.id === action.taskId; });
            content.appendChild(element('h1', action.type === 'SHOW_DINING' ? '今天在校园吃什么' : task ? task.name : p ? p.name : action.title || '校园里的下一站'));
            if (task) {
                var variant = task.variants.find(function (v) { return v.campusId === turn.context.campusId && v.audiences.indexOf(turn.context.audience || 'student') !== -1; });
                if (variant) {
                    var steps = element('ol'); variant.steps.forEach(function (s) { steps.appendChild(element('li', s)); }); content.appendChild(steps);
                    if (variant.unknownFields.length) content.appendChild(element('p', '材料、时段与适用条件请再核对当前通知。', 'unknown-note'));
                }
            }
            if (action.type === 'SHOW_MAP') {
                var campus = catalog.campuses.find(function (item) { return item.id === (turn.context || {}).campusId; });
                content.appendChild(campus ? mapPanel(campus) : element('p', '校区待确认，可以先在对话中说明校区。'));
            } else if (action.type === 'SHOW_WEATHER') {
                content.appendChild(element('p', turn.reply));
                var evidence = element('a', '查看天气资料与来源'); evidence.href = '#weatherDetails';
                evidence.addEventListener('click', function () { document.getElementById('weatherDetails').open = true; });
                content.appendChild(evidence);
            } else if (action.type === 'SHOW_DINING') {
                var list = element('div', null, 'place-list');
                places.forEach(function (item) {
                    var card = element('article', null, 'place-item'); card.appendChild(element('h2', item.name));
                    var asset = photoFor(item); if (asset) card.appendChild(photo(asset, own, false));
                    card.appendChild(element('p', item.summary)); card.appendChild(element('p', item.address, 'scene-meta'));
                    var button = element('button', '看看' + item.name); button.type = 'button'; button.addEventListener('click', function () { options.onChoice('看看' + item.name); }); card.appendChild(button); list.appendChild(card);
                });
                content.appendChild(list); content.appendChild(element('p', '营业时段、价格和当前供应待核实。评分资料待补充。', 'scene-meta'));
            } else if (p) content.appendChild(detailsFor(p, own, turn.context || {}, action.type === 'SHOW_ROUTE'));
            if (!p || !photoFor(p) || action.type === 'SHOW_MAP' || action.type === 'SHOW_WEATHER' || action.type === 'SHOW_DINING') showBackground(null, own);
        }
        /** Atomically update scene and reply. No animation callback may write after invalidate/clear. */
        function render(turn, updateDialogue) {
            var action = turn.sceneAction || {}, own = invalidate();
            if (action.type === 'KEEP_SCENE') { if (updateDialogue) updateDialogue(); return; }
            if (action.type === 'RETURN_STAGE') { clear(updateDialogue); return; }
            transition(function () { renderContent(turn, own); if (updateDialogue) updateDialogue(); }, own);
        }
        function clear(updateDialogue) {
            var own = invalidate(true);
            transition(function () {
                displayedEpoch = own;
                showBackground(null, own); content.replaceChildren(); stage.scrollTop = 0;
                panel.hidden = true; stage.classList.remove('has-scene');
                if (updateDialogue) updateDialogue();
            }, own);
        }
        return {render:render, clear:clear, invalidate:invalidate, place:place};
    }
    root.CampusScene = {create:create, element:element, link:link};
})(window);
