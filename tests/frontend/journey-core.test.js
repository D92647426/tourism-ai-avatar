const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../../src/main/resources/static/js/journey-core.js');
const stops=[{id:11,name:'灵山大佛'},{id:13,name:'灵山梵宫'}];

test('journey selects real stops and advances without implying visits or wrapping',()=>{
    const journey=core.create();assert.equal(journey.select(11),false);
    journey.replace(stops);assert.equal(journey.select(999),false);
    assert.equal(journey.select(11),true);assert.equal(journey.snapshot().next.id,13);
    assert.equal(journey.select(13),true);assert.equal(journey.snapshot().next,null);
    journey.clear();assert.equal(journey.snapshot().current,null);
});
test('invalid plans are atomic; replacements reset selection and snapshots are detached',()=>{
    const journey=core.create();journey.replace(stops);journey.select(11);
    const original=journey.snapshot();
    for(const invalid of [null,[{id:0,name:'x'}],[{id:1,name:''}],[{id:1,name:'a'},{id:1,name:'b'}],Array(5).fill(stops[0])]){
        assert.throws(()=>journey.replace(invalid),TypeError);assert.deepEqual(journey.snapshot(),original);
    }
    const snapshot=journey.snapshot();snapshot.stops[0].name='改写';snapshot.current.name='改写';
    assert.equal(journey.snapshot().current.name,'灵山大佛');
    journey.replace([]);assert.equal(journey.snapshot().current,null);assert.equal(journey.snapshot().stops.length,0);
});
