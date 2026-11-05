const test=require('node:test'),assert=require('node:assert/strict');
const {createEnv,loadScript,flush,response}=require('./harness');
const names=['灵山大佛','九龙灌浴','灵山梵宫','佛教文化博览馆','菩提大道','祥符禅寺','五印坛城'];
const spots=names.map((name,i)=>({id:i+1,name,brief:'简介',address:'地址',category:'景点',highlights:[]}));
const theme={id:'scene-details',title:'从整体到细节',question:'怎样看景？',notice:'静态课程资料，待核验',stops:spots.slice(0,3).map((s,i)=>({spotId:s.id,name:s.name,focus:['整体','组合','细节'][i],question:'观察问题'+i,bridge:'衔接'+i,recap:'关键词'+i}))};
const click=node=>node.dispatch('click',{stopPropagation(){}});
async function setup(custom,catalog=[theme]){
    const calls=[];let currentSpot=null;
    const env=createEnv({fetch(url,opts){
        if(url==='/api/auth/me')return response(200,{username:'alice',userId:'alice',role:'GUEST'});
        if(url==='/api/auth/csrf')return response(200,{headerName:'X-XSRF-TOKEN',token:'test'});
        if(url==='/api/spots')return response(200,spots);
        if(url==='/api/themes')return response(200,catalog);
        if(url==='/api/chat/context')return response(200,{conversationId:'room',spotId:null,narrationMode:'family'});
        if(url==='/api/chat/new')return response(200,{conversationId:'new',spotId:null,narrationMode:'standard'});
        if(url==='/api/chat'){
            const body=JSON.parse(opts.body);calls.push(body);currentSpot=body.spotId||currentSpot;
            if(custom)return custom(body,calls.length);
            return response(200,{reply:'本站介绍'+calls.length,spotId:currentSpot,conversationId:'room',narrationMode:body.narrationMode,fallback:true,
                themeId:body.themeId||null,themeLecture:!!body.themeLecture,
                knowledgeReferences:[{id:calls.length,title:'候选'+calls.length,source:'local-knowledge:'+calls.length}]});
        }
        return response(200,{});
    }});
    const el=id=>env.document.getElementById(id);
    el('directorTime').value='60';el('directorParty').value='solo';el('directorInterest').value='culture';
    loadScript(env,'director-core.js');loadScript(env,'director.js');loadScript(env,'security.js');loadScript(env,'main.js');await flush(env);
    return {env,el,calls};
}

function start(h){click(h.el('themeUseBtn'));}
async function send(h){click(h.el('chatSendBtn'));await flush(h.env);}

test('selecting a theme reuses itinerary without automatic requests; three successful stations yield recap',async()=>{
    const h=await setup();start(h);
    assert.equal(h.calls.length,0);assert.equal(h.env.GuideTour.snapshot().themeId,theme.id);
    assert.deepEqual(Array.from(h.env.GuideTour.snapshot().stops,s=>s.id),[1,2,3]);
    assert.match(h.el('directorSummary').textContent,/主题/);
    h.env.GuideTour.prepare(1);await send(h);
    assert.equal(h.calls[0].themeId,theme.id);assert.equal(h.calls[0].themeLecture,true);assert.equal(h.calls[0].narrationMode,'family');
    assert.match(h.el('themeProgress').textContent,/1 \/ 3/);
    click(h.el('chatJourneyNext'));await send(h);click(h.el('chatJourneyNext'));await send(h);
    assert.match(h.el('themeProgress').textContent,/3 \/ 3/);assert.equal(h.el('themeRecap').children.length,3);
    assert.equal(h.env.GuideTour.snapshot().next,null);assert.equal(h.el('chatJourneyNext').hidden,true);
});

test('edited lecture drafts become theme questions and repeated lectures count once',async()=>{
    const h=await setup();start(h);h.env.GuideTour.prepare(1);
    h.el('chatInput').value='我想问别的细节';await send(h);
    assert.equal(h.calls[0].themeId,theme.id);assert.equal(h.calls[0].themeLecture,undefined);assert.match(h.el('themeProgress').textContent,/0 \/ 3/);
    h.env.GuideTour.prepare(1);await send(h);h.env.GuideTour.prepare(1);await send(h);
    assert.match(h.el('themeProgress').textContent,/1 \/ 3/);assert.equal(h.el('themeRecap').children.length,1);
});

test('failed and cancelled responses do not count; replanning discards late success and clears theme',async()=>{
    let finish;const h=await setup(()=>new Promise(resolve=>{finish=resolve;}));start(h);h.env.GuideTour.prepare(1);await send(h);
    click(h.el('directorHalf'));assert.equal(h.env.GuideTour.snapshot().themeId,null);
    finish(response(200,{reply:'迟到',spotId:1,themeId:theme.id,themeLecture:true}));await flush(h.env);
    assert.equal(h.el('themeRecap').children.length,0);assert.match(h.el('themeProgress').textContent,/选择主题/);
    const failed=await setup(()=>response(503,{}));start(failed);failed.env.GuideTour.prepare(1);await send(failed);
    assert.match(failed.el('themeProgress').textContent,/0 \/ 3/);
});

test('switching plans preserves drafts, re-selection is explicit and new conversation clears progress',async()=>{
    const h=await setup();start(h);h.env.GuideTour.prepare(1);await send(h);
    h.el('chatInput').value='保留草稿';start(h);assert.equal(h.el('chatInput').value,'保留草稿');
    assert.equal(h.env.GuideTour.prepare(2).accepted,false);assert.equal(h.calls.length,1);
    h.el('chatInput').value='';h.env.GuideTour.prepare(2);await send(h);assert.match(h.el('themeProgress').textContent,/1 \/ 3/);
    click(h.el('chatNewBtn'));await flush(h.env);assert.match(h.el('themeProgress').textContent,/0 \/ 3/);
    assert.equal(h.env.GuideTour.snapshot().current,null);
});

test('ordinary station draft cannot forge themed lecture and mode changes preserve selected theme',async()=>{
    const h=await setup();start(h);h.env.GuideTour.prepare(1);
    h.el('chatNarrationMode').value='brief';h.el('chatNarrationMode').dispatch('change');await send(h);
    assert.equal(h.calls[0].themeLecture,true);assert.equal(h.calls[0].narrationMode,'brief');
    h.el('chatInput').value='';assert.equal(h.env.GuideChatDraft('普通问题',{spotId:4}).accepted,true);await send(h);
    assert.equal(h.calls[1].themeId,undefined);assert.equal(h.calls[1].themeLecture,undefined);
});

test('theme names and recap are rendered as safe text',async()=>{
    const title=theme.title;theme.title='<img src=x onerror=bad()>';
    try{const h=await setup();assert.match(h.el('themeTitle').innerHTML,/&lt;img/);start(h);h.env.GuideTour.prepare(1);await send(h);assert.ok(h.el('themeRecap').children[0].textContent.includes('关键词'));}
    finally{theme.title=title;}
});


test('invalid or unavailable catalog keeps ordinary plans usable and theme disabled',async()=>{
    for(const catalog of [[],{},[{...theme,id:123}],[{...theme,stops:theme.stops.slice(0,2)}]]){
        const h=await setup(null,catalog);assert.equal(h.el('themeUseBtn').disabled,true);
        assert.equal(h.env.GuideTour.snapshot().themeId,null);assert.ok(h.env.GuideTour.snapshot().stops.length>0);
    }
});

test('only matching lecture metadata counts and preparation alone is never a receipt',async()=>{
    const h=await setup(body=>response(200,{reply:'回答',spotId:body.spotId,themeId:'other-theme',themeLecture:true}));
    start(h);h.env.GuideTour.prepare(1);assert.match(h.el('themeProgress').textContent,/0 \/ 3/);await send(h);
    assert.match(h.el('themeProgress').textContent,/0 \/ 3/);assert.equal(h.el('themeRecap').children.length,0);
});

test('catalog validation rejects duplicates, foreign IDs and blank content atomically',()=>{
    const validate=require('../../src/main/resources/static/js/theme-guide').validate;
    const original=JSON.stringify(theme);const view=validate(theme,spots);view.stops[0].focus='外部修改';assert.equal(JSON.stringify(theme),original);
    for(const invalid of [{...theme,stops:[theme.stops[0],theme.stops[0],theme.stops[2]]},
        {...theme,stops:[{...theme.stops[0],spotId:99999},...theme.stops.slice(1)]},{...theme,title:' '}])assert.throws(()=>validate(invalid,spots));
});
