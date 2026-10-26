// REQ-032: front-end rule tests for GuideExploration (no DOM, no network, no storage).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../../src/main/resources/static/js/exploration-core');

const SOURCE_FILE = path.join(__dirname, '../../src/main/resources/static/js/exploration-core.js');

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

// Synthetic package only: tests must not depend on content packs that the page task adds.
function basePack() {
    return {
        schemaVersion: 1,
        id: 'ling-shan-demo',
        version: '1.0.0',
        title: '灵山观察演示包',
        author: '课程组',
        licenseNotice: '仅用于课堂演示，未经额外授权。',
        tasks: [
            {
                id: 'lss-1',
                spotName: '灵山大佛',
                title: '观察大佛的空间尺度',
                prompt: '你第一眼注意到的尺度是什么？',
                hint: '留意人流、视线高度和拍照位置。',
                reference: '灵山大佛位于无锡灵山胜境，通高八十八米。',
                source: { title: '项目继承资料：灵山景点说明', url: 'https://example.com/docs/ling-shan', status: 'inherited-unverified' },
                cues: [
                    { label: '铜像', terms: ['铜', 'Bronze'] },
                    { label: '尺度', terms: ['八十八米', '高度'] }
                ]
            },
            {
                id: 'jlg-2',
                spotName: '九龙灌浴',
                title: '记录表演与人群',
                prompt: '表演前后人群有什么变化？',
                hint: '注意声音、水雾和围观距离。',
                reference: '九龙灌浴是灵山胜境的动态表演项目。',
                source: { title: '项目原创演示资料', url: 'https://example.com/docs/jiulong', status: 'original-demo' },
                cues: [{ label: '水雾', terms: ['水雾', '雾'] }]
            }
        ]
    };
}

function validPack() {
    return core.validatePack(basePack());
}

function badPack(mutate) {
    const pack = basePack();
    mutate(pack);
    return pack;
}

function assertPackError(mutate, pattern) {
    assert.throws(function () {
        core.validatePack(badPack(mutate));
    }, function (error) {
        return error instanceof Error && /内容包格式错误/.test(error.message) && (!pattern || pattern.test(error.message));
    });
}

function maximalPack() {
    const pack = basePack();
    pack.id = 'max-pack';
    pack.version = '9.9.9';
    pack.title = '标'.repeat(80);
    pack.author = '作'.repeat(100);
    pack.licenseNotice = '许'.repeat(600);
    const url = 'https://example.com/' + 'a'.repeat(980);
    pack.tasks = [];
    for (let i = 0; i < 12; i++) {
        pack.tasks.push({
            id: 'spot-' + i,
            spotName: '站'.repeat(80),
            title: '题'.repeat(100),
            prompt: '问'.repeat(600),
            hint: '示'.repeat(600),
            reference: '资'.repeat(1600),
            source: { title: '源'.repeat(150), url: url, status: i % 2 ? 'original-demo' : 'inherited-unverified' },
            cues: Array.from({ length: 6 }, function () {
                return { label: '标'.repeat(80), terms: Array.from({ length: 10 }, function () { return '词'.repeat(40); }) };
            })
        });
    }
    return pack;
}

function recordedJournal() {
    const pack = validPack();
    let journal = core.createJournal(pack);
    journal = core.record(pack, journal, 'lss-1', { text: '我注意到大佛很高，铜像在阳光下很亮。', mode: 'demo' }, '2026-10-26T08:00:00+08:00');
    journal = core.record(pack, journal, 'jlg-2', { text: '表演开始时水雾很大，人群明显安静下来。', mode: 'onsite' }, '2026-10-26T08:10:00+08:00');
    return { pack: pack, journal: journal };
}

test('UMD exposes the same API through module.exports and window.GuideExploration', function () {
    assert.deepEqual(Object.keys(core).sort(), ['buildPrompt', 'compare', 'createJournal', 'exportMarkdown', 'record', 'restore', 'validatePack']);
    for (const name of Object.keys(core)) assert.equal(typeof core[name], 'function', name);
    const source = fs.readFileSync(SOURCE_FILE, 'utf8');
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(source, context);
    const api = context.window.GuideExploration;
    assert.equal(typeof api.validatePack, 'function');
    assert.equal(typeof api.exportMarkdown, 'function');
});

test('valid pack is normalized and deeply detached from the input', function () {
    const input = basePack();
    input.unexpected = 'dropped';
    input.tasks[0].unexpected = 'dropped';
    input.tasks[0].source.unexpected = 'dropped';
    input.title = '  灵山观察演示包  ';
    const pack = core.validatePack(input);
    assert.equal(pack.title, '灵山观察演示包');
    assert.equal(pack.schemaVersion, 1);
    assert.equal(pack.tasks.length, 2);
    assert.deepEqual(Object.keys(pack).sort(), ['author', 'id', 'licenseNotice', 'schemaVersion', 'tasks', 'title', 'version']);
    assert.deepEqual(Object.keys(pack.tasks[0]).sort(), ['cues', 'hint', 'id', 'prompt', 'reference', 'source', 'spotName', 'title']);
    assert.deepEqual(Object.keys(pack.tasks[0].source).sort(), ['status', 'title', 'url']);
    assert.equal(Object.prototype.hasOwnProperty.call(pack, 'unexpected'), false);
    assert.equal(pack.tasks[0].source.status, 'inherited-unverified');
    input.title = '被修改';
    input.tasks[0].cues[0].terms.push('注入');
    input.tasks[0].source.url = 'http://changed.example';
    assert.equal(pack.title, '灵山观察演示包');
    assert.deepEqual(pack.tasks[0].cues[0].terms, ['铜', 'Bronze']);
    assert.equal(pack.tasks[0].source.url, 'https://example.com/docs/ling-shan');
    assert.notEqual(core.validatePack(pack), pack);
});

test('maximal declared-size pack is accepted and stays under the JSON character limit', function () {
    const pack = core.validatePack(maximalPack());
    assert.equal(pack.tasks.length, 12);
    assert.ok(JSON.stringify(pack).length <= 131072);
});

test('invalid schemaVersion, ids and duplicates are rejected with Chinese errors', function () {
    assertPackError(function (p) { p.schemaVersion = 2; }, /schemaVersion/);
    assertPackError(function (p) { p.schemaVersion = '1'; }, /schemaVersion/);
    assertPackError(function (p) { delete p.schemaVersion; }, /schemaVersion/);
    for (const id of ['', 'a b', '_starts-underscore', 'x'.repeat(65), '中文', 7, null]) {
        assertPackError(function (p) { p.id = id; }, /id/);
    }
    assertPackError(function (p) { delete p.id; }, /id/);
    assertPackError(function (p) { p.version = 'bad version'; }, /版本/);
    assertPackError(function (p) { p.tasks[1].id = 'lss-1'; }, /重复/);
    for (const id of ['__proto__', '-leading', 'a/b', 'a b']) {
        assertPackError(function (p) { p.tasks[0].id = id; }, /id/);
    }
    assertPackError(function (p) { p.tasks[0].id = 42; }, /id/);
});

test('id-shaped keys such as constructor are valid ids but never pollute prototypes', function () {
    const pack = core.validatePack(badPack(function (p) { p.tasks[0].id = 'constructor'; }));
    const journal = core.record(pack, core.createJournal(pack), 'constructor',
        { text: '构造器形状的 id 不应污染原型。', mode: 'demo' }, '2026-10-26T08:00:00Z');
    assert.deepEqual(Object.keys(journal.entries), ['constructor']);
    assert.equal(Object.getPrototypeOf(journal.entries), Object.prototype);
    assert.equal(({}).polluted, undefined);
    assert.deepEqual(core.restore(pack, clone(journal)), journal);
});

test('unsafe source URLs, credentials and status values are rejected', function () {
    for (const url of ['http://example.com/a', 'ftp://example.com/a', 'javascript:alert(1)', 'not a url',
        'https://user:pass@example.com/a', 'https://user@example.com/a', 'https://exa mple.com/a',
        'https://example.com/' + 'a'.repeat(990), '', 123]) {
        assertPackError(function (p) { p.tasks[0].source.url = url; }, /来源链接/);
    }
    assertPackError(function (p) { delete p.tasks[0].source.url; }, /来源链接/);
    assertPackError(function (p) { p.tasks[0].source.status = 'official'; }, /来源状态/);
    assertPackError(function (p) { delete p.tasks[0].source.status; }, /来源状态/);
    assertPackError(function (p) { p.tasks[0].source.title = ''; }, /来源标题/);
    assertPackError(function (p) { p.tasks[0].source.title = '题'.repeat(151); }, /来源标题/);
    assertPackError(function (p) { p.tasks[0].source = null; }, /source/);
    assertPackError(function (p) { delete p.tasks[0].source; }, /source/);
});

test('wrong types, empty values and over-limit fields are rejected', function () {
    const cases = [
        [function (p) { p.title = 123; }, /标题/],
        [function (p) { p.title = ''; }, /标题/],
        [function (p) { p.title = '   '; }, /标题/],
        [function (p) { p.title = '题'.repeat(81); }, /标题/],
        [function (p) { p.author = true; }, /作者/],
        [function (p) { p.author = '作'.repeat(101); }, /作者/],
        [function (p) { p.licenseNotice = []; }, /许可说明/],
        [function (p) { p.licenseNotice = '许'.repeat(601); }, /许可说明/],
        [function (p) { p.tasks = []; }, /tasks/],
        [function (p) { p.tasks = {}; }, /tasks/],
        [function (p) { p.tasks = new Array(13).fill(clone(basePack().tasks[0])); }, /tasks/],
        [function (p) { p.tasks[0] = 'not-an-object'; }, /站点/],
        [function (p) { p.tasks[0].spotName = ''; }, /站点名称/],
        [function (p) { p.tasks[0].spotName = '站'.repeat(81); }, /站点名称/],
        [function (p) { p.tasks[0].title = ''; }, /任务标题/],
        [function (p) { p.tasks[0].title = '题'.repeat(101); }, /任务标题/],
        [function (p) { p.tasks[0].prompt = '问'.repeat(601); }, /站点问题/],
        [function (p) { p.tasks[0].hint = '示'.repeat(601); }, /站点提示/],
        [function (p) { p.tasks[0].reference = '资'.repeat(1601); }, /站点资料/],
        [function (p) { p.tasks[0].cues = []; }, /cues/],
        [function (p) { p.tasks[0].cues = new Array(7).fill({ label: '词', terms: ['x'] }); }, /cues/],
        [function (p) { p.tasks[0].cues[0] = null; }, /关键词/],
        [function (p) { p.tasks[0].cues[0].label = ''; }, /关键词标签/],
        [function (p) { p.tasks[0].cues[0].label = '标'.repeat(81); }, /关键词标签/],
        [function (p) { p.tasks[0].cues[0].terms = []; }, /terms/],
        [function (p) { p.tasks[0].cues[0].terms = new Array(11).fill('x'); }, /terms/],
        [function (p) { p.tasks[0].cues[0].terms = ['']; }, /关键词项/],
        [function (p) { p.tasks[0].cues[0].terms = ['   ']; }, /关键词项/],
        [function (p) { p.tasks[0].cues[0].terms = ['词'.repeat(41)]; }, /关键词项/],
        [function (p) { p.tasks[0].cues[0].terms = [5]; }, /关键词项/]
    ];
    for (const [mutate, pattern] of cases) assertPackError(mutate, pattern);
});

test('createJournal returns a clean journal bound to pack id and version', function () {
    const pack = validPack();
    const journal = core.createJournal(basePack());
    assert.deepEqual(journal, { schemaVersion: 1, packId: 'ling-shan-demo', packVersion: '1.0.0', entries: {} });
    assert.notEqual(core.createJournal(pack), journal);
    assert.throws(function () { core.createJournal(badPack(function (p) { p.schemaVersion = 3; })); }, /内容包格式错误/);
});

test('record replaces one task entry, validates text/mode/time and never mutates inputs', function () {
    const pack = validPack();
    const empty = core.createJournal(pack);
    const change = { text: '  我注意到大佛很高大，铜像很亮。  ', mode: 'demo', extra: 'ignored' };
    const first = core.record(pack, empty, 'lss-1', change, '2026-10-26T08:00:00+08:00');
    assert.deepEqual(empty, { schemaVersion: 1, packId: 'ling-shan-demo', packVersion: '1.0.0', entries: {} });
    assert.equal(first.entries['lss-1'].text, '我注意到大佛很高大，铜像很亮。');
    assert.equal(first.entries['lss-1'].mode, 'demo');
    assert.equal(first.entries['lss-1'].recordedAt, '2026-10-26T08:00:00+08:00');
    assert.notEqual(first, empty);
    assert.notEqual(first.entries, empty.entries);
    assert.notEqual(first.entries['lss-1'], change);

    const second = core.record(pack, first, 'lss-1', { text: '第二次观察：排队的人群更集中。', mode: 'onsite' }, '2026-10-26T08:20:00Z');
    assert.equal(Object.keys(second.entries).length, 1);
    assert.equal(second.entries['lss-1'].mode, 'onsite');
    assert.equal(second.entries['lss-1'].recordedAt, '2026-10-26T08:20:00Z');
    assert.equal(first.entries['lss-1'].mode, 'demo');

    const third = core.record(pack, second, 'jlg-2', { text: '表演开始后水雾笼罩了前排。', mode: 'onsite' }, '2026-10-26T08:30:00+08:00');
    assert.deepEqual(Object.keys(third.entries).sort(), ['jlg-2', 'lss-1']);
    assert.equal(second.entries['jlg-2'], undefined);
    assert.deepEqual(Object.keys(change), ['text', 'mode', 'extra']);
});

test('record rejects unknown tasks and abnormal observations', function () {
    const pack = validPack();
    const journal = core.createJournal(pack);
    const now = '2026-10-26T08:00:00+08:00';
    assert.throws(function () { core.record(pack, journal, 'ghost', { text: '有效观察内容', mode: 'demo' }, now); }, /未知任务/);
    assert.throws(function () { core.record(pack, journal, '__proto__', { text: '有效观察内容', mode: 'demo' }, now); }, /未知任务/);
    for (const text of ['abc', '观'.repeat(1201), 12, null, '', '   ']) {
        assert.throws(function () { core.record(pack, journal, 'lss-1', { text: text, mode: 'demo' }, now); }, /内容包格式错误|记录格式错误/);
    }
    assert.throws(function () { core.record(pack, journal, 'lss-1', { text: '有效观察内容', mode: 'other' }, now); }, /记录方式/);
    assert.throws(function () { core.record(pack, journal, 'lss-1', { text: '有效观察内容' }, now); }, /记录方式/);
    assert.throws(function () { core.record(pack, journal, 'lss-1', 'not-an-object', now); }, /记录内容/);
    for (const badTime of ['2026-10-26 08:00:00', '2026-10-26T08:00:00', '2026-10-26T08:00:00.123456Z', 'yesterday', '', undefined,
        '2026-02-30T08:00:00Z', '2025-02-29T08:00:00Z', '2026-04-31T08:00:00Z', '2026-13-01T08:00:00Z',
        '2026-10-26T24:00:00Z', '2026-10-26T08:60:00Z', '2026-10-26T08:00:60Z', '2026-10-26T08:00:00+25:00']) {
        assert.throws(function () { core.record(pack, journal, 'lss-1', { text: '有效观察内容', mode: 'demo' }, badTime); }, /记录时间/);
    }
    for (const goodTime of ['2026-10-26T08:00:00Z', '2026-10-26T08:00:00.123+08:00', '2026-10-26T00:00:00-05:00',
        '2024-02-29T08:00:00Z', '2026-10-26T08:00:00+08:00', '2026-10-26T23:59:59Z']) {
        assert.equal(core.record(pack, journal, 'lss-1', { text: '有效观察内容', mode: 'demo' }, goodTime).entries['lss-1'].recordedAt, goodTime);
    }
    // A journal from another package/version cannot be written to.
    const other = core.validatePack(badPack(function (p) { p.id = 'other-pack'; }));
    assert.throws(function () { core.record(other, journal, 'lss-1', { text: '有效观察内容', mode: 'demo' }, now); }, /不匹配/);
    const otherVersion = core.validatePack(badPack(function (p) { p.version = '2.0.0'; }));
    assert.throws(function () { core.record(otherVersion, journal, 'lss-1', { text: '有效观察内容', mode: 'demo' }, now); }, /不匹配/);
});

test('restore isolates packages/versions, ignores corrupted entries and hostile keys', function () {
    const { pack, journal } = recordedJournal();
    assert.deepEqual(core.restore(pack, clone(journal)), journal);
    assert.deepEqual(core.restore(pack, null), { schemaVersion: 1, packId: 'ling-shan-demo', packVersion: '1.0.0', entries: {} });
    assert.deepEqual(core.restore(pack, {}), { schemaVersion: 1, packId: 'ling-shan-demo', packVersion: '1.0.0', entries: {} });
    assert.deepEqual(core.restore(pack, { schemaVersion: 2, packId: pack.id, packVersion: pack.version, entries: journal.entries }),
        { schemaVersion: 1, packId: 'ling-shan-demo', packVersion: '1.0.0', entries: {} });

    const other = core.validatePack(badPack(function (p) { p.id = 'other-pack'; }));
    assert.deepEqual(core.restore(other, journal), { schemaVersion: 1, packId: 'other-pack', packVersion: '1.0.0', entries: {} });
    const otherVersion = core.validatePack(badPack(function (p) { p.version = '2.0.0'; }));
    assert.deepEqual(core.restore(otherVersion, journal), { schemaVersion: 1, packId: 'ling-shan-demo', packVersion: '2.0.0', entries: {} });

    const corrupt = {
        schemaVersion: 1, packId: pack.id, packVersion: pack.version,
        entries: {
            'lss-1': { text: '  有效观察内容  ', mode: 'demo', recordedAt: '2026-10-26T08:00:00Z' },
            'jlg-2': { text: '短', mode: 'demo', recordedAt: '2026-10-26T08:00:00Z' },
            ghost: { text: '未知任务的记录', mode: 'demo', recordedAt: '2026-10-26T08:00:00Z' },
            bad: { text: '有效观察内容', mode: 'other', recordedAt: '2026-10-26T08:00:00Z' },
            badTime: { text: '有效观察内容', mode: 'demo', recordedAt: '2026-10-26 08:00' },
            badCalendar: { text: '有效观察内容', mode: 'demo', recordedAt: '2026-02-30T08:00:00Z' },
            badOffset: { text: '有效观察内容', mode: 'demo', recordedAt: '2026-10-26T08:00:00+25:00' }
        }
    };
    const restored = core.restore(pack, corrupt);
    assert.deepEqual(Object.keys(restored.entries), ['lss-1']);
    assert.equal(restored.entries['lss-1'].text, '有效观察内容');

    const hostile = JSON.parse('{"schemaVersion":1,"packId":"ling-shan-demo","packVersion":"1.0.0","entries":{' +
        '"__proto__":{"polluted":true},"constructor":{"p":1},"lss-1":{"text":"有效观察内容","mode":"demo","recordedAt":"2026-10-26T08:00:00Z"}}}');
    const safe = core.restore(pack, hostile);
    assert.deepEqual(Object.keys(safe.entries), ['lss-1']);
    assert.equal(({}).polluted, undefined);
    assert.equal(Object.getPrototypeOf(safe.entries), Object.prototype);
});

test('compare reports mentions and unmentioned cues without scoring correctness', function () {
    const pack = validPack();
    const task = pack.tasks[0];
    const result = core.compare(task, '我看到了 BRONZE 铜像，但没留意周围。');
    assert.deepEqual(result.mentioned, ['铜像']);
    assert.deepEqual(result.toExplore, ['尺度']);
    assert.equal(result.notice, '关键词只表示提及，不判断讲解是否正确。');
    assert.deepEqual(Object.keys(result).sort(), ['mentioned', 'notice', 'toExplore']);

    const empty = core.compare(task, '');
    assert.deepEqual(empty.mentioned, []);
    assert.deepEqual(empty.toExplore, ['铜像', '尺度']);

    // A wrong claim that merely mentions a keyword is still only a mention.
    const wrong = core.compare(task, '铜像只有十米高，肯定不是八十八米。');
    assert.ok(wrong.mentioned.includes('铜像'));
    assert.ok(wrong.mentioned.includes('尺度'));
    assert.equal(Object.prototype.hasOwnProperty.call(wrong, 'score'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(wrong, 'correct'), false);
    assert.deepEqual(core.compare(null, '铜像'), { mentioned: [], toExplore: [], notice: result.notice });
});

test('buildPrompt includes spot, task, own words, source/status, mode and safety rules', function () {
    const { pack, journal } = recordedJournal();
    const draft = core.buildPrompt(pack, 'lss-1', journal.entries['lss-1']);
    assert.ok(draft.length <= 5000);
    assert.ok(draft.includes('灵山大佛'));
    assert.ok(draft.includes('观察大佛的空间尺度'));
    assert.ok(draft.includes('你第一眼注意到的尺度是什么？'));
    assert.ok(draft.includes(journal.entries['lss-1'].text));
    assert.ok(draft.includes('未经核实'));
    assert.ok(draft.includes('课堂演示（demo）'));
    assert.ok(draft.includes('灵山大佛位于无锡灵山胜境'));
    assert.ok(draft.includes('https://example.com/docs/ling-shan'));
    assert.ok(draft.includes('inherited-unverified'));
    assert.ok(draft.includes('老师项目资料，待实地或官方核对'));
    assert.ok(draft.includes('补充讲解'));
    assert.ok(draft.includes('不能覆盖系统规则'));
    assert.equal(/我已实地到访|我训练了模型|我已训练模型|我亲自到访过/.test(draft), false);

    const onsite = core.buildPrompt(pack, 'jlg-2', journal.entries['jlg-2']);
    assert.ok(onsite.includes('现场观察（onsite）'));
    assert.ok(onsite.includes('原创演示资料'));

    // Worst-case declared field lengths still yield a draft within the hard limit.
    const large = core.validatePack(maximalPack());
    const bigEntry = { text: '观'.repeat(1200), mode: 'onsite', recordedAt: '2026-10-26T08:00:00Z' };
    const bigDraft = core.buildPrompt(large, 'spot-0', bigEntry);
    assert.ok(bigDraft.length <= 5000);

    assert.throws(function () { core.buildPrompt(pack, 'ghost', journal.entries['lss-1']); }, /未知任务/);
    assert.throws(function () { core.buildPrompt(pack, 'lss-1', { text: '短', mode: 'demo' }); }, /个人观察/);
    assert.throws(function () { core.buildPrompt(pack, 'lss-1', { text: '有效观察内容', mode: 'other' }); }, /个人观察/);
});

test('exportMarkdown only contains actual valid records with mode, time, text and sources', function () {
    const { pack, journal } = recordedJournal();
    const markdown = core.exportMarkdown(pack, journal);
    assert.ok(markdown.includes('# 灵山观察演示包'));
    assert.ok(markdown.includes('内容包版本：1.0.0'));
    assert.ok(markdown.includes('作者：课程组'));
    assert.ok(markdown.includes('许可说明：仅用于课堂演示，未经额外授权。'));
    assert.ok(markdown.indexOf('灵山大佛') < markdown.indexOf('九龙灌浴'));
    assert.ok(markdown.includes('课堂演示（demo）'));
    assert.ok(markdown.includes('现场观察（onsite）'));
    assert.ok(markdown.includes('2026-10-26T08:00:00+08:00'));
    assert.ok(markdown.includes('2026-10-26T08:10:00+08:00'));
    assert.ok(markdown.includes(journal.entries['lss-1'].text));
    assert.ok(markdown.includes(journal.entries['jlg-2'].text));
    assert.ok(markdown.includes('通高八十八米'));
    assert.ok(markdown.includes('https://example.com/docs/ling-shan'));
    assert.ok(markdown.includes('inherited-unverified'));
    assert.equal(/已实地到访|GPS|评分|五星/.test(markdown), false);

    const empty = core.exportMarkdown(pack, core.createJournal(pack));
    assert.ok(empty.includes('# 灵山观察演示包'));
    assert.ok(empty.includes('还没有实际记录'));
    assert.equal(empty.includes('灵山大佛'), false);

    const foreign = core.validatePack(badPack(function (p) { p.version = '2.0.0'; }));
    const foreignMarkdown = core.exportMarkdown(foreign, journal);
    assert.equal(foreignMarkdown.includes('灵山大佛'), false);
    assert.ok(foreignMarkdown.includes('还没有实际记录'));
});

test('exportMarkdown omits invalid entries and escapes user/package text against link and HTML injection', function () {
    const pack = core.validatePack(badPack(function (p) {
        p.author = '<b>作者</b>';
        p.licenseNotice = '[许可](https://evil.example/license)';
        p.tasks[0].reference = '详见 [官网](https://evil.example) <img src=x onerror=alert(1)>';
        p.tasks[0].source.title = '<script>source</script>';
        p.tasks[0].spotName = '大佛 <i>站</i>';
    }));
    let journal = core.createJournal(pack);
    const malicious = '[点我](javascript:alert(1)) <script>alert(\'x\')</script> ![img](x) 铜像';
    journal = core.record(pack, journal, 'lss-1', { text: malicious, mode: 'demo' }, '2026-10-26T08:00:00Z');
    const tampered = clone(journal);
    tampered.entries.ghost = { text: '不该导出的未知任务记录', mode: 'demo', recordedAt: '2026-10-26T08:00:00Z' };
    tampered.entries['jlg-2'] = { text: '短', mode: 'demo', recordedAt: '2026-10-26T08:00:00Z' };

    const markdown = core.exportMarkdown(pack, tampered);
    assert.equal(markdown.includes('不该导出的未知任务记录'), false);
    assert.equal(markdown.includes('短'), false);
    assert.equal(/<script/i.test(markdown), false);
    assert.equal(/<img/i.test(markdown), false);
    assert.equal(/<b>|<i>/.test(markdown), false);
    assert.equal(/\]\(javascript:/i.test(markdown), false);
    assert.equal(/\]\(https:\/\/evil/i.test(markdown), false);
    assert.ok(markdown.includes('&lt;script&gt;'));
    assert.ok(markdown.includes('\\[点我\\]'));
    assert.ok(markdown.includes('&lt;img src=x onerror=alert\\(1\\)&gt;'));
    assert.ok(markdown.includes('\\[许可\\]'));
    assert.ok(markdown.includes('铜像'));
});
