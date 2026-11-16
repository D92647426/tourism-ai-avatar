/* REQ-064: device-local outfit selection with an accessible, nonmodal wardrobe. */
(function (root) {
    'use strict';
    /** Connect the wardrobe to the stable avatar controller.
     * Only a successful latest selection changes the active button and preference.
     * Returns destroy() for the page lifecycle. See docs/campus_avatar.md. */
    function create(options) {
        var byId = function (id) { return root.document.getElementById(id); };
        var panel = byId('appearancePanel'), toggle = byId('appearanceToggle');
        var status = byId('appearanceStatus'), choices = byId('appearanceChoices');
        var avatar = options.avatar, buttons = [], sequence = 0, disposed = false;
        function update() {
            var state = avatar.getState();
            buttons.forEach(function (button) {
                button.setAttribute('aria-pressed',String(button.dataset.appearance === state.appearance));
            });
            choices.setAttribute('aria-busy',String(state.loading));
        }
        function close(restoreFocus) {
            panel.hidden = true; toggle.setAttribute('aria-expanded','false');
            if (restoreFocus) toggle.focus();
        }
        function open() {
            panel.hidden = false; toggle.setAttribute('aria-expanded','true');
            var current = buttons.find(function (button) { return button.getAttribute('aria-pressed') === 'true'; });
            (current || buttons[0]).focus();
        }
        async function choose(item) {
            var own = ++sequence;
            status.textContent = '正在换上' + item.label + '…';
            var promise = avatar.setAppearance(item.id); update();
            var success = await promise;
            if (disposed || own !== sequence) return;
            update();
            var state = avatar.getState();
            status.textContent = success ? '已换上' + item.label + (!state.ready ? '，当前使用静态立绘。' : state.remembered ? '，下次打开继续穿这套。' : '，本次生效，浏览器未能保存偏好。')
                : '这套形象暂未加载成功，请再点一次重试。';
            if (success && !panel.hidden && root.matchMedia('(max-width: 650px)').matches) close(true);
        }
        avatar.getAppearances().forEach(function (item) {
            var button = root.document.createElement('button'); button.type = 'button';
            button.dataset.appearance = item.id; button.className = 'appearance-option';
            button.setAttribute('aria-pressed','false');
            var image = root.document.createElement('img'); image.src = item.portrait;
            image.alt = ''; image.width = 1254; image.height = 1254;
            var label = root.document.createElement('span'); label.textContent = item.label;
            button.append(image,label); button.addEventListener('click',function () { choose(item); });
            choices.appendChild(button); buttons.push(button);
        });
        function togglePanel() { if (panel.hidden) open(); else close(true); }
        function closePanel() { close(true); }
        function escape(event) { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(true); } }
        function outside(event) { if (!panel.hidden && !panel.contains(event.target) && !toggle.contains(event.target)) close(false); }
        toggle.addEventListener('click',togglePanel);
        byId('closeAppearance').addEventListener('click',closePanel);
        root.document.addEventListener('keydown',escape);
        root.document.addEventListener('pointerdown',outside);
        update(); avatar.ready.then(function () { if (!disposed) update(); });
        return {close:close,destroy:function () {
            disposed = true; sequence++; close(false);
            toggle.removeEventListener('click',togglePanel);
            byId('closeAppearance').removeEventListener('click',closePanel);
            root.document.removeEventListener('keydown',escape);
            root.document.removeEventListener('pointerdown',outside);
        }};
    }
    root.CampusAppearance = {create:create};
})(window);
