// REQ-061: use the actual campus entry, form, environment, requests and map adapter.
const test = require('node:test');
const assert = require('node:assert/strict');
const {page,turn,flush,response,deferred} = require('./campus-fixture.cjs');
const {leaflet} = require('./leaflet-fixture.cjs');

async function lab(options = {}) {
    const maps = leaflet(), p = page({Leaflet:maps.L,...options}); await flush();
    p.click('soundToggle'); p.tick(1800); p.click('openLocationLab'); await flush();
    return {p,maps};
}
function select(p, id, value) { p.nodes.get(id).value = value; p.nodes.get(id).fire('change'); }
async function apply(p) { p.nodes.get('locationLabForm').fire('submit'); await flush(); }

test('map lab opens independently from the central stage and keeps the campus catalog truthful', async () => {
    const {p,maps} = await lab();
    assert.equal(p.nodes.get('locationLab').open,true);
    assert.equal(p.nodes.get('scenePanel').hidden,true);
    assert.equal(maps.maps.length,1);
    assert.equal(p.nodes.get('labCampus').children.length,5);
    assert.match(p.nodes.get('labPlace').textContent,/逸夫图书馆（OSM参考点）/);
    assert.match(p.nodes.get('labPlace').textContent,/北区餐厅（坐标待补充）/);
    assert.equal(p.nodes.get('labAccuracy').value,'20'); assert.equal(p.nodes.get('labTime').value,'12:00');
    assert.equal(p.chats().length,0);
    assert.equal(p.catalog.places.find(p=>p.id==='pingleyuan-library').coordinates,null);
});

test('an applied reference place reaches the ordinary chat payload with simulated coordinates', async () => {
    const {p} = await lab(); select(p,'labPlace','pingleyuan-library');
    const latitude = Number(p.nodes.get('labLatitude').value), longitude = Number(p.nodes.get('labLongitude').value);
    await apply(p); assert.match(p.nodes.get('labActiveState').textContent,/虚拟定位进行中.*逸夫图书馆/);
    assert.equal(p.nodes.get('advanceVirtualTime').disabled,false);
    p.click('returnFromLocationLab'); p.send('带我去四教'); await flush();
    const request = p.chats()[0].body;
    assert.equal(request.campusId,'pingleyuan'); assert.equal(request.context.simulated,true);
    assert.deepEqual(JSON.parse(JSON.stringify(request.context.position)),{placeId:'pingleyuan-library',source:'simulated',latitude,longitude,accuracy:20,timestamp:Date.parse(request.context.time)});
});

test('blank-map selection drafts coordinates without claiming a building or changing the device', async () => {
    const {p,maps} = await lab(); select(p,'labPlace','pingleyuan-library');
    maps.maps[0].fire('click',{latlng:{lat:39.8741,lng:116.4762}});
    assert.equal(p.nodes.get('labPlace').value,''); assert.equal(p.nodes.get('labLatitude').value,'39.874100');
    assert.equal(p.geo.length,0); assert.equal(p.watches.length,0);
    await apply(p); assert.match(p.nodes.get('positionStatus').textContent,/模拟/);
    p.click('returnFromLocationLab'); p.send('附近有什么'); await flush();
    const position = p.chats()[0].body.context.position;
    assert.equal(position.source,'simulated'); assert.equal(position.latitude,39.8741); assert.equal(position.placeId,undefined);
});

test('manual coordinate edits remove the previously chosen building claim', async () => {
    const {p} = await lab(); select(p,'labPlace','pingleyuan-library');
    p.nodes.get('labLongitude').value='116.47'; p.nodes.get('labLongitude').fire('input');
    assert.equal(p.nodes.get('labPlace').value,''); await apply(p);
    p.click('returnFromLocationLab'); p.send('介绍校园'); await flush();
    assert.equal(p.chats()[0].body.context.position.placeId,undefined);
});

test('a coordinate-unknown dining place supports explicit tests and a thirty-second offer', async () => {
    const {p} = await lab(); select(p,'labPlace','pingleyuan-north-dining');
    assert.equal(p.nodes.get('labLatitude').value,''); assert.match(p.nodes.get('labStatus').textContent,/坐标待补充/);
    await apply(p); p.click('advanceVirtualTime');
    assert.match(p.nodes.get('labActiveState').textContent,/12:00:30/);
    assert.equal(p.nodes.get('proactiveOffer').hidden,true);
    p.click('returnFromLocationLab'); await flush();
    assert.equal(p.nodes.get('proactiveOffer').hidden,false);
    assert.match(p.nodes.get('offerMessage').textContent,/餐|吃/);
    p.click('acceptOffer'); await flush();
    assert.equal(p.chats()[0].body.origin,'proactive_accept');
    assert.equal(p.chats()[0].body.context.position.placeId,'pingleyuan-north-dining');
});

test('switching campus clears old drafts and sends the selected campus place', async () => {
    const {p} = await lab(); select(p,'labPlace','pingleyuan-library'); select(p,'labCampus','tongzhou'); await flush();
    assert.equal(p.nodes.get('labLatitude').value,''); assert.equal(p.nodes.get('labPlace').value,'');
    assert.doesNotMatch(p.nodes.get('labPlace').textContent,/逸夫图书馆/);
    select(p,'labPlace','tongzhou-jixue-library'); await apply(p);
    p.click('returnFromLocationLab'); p.send('图书馆有哪些区域'); await flush();
    const body = p.chats()[0].body;
    assert.equal(body.campusId,'tongzhou'); assert.equal(body.context.position.placeId,'tongzhou-jixue-library');
});

test('invalid drafts keep the previous virtual position and present a recoverable message', async () => {
    const {p} = await lab(); select(p,'labPlace','pingleyuan-library'); await apply(p);
    p.nodes.get('labLatitude').value='91'; p.nodes.get('labLatitude').fire('input'); await apply(p);
    assert.match(p.nodes.get('labStatus').textContent,/请检查/);
    assert.match(p.nodes.get('labActiveState').textContent,/逸夫图书馆/);
    assert.equal(p.nodes.get('applyVirtualPosition').disabled,false);
});

test('backgrounding pauses the lab, disables sampling and makes reapplication explicit', async () => {
    const {p} = await lab(); select(p,'labPlace','pingleyuan-library'); await apply(p);
    p.hide(); p.show(); await flush();
    assert.match(p.nodes.get('labActiveState').textContent,/已暂停.*重新应用/);
    assert.equal(p.nodes.get('advanceVirtualTime').disabled,true);
    p.click('advanceVirtualTime'); assert.match(p.nodes.get('labStatus').textContent,/重新应用/);
    await apply(p); assert.equal(p.nodes.get('advanceVirtualTime').disabled,false);
});

test('closing before resources load prevents hidden map initialization and preserves the coordinate draft', async () => {
    const pending = deferred(); const {p,maps} = await lab({mapFetch:()=>pending.promise});
    p.nodes.get('labLatitude').value='39.875';p.nodes.get('labLongitude').value='116.477';p.nodes.get('labLatitude').fire('input');
    p.click('closeLocationLab'); pending.resolve(response({type:'FeatureCollection',features:[],points:[]})); await flush();
    assert.equal(maps.maps.length,0);
    p.click('openLocationLab'); await flush();
    assert.equal(maps.maps.length,1); assert.equal(p.nodes.get('labLatitude').value,'39.875');
    assert.equal(p.nodes.get('labLongitude').value,'116.477');
});

test('opening again retries failed data instead of keeping a failed hidden map', async () => {
    let requests=0; const {p,maps} = await lab({mapFetch:()=>{requests++;return Promise.resolve(response({},503));}});
    assert.equal(requests,2); p.click('closeLocationLab'); assert.equal(maps.maps[0].removed,true);
    p.click('openLocationLab'); await flush(); assert.equal(requests,4); assert.equal(maps.maps.length,2);
});

test('exiting virtual location clears its marker and the next chat uses the real environment', async () => {
    const {p} = await lab(); select(p,'labPlace','pingleyuan-library'); await apply(p);
    p.click('exitVirtualPosition'); await flush();
    assert.match(p.nodes.get('labActiveState').textContent,/尚未启用/); assert.equal(p.nodes.get('advanceVirtualTime').disabled,true);
    assert.equal(p.geo.length+p.watches.length,1);
    p.click('returnFromLocationLab'); p.send('带我去图书馆'); await flush();
    assert.equal(p.chats()[0].body.context.simulated,false); assert.equal(p.chats()[0].body.context.position,null);
});

test('page disposal removes the open map and rejects delayed data callbacks', async () => {
    const {p,maps} = await lab(); p.pagehide(); await flush();
    assert.equal(maps.maps[0].removed,true);
});

test('coordinate route headings retain WGS84 and simulation identity without an invented building', async () => {
    for (const source of ['simulated','demo','geolocation']) {
        const p=page();await flush();p.send('平乐园图书馆怎么走');await flush();
        p.chats()[0].resolve(response(turn(1,'pingleyuan-library',{
            sceneAction:{type:'SHOW_ROUTE',placeIds:['pingleyuan-library']},
            context:{campusId:'pingleyuan',placeId:'pingleyuan-library',simulated:source!=='geolocation',
                position:{latitude:39.8741,longitude:116.4762,accuracy:20,source,timestamp:Date.now()}}})));await flush();
        const content=p.nodes.get('sceneContent').textContent;
        assert.match(content,/39\.874100, 116\.476200（WGS84）/);
        assert.match(content,source==='geolocation'?/从 当前位置/:/从 虚拟位置/);
        assert.doesNotMatch(content,/尚未确认的起点/);
    }
});
