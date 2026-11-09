const test = require('node:test');
const assert = require('node:assert/strict');
const companion = require('../../src/main/resources/static/js/campus-companion.js');
const catalog = require('../../src/main/resources/campus/catalog.json');

function fixture(options = {}) {
    let time = 0;
    const state = companion.create({now: () => time, places: catalog.places, ...options});
    state.setEnabled(true);
    function sample(at, patch = {}) {
        time = at;
        state.update({visible: true, busy: false, contextRevision: 1, campusId: 'pingleyuan',
            hour: 12, simulated: false, quiet: false,
            position: {source: 'confirmed', timestamp: at, placeId: 'pingleyuan-north-dining'}, ...patch});
    }
    return {state, sample, advance: at => {time = at;}};
}

test('confirmed dining invitation requires two fresh observations and thirty seconds dwell', () => {
    const f = fixture();
    f.sample(0);
    assert.equal(f.state.offer(), null);
    f.advance(30000);
    assert.equal(f.state.offer(), null, 'elapsed time cannot turn one sample into evidence');
    f.sample(30000);
    const offer = f.state.offer();
    assert.equal(offer.placeId, 'pingleyuan-north-dining');
    assert.match(offer.message, /饭点/);
    assert.equal(offer.expiresAt, 90000);
    assert.deepEqual(f.state.accept(offer.id), offer);
    assert.equal(f.state.accept(offer.id), null);
});

test('busy defers one bubble and acceptance, then revalidates without replacing it', () => {
    const f = fixture();
    f.sample(0);
    f.sample(30000);
    const offered = f.state.offer();
    f.sample(31000, {busy: true});
    assert.equal(f.state.offer(), null);
    assert.equal(f.state.accept(offered.id), null);
    f.sample(32000);
    assert.deepEqual(f.state.offer(), offered);
    assert.deepEqual(f.state.accept(offered.id), offered);
});

test('context revisions invalidate offers and delayed old updates cannot restore them', () => {
    const f = fixture();
    f.sample(0);
    f.sample(30000);
    const old = f.state.offer();
    f.sample(31000, {contextRevision: 2});
    f.sample(32000, {contextRevision: 1});
    assert.equal(f.state.accept(old.id), null);
    assert.equal(f.state.offer(), null);
});

test('expired or stale location bubbles cannot be accepted', () => {
    for (const time of [60001, 90000]) {
        const f = fixture();
        f.sample(0);
        f.sample(30000);
        const offered = f.state.offer();
        f.advance(time);
        assert.equal(f.state.accept(offered.id), null);
    }
});

test('same meal deduplicates shown invitations and other places wait ten minutes', () => {
    const f = fixture();
    f.sample(0);
    f.sample(30000);
    f.state.offer();
    f.state.dismiss();
    f.sample(60000);
    assert.equal(f.state.offer(), null);
    const library = {source: 'confirmed', timestamp: 61000, placeId: 'pingleyuan-library'};
    f.sample(61000, {position: library});
    f.sample(91000, {position: {...library, timestamp: 91000}});
    assert.equal(f.state.offer(), null);
    for (let time = 121000; time <= 631000; time += 30000) {
        f.sample(time, {position: {...library, timestamp: time}});
    }
    assert.match(f.state.offer().message, /图书馆/);
});

test('background return requires two new foreground samples', () => {
    const f = fixture();
    f.sample(0);
    f.sample(30000);
    const old = f.state.offer();
    f.sample(31000, {visible: false});
    f.sample(32000);
    assert.equal(f.state.offer(), null);
    assert.equal(f.state.accept(old.id), null);
    f.sample(62000);
    assert.equal(f.state.offer(), null, 'same meal stays deduplicated after foreground return');
    f.state.reset();
    f.sample(63000);
    assert.equal(f.state.offer(), null);
    f.sample(93000);
    assert.ok(f.state.offer());
});

test('a browsed destination and unsupported location source cannot claim physical arrival', () => {
    for (const position of [null, {source: 'destination', placeId: 'pingleyuan-library'},
        {source: 'geolocation', placeId: 'pingleyuan-library', latitude: 39.9, longitude: 116.4, accuracy: 10}]) {
        const f = fixture();
        f.sample(0, {placeId: 'pingleyuan-library', position: position && {...position, timestamp: 0}});
        f.sample(30000, {placeId: 'pingleyuan-library', position: position && {...position, timestamp: 30000}});
        assert.equal(f.state.offer(), null);
    }
});

test('confirmed quiet library shows text-only invitation with no player integration', () => {
    const f = fixture();
    const position = {source: 'confirmed', placeId: 'pingleyuan-library'};
    f.sample(0, {position: {...position, timestamp: 0}, quiet: true});
    f.sample(30000, {position: {...position, timestamp: 30000}, quiet: true});
    const offered = f.state.offer();
    assert.match(offered.message, /图书馆/);
    assert.equal(Object.hasOwn(offered, 'speech'), false);
    assert.deepEqual(f.state.accept(offered.id), offered);
});

test('disabling or resetting invalidates prior handles and restarts dwell', () => {
    const f = fixture();
    f.sample(0);
    f.sample(30000);
    const old = f.state.offer();
    f.state.setEnabled(false);
    assert.equal(f.state.offer(), null);
    f.state.setEnabled(true);
    assert.equal(f.state.accept(old.id), null);
    assert.equal(f.state.offer(), null);
    f.state.reset();
    f.sample(31000);
    f.sample(61000);
    assert.notEqual(f.state.offer().id, old.id);
});

test('verified geolocation uses accuracy circles and the 100/150 metre hysteresis', () => {
    const regions = [{placeId: 'pingleyuan-north-dining', campusId: 'pingleyuan', category: 'dining',
        latitude: 40, longitude: 116}];
    const f = fixture({regions});
    const position = {source: 'geolocation', latitude: 40.00045, longitude: 116, accuracy: 10};
    f.sample(0, {position: {...position, timestamp: 0}});
    f.sample(30000, {position: {...position, timestamp: 30000}});
    const offered = f.state.offer();
    assert.ok(offered);
    f.sample(31000, {position: {...position, latitude: 40.00099, timestamp: 31000}});
    assert.deepEqual(f.state.offer(), offered, 'a known entry persists inside the exit circle');
    f.sample(32000, {position: {...position, latitude: 40.0013, timestamp: 32000}});
    assert.equal(f.state.offer(), null, 'accuracy circle straddling exit is unknown');
    assert.equal(f.state.accept(offered.id), null);
});

test('unverified, inaccurate, ambiguous and foreign coordinate samples never identify buildings', () => {
    const region = {placeId: 'pingleyuan-north-dining', campusId: 'pingleyuan', category: 'dining',
        latitude: 40, longitude: 116};
    const base = {source: 'geolocation', latitude: 40, longitude: 116, accuracy: 10};
    for (const scenario of [
        {regions: [], position: base},
        {regions: [region], position: {...base, accuracy: 41}},
        {regions: [region], position: {...base, accuracy: -1}},
        {regions: [region], position: {...base, latitude: NaN}},
        {regions: [region], position: {...base, coordinateSystem: 'GCJ-02'}},
        {regions: [region], position: {...base, latitude: 40.0009}},
        {regions: [region, {...region, placeId: 'pingleyuan-tiantian-dining'}], position: base}
    ]) {
        const f = fixture({regions: scenario.regions});
        f.sample(0, {position: {...scenario.position, timestamp: 0}});
        f.sample(30000, {position: {...scenario.position, timestamp: 30000}});
        assert.equal(f.state.offer(), null);
    }
});

test('invalid, repeated, future and widely separated samples cannot establish dwell', () => {
    for (const scenario of [
        {first: 0, second: 0, now: 30000},
        {first: 0, second: 31000, now: 31000},
        {first: 0, second: 30001, now: 0},
        {first: 0, second: NaN, now: 30000}
    ]) {
        const f = fixture();
        f.sample(scenario.first);
        f.sample(scenario.now, {position: {source: 'confirmed',
            placeId: 'pingleyuan-north-dining', timestamp: scenario.second}});
        assert.equal(f.state.offer(), null);
    }
});

test('campus changes and mismatching place campuses reset physical evidence', () => {
    const f = fixture();
    f.sample(0);
    f.sample(30000, {campusId: 'tongzhou'});
    assert.equal(f.state.offer(), null);
    f.sample(31000);
    assert.equal(f.state.offer(), null);
});

test('simulated samples require visible simulation context and offers are detached', () => {
    const f = fixture();
    const position = {source: 'simulated', placeId: 'pingleyuan-north-dining', timestamp: 0};
    f.sample(0, {position});
    f.sample(30000, {position: {...position, timestamp: 30000}});
    assert.equal(f.state.offer(), null);
    f.sample(31000, {position: {...position, timestamp: 31000}, simulated: true});
    f.sample(61000, {position: {...position, timestamp: 61000}, simulated: true});
    const offered = f.state.offer();
    offered.placeId = 'spoofed';
    assert.equal(f.state.offer().placeId, 'pingleyuan-north-dining');
});

test('meal boundary and opt-in rules suppress dining at other times', () => {
    for (const hour of [10.99, 13, 16.99, 19, undefined, '12']) {
        const f = fixture();
        f.sample(0, {hour});
        f.sample(30000, {hour});
        assert.equal(f.state.offer(), null);
    }
    const f = fixture();
    f.state.setEnabled(false);
    f.sample(0);
    f.sample(30000);
    assert.equal(f.state.offer(), null);
});

test('two samples twenty seconds apart qualify only after thirty seconds total dwell', () => {
    const f = fixture();
    f.sample(0);
    f.sample(20000);
    assert.equal(f.state.offer(), null);
    f.advance(30000);
    assert.ok(f.state.offer());
    const tooClose = fixture();
    tooClose.sample(0);
    tooClose.sample(19000);
    tooClose.advance(30000);
    assert.equal(tooClose.state.offer(), null);
});

test('sixty second expiry is enforced even with continuous fresh observations', () => {
    const f = fixture();
    f.sample(0);
    f.sample(30000);
    const offered = f.state.offer();
    f.sample(60000);
    f.sample(90000);
    assert.equal(f.state.accept(offered.id), null);
    assert.equal(f.state.offer(), null);
});

test('browser UMD export creates the same pure API without DOM or player globals', () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(require.resolve('../../src/main/resources/static/js/campus-companion.js'), 'utf8'), context);
    const state = context.CampusCompanion.create();
    assert.equal(state.offer(), null);
    assert.deepEqual(Object.keys(state).sort(), ['accept', 'dismiss', 'offer', 'reset', 'setEnabled', 'update']);
});
