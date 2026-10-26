/* REQ-032: local notebook persistence and safe page adapter. */
(function (root, factory) {
    'use strict';
    var api = factory(typeof module === 'object' && module.exports ? require('./exploration-core.js') : root.GuideExploration);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else { root.GuideExplorationPage = api; if (root.document) api.mount(root); }
})(typeof window !== 'undefined' ? window : globalThis, function (core) {
    'use strict';

    /** REQ-032: user-scoped local JSON store; catches unavailable/corrupt storage.
     * Inputs: Storage-compatible object, nonempty userId, optional warning callback.
     * Output: current/journal readers and boolean writers; no network operations.
     * Throws for missing identity; storage errors are reported through onWarning.
     * Modify persistence here; see docs/exploration_design.md, storage boundary.
     */
    function createStore(storage, userId, onWarning) {
        if (typeof userId !== 'string' || !userId.trim()) throw new Error('请先登录后记录旅程。');
        var user = encodeURIComponent(userId);
        var journalCache = Object.create(null);
        function warn() { if (onWarning) onWarning('本机存储不可用或记录损坏，本次修改可能无法在刷新后保留。请下载旅程手册。'); }
        function read(key) {
            try { var value = storage.getItem(key); return value ? JSON.parse(value) : null; }
            catch (error) { warn(); return null; }
        }
        function write(key, value) {
            try { storage.setItem(key, JSON.stringify(value)); return true; }
            catch (error) { warn(); return false; }
        }
        function journalKey(pack) { return 'tourism-journal:v1:' + user + ':' + pack.id + ':' + pack.version; }
        return {
            current: function () { return read('tourism-explore:v1:' + user); },
            saveCurrent: function (value) { return write('tourism-explore:v1:' + user, value); },
            journal: function (pack) {
                var key = journalKey(pack);
                return core.restore(pack, Object.prototype.hasOwnProperty.call(journalCache, key) ? journalCache[key] : read(key));
            },
            saveJournal: function (pack, journal) {
                var key = journalKey(pack), clean = core.restore(pack, journal);
                journalCache[key] = clean;
                return write(key, clean);
            }
        };
    }

    /** REQ-032: mount the observation notebook on the existing tourist page.
     * Input: browser window with DOM/fetch/File/Blob; output: Promise<void>.
     * Content/storage/file failures appear in the live status region, never as HTML.
     * Change interaction/rendering here; rules remain in exploration-core.js.
     * See docs/exploration_design.md for acceptance and explicit limitations.
     */
    async function mount(win) {
        var doc = win.document, byId = function (id) { return doc.getElementById(id); };
        if (!byId('exploration') || !core) return;
        var pack, journal, selectedId, pendingPack = null, importGeneration = 0;
        var storageWarning = '', store, draftByTask = Object.create(null);
        var input = byId('exploreObservation'), mode = byId('exploreMode');
        function status(message, error) {
            byId('exploreStatus').textContent = (message || '') + (storageWarning ? ' ' + storageWarning : '');
            byId('exploreStatus').dataset.error = error || storageWarning ? 'true' : 'false';
        }
        function keepCurrent() { store.saveCurrent({ schemaVersion: 1, pack: pack, selectedId: selectedId, mode: mode.value }); }
        function task() { return pack.tasks.find(function (item) { return item.id === selectedId; }); }
        function entryFor(id) { return Object.prototype.hasOwnProperty.call(journal.entries, id) ? journal.entries[id] : null; }
        function text(tag, value, className) {
            var node = doc.createElement(tag); node.textContent = value;
            if (className) node.className = className;
            return node;
        }
        function renderStations() {
            var nav = byId('exploreStations'); nav.replaceChildren();
            pack.tasks.forEach(function (item, index) {
                var button = doc.createElement('button'); button.type = 'button'; button.className = 'explore-station';
                button.setAttribute('aria-current', item.id === selectedId ? 'step' : 'false');
                button.appendChild(text('strong', (index + 1) + '. ' + item.spotName));
                button.appendChild(text('span', entryFor(item.id) ? '已记录' : '等待你的发现'));
                button.addEventListener('click', function () {
                    draftByTask[selectedId] = input.value; selectedId = item.id; renderTask(); renderStations(); keepCurrent();
                });
                nav.appendChild(button);
            });
        }
        function renderTask() {
            var item = task(), entry = entryFor(item.id);
            byId('exploreSpot').textContent = item.spotName;
            byId('exploreTaskTitle').textContent = item.title;
            byId('explorePrompt').textContent = item.prompt;
            byId('exploreHint').textContent = item.hint;
            input.value = Object.prototype.hasOwnProperty.call(draftByTask, item.id) ? draftByTask[item.id] : entry ? entry.text : '';
            byId('exploreReference').textContent = item.reference;
            byId('exploreSource').textContent = item.source.title;
            byId('exploreSource').href = item.source.url;
            byId('exploreSourceStatus').textContent = item.source.status === 'inherited-unverified' ? '老师项目资料，待实地或官方核对。' : '原创课堂演示材料，不代表真实景区事实。';
            byId('exploreFeedback').hidden = !entry;
            if (entry) {
                var feedback = core.compare(item, entry.text);
                byId('exploreComparison').textContent = (feedback.mentioned.length ? '你的讲解提到了：' + feedback.mentioned.join('、') + '。' : '你已留下自己的观察。') + (feedback.toExplore.length ? '还可以观察：' + feedback.toExplore.join('、') + '。' : '可以进一步解释这些细节之间的联系。');
            }
        }
        function renderJournal() {
            var list = byId('exploreEntries'); list.replaceChildren();
            var count = 0;
            pack.tasks.forEach(function (item) {
                var entry = entryFor(item.id); if (!entry) return; count++;
                var li = doc.createElement('li'); li.appendChild(text('h3', item.spotName));
                li.appendChild(text('small', (entry.mode === 'demo' ? '课堂演示' : '现场个人记录，未验证到访') + ' · ' + new Date(entry.recordedAt).toLocaleString('zh-CN')));
                li.appendChild(text('p', entry.text)); list.appendChild(li);
            });
            byId('exploreProgress').textContent = '已记录 ' + count + ' / ' + pack.tasks.length + ' 站';
            byId('exploreEmpty').hidden = count > 0;
            byId('exploreExportJournal').disabled = count === 0;
        }
        function activate(nextPack) {
            pack = nextPack; journal = store.journal(pack); selectedId = pack.tasks[0].id; draftByTask = Object.create(null);
            byId('explorePackTitle').textContent = pack.title;
            byId('exploreLicense').textContent = '内容作者：' + pack.author + '。' + pack.licenseNotice;
            renderTask(); renderStations(); renderJournal();
        }
        function download(content, name, type) {
            var url = win.URL.createObjectURL(new win.Blob([content], { type: type }));
            var a = doc.createElement('a'); a.href = url; a.download = name; doc.body.appendChild(a); a.click(); a.remove();
            win.setTimeout(function () { win.URL.revokeObjectURL(url); }, 1000);
        }
        try {
            var userId;
            try { userId = win.localStorage.getItem('userId'); }
            catch (error) { userId = 'temporary-session'; storageWarning = '浏览器禁止存储，当前为临时体验。'; }
            // A blocked Storage getter is handled through a throwing adapter.
            var storage;
            try { storage = win.localStorage; } catch (error) { storage = { getItem: function () { throw error; }, setItem: function () { throw error; } }; }
            store = createStore(storage, userId, function (warning) { storageWarning = warning; status(''); });
            var saved = store.current(), savedPack;
            if (saved && saved.schemaVersion === 1) {
                try { savedPack = core.validatePack(saved.pack); }
                catch (error) { storageWarning = '旧内容包无法恢复，已打开默认内容；已保存的其他旅程仍保留。'; }
            }
            if (!savedPack) {
                var response = await win.fetch('/exploration/lingshan-demo.json');
                if (!response.ok) throw new Error('默认内容包无法读取，请刷新页面重试。');
                savedPack = core.validatePack(await response.json());
            }
            activate(savedPack);
            if (saved && savedPack.tasks.some(function (item) { return item.id === saved.selectedId; })) selectedId = saved.selectedId;
            if (saved && ['demo', 'onsite'].indexOf(saved.mode) !== -1) mode.value = saved.mode;
            renderTask(); renderStations(); byId('exploreWorkspace').hidden = false;
            status('选一站开始。可以在教室演示，也可以留待现场观察。');
        } catch (error) { status(error.message || '观察手册暂时无法打开，请刷新后重试。', true); return; }

        mode.addEventListener('change', function () { keepCurrent(); status(mode.value === 'demo' ? '之后保存的记录标记为课堂演示。' : '之后保存的记录标记为现场个人记录，不验证到访。'); });
        byId('exploreForm').addEventListener('submit', function (event) {
            event.preventDefault();
            try {
                journal = core.record(pack, journal, selectedId, { text: input.value, mode: mode.value }, new Date().toISOString());
                draftByTask[selectedId] = entryFor(selectedId).text; store.saveJournal(pack, journal); keepCurrent();
                renderTask(); renderStations(); renderJournal(); status('发现已记录。可对照资料，或带着它继续问导游。');
            } catch (error) { status(error.message, true); }
        });
        byId('exploreAsk').addEventListener('click', function (event) {
            event.stopPropagation();
            try {
                // Build from the visible draft so edits are never silently replaced by an older saved observation.
                var scratch = core.record(pack, journal, selectedId, { text: input.value, mode: mode.value }, new Date().toISOString());
                var prompt = core.buildPrompt(pack, selectedId, scratch.entries[selectedId]);
                var result = win.GuideChatDraft ? win.GuideChatDraft(prompt) : { accepted: false, reason: '聊天尚未准备好，请稍后重试。' };
                status(result.accepted ? '已放入聊天草稿，确认或编辑后再发送。当前观察尚需点击保存才会写入手册。' : result.reason, !result.accepted);
            } catch (error) { status(error.message, true); }
        });
        byId('exploreExportJournal').addEventListener('click', function () { download(core.exportMarkdown(pack, journal), pack.id + '-journey.md', 'text/markdown;charset=utf-8'); });
        byId('exploreExportPack').addEventListener('click', function () { download(JSON.stringify(pack, null, 2), pack.id + '.json', 'application/json'); });
        byId('exploreImportFile').addEventListener('change', async function () {
            var generation = ++importGeneration; pendingPack = null; byId('exploreImportPreview').hidden = true;
            var file = this.files && this.files[0]; if (!file) return;
            try {
                if (file.size > 131072) throw new Error('内容包不能超过 128 KiB，请精简内容后重试。');
                var candidate = core.validatePack(JSON.parse(await file.text()));
                if (generation !== importGeneration) return;
                pendingPack = candidate;
                byId('exploreImportDescription').textContent = candidate.title + '（' + candidate.tasks.length + ' 站）\n作者：' + candidate.author + '\n版本：' + candidate.version + '\n素材说明：' + candidate.licenseNotice;
                byId('exploreImportPreview').hidden = false; status('已校验，尚未更换。请确认内容预览。');
            } catch (error) { if (generation === importGeneration) status('导入失败：' + (error instanceof SyntaxError ? 'JSON 格式有误。' : error.message), true); }
        });
        byId('exploreCancelImport').addEventListener('click', function () { importGeneration++; pendingPack = null; byId('exploreImportPreview').hidden = true; byId('exploreImportFile').value = ''; status('已取消导入，当前旅程保留。'); });
        byId('exploreUsePack').addEventListener('click', function () {
            if (!pendingPack) return;
            draftByTask[selectedId] = input.value;
            var unsaved = pack.tasks.some(function (item) {
                return Object.prototype.hasOwnProperty.call(draftByTask, item.id) && draftByTask[item.id].trim() && draftByTask[item.id].trim() !== (entryFor(item.id) ? entryFor(item.id).text : '');
            });
            if (unsaved) {
                status('有站点保留了未保存的讲解。请先保存，或清空后再更换内容包。', true); return;
            }
            activate(pendingPack); pendingPack = null; importGeneration++; keepCurrent();
            byId('exploreImportPreview').hidden = true; byId('exploreImportFile').value = ''; status('已换用新内容包。重新导入原包可恢复记录。');
        });
    }
    return { createStore: createStore, mount: mount };
});
