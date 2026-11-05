const test=require('node:test'),assert=require('node:assert/strict');
const {createEnv,loadScript,flush,response}=require('./harness');
const names=['灵山大佛','九龙灌浴','灵山梵宫','佛教文化博览馆','菩提大道','祥符禅寺','五印坛城'];
const spots=names.map((name,i)=>({id:i+1,name,brief:'简介',address:'地址',category:'景点',highlights:[]}));
const click=node=>node.dispatch('click',{stopPropagation(){}});
async function setup(custom){
    const calls=[];let currentSpot=null;
    const env=createEnv({fetch(url,opts){
        if(url==='/api/auth/me')return response(200,{username:'alice',userId:'alice',role:'GUEST'});
        if(url==='/api/auth/csrf')return response(200,{headerName:'X-XSRF-TOKEN',token:'test'});
        if(url==='/api/spots')return response(200,spots);
        if(url==='/api/chat/context')return response(200,{conversationId:'room',spotId:null,narrationMode:'family'});
        if(url==='/api/chat/new')return response(200,{conversationId:'new',spotId:null,narrationMode:'standard'});
        if(url==='/api/chat'){
            const body=JSON.parse(opts.body);calls.push(body);currentSpot=body.spotId||currentSpot;
            if(custom)return custom(body,calls.length);
            return response(200,{reply:'本站介绍'+calls.length,spotId:currentSpot,conversationId:'room',narrationMode:body.narrationMode,fallback:true,
                knowledgeReferences:[{id:calls.length,title:'候选'+calls.length,source:'local-knowledge:'+calls.length}]});
        }
        return response(200,{});
    }});
    const el=id=>env.document.getElementById(id);
    el('directorTime').value='60';el('directorParty').value='solo';el('directorInterest').value='culture';
    loadScript(env,'director-core.js');loadScript(env,'director.js');loadScript(env,'security.js');loadScript(env,'main.js');await flush(env);
    return {env,el,calls};
}

function cards(h) {
    return h.el('chatMessages').children.flatMap(message => message.children.filter(child => child.className === 'chat-followups'));
}
async function answerFirst(h) {
    const first = h.env.GuideTour.snapshot().stops[0];
    h.env.GuideTour.prepare(first.id); click(h.el('chatSendBtn')); await flush(h.env);
    return first;
}

test('station follow-up prepares editable text, preserves tour and sends only on confirmation with current mode', async () => {
    const h = await setup(), first = await answerFirst(h);
    const card = cards(h)[0]; assert.ok(card);
    click(card.children[2].children[1]);
    assert.equal(h.calls.length, 1);
    assert.match(h.el('chatInput').value, /生活中的比喻/);
    assert.match(h.el('chatInput').value, new RegExp(first.name));
    assert.equal(h.env.GuideTour.snapshot().current.id, first.id);
    assert.equal(h.el('chatJourneyNext').hidden, false);
    h.el('chatNarrationMode').value = 'brief'; h.el('chatNarrationMode').dispatch('change');
    click(h.el('chatSendBtn')); await flush(h.env);
    assert.equal(h.calls[1].spotId, first.id);
    assert.equal(h.calls[1].narrationMode, 'brief');
    assert.equal(h.calls[1].conversationId, 'room');
});

test('historical answer returns to its own station and exits a different tour selection', async () => {
    const h = await setup(), first = await answerFirst(h), original = cards(h)[0];
    click(h.el('chatJourneyNext')); click(h.el('chatSendBtn')); await flush(h.env);
    const second = cards(h)[1]; assert.ok(second);
    click(original.children[2].children[0]);
    assert.equal(h.calls.length, 2);
    assert.equal(h.env.GuideTour.snapshot().current, null);
    click(h.el('chatSendBtn')); await flush(h.env);
    assert.equal(h.calls[2].spotId, first.id);
    assert.match(original.children[0].textContent, new RegExp(first.name));
    assert.notEqual(second.children[0].textContent, original.children[0].textContent);
});

test('existing draft and busy request refuse follow-ups without replacing draft or station', async () => {
    let finish;
    const h = await setup((body, n) => n === 1 ? response(200, {reply: '介绍', spotId: body.spotId}) : new Promise(resolve => {finish = resolve;}));
    const first = await answerFirst(h), card = cards(h)[0];
    h.el('chatInput').value = '自己的问题'; click(card.children[2].children[0]);
    assert.equal(h.el('chatInput').value, '自己的问题'); assert.match(card.children[3].textContent, /草稿/);
    click(h.el('chatSendBtn')); await flush(h.env);
    click(card.children[2].children[2]);
    assert.equal(h.calls.length, 2); assert.equal(h.el('chatInput').value, '');
    assert.match(card.children[3].textContent, /上一个问题/);
    assert.equal(h.env.GuideTour.snapshot().current.id, first.id);
    finish(response(200, {reply: '结束', spotId: first.id})); await flush(h.env);
});

test('replan keeps a draft until cleared then accepts a follow-up as explicit station selection', async () => {
    const h = await setup(), first = await answerFirst(h), card = cards(h)[0];
    h.el('chatInput').value = '保留的问题'; click(h.el('directorHalf'));
    click(card.children[2].children[0]);
    assert.equal(h.el('chatInput').value, '保留的问题');
    assert.equal(h.env.GuideTour.snapshot().current, null); assert.equal(h.calls.length, 1);
    h.el('chatInput').value = ''; click(card.children[2].children[2]);
    assert.equal(h.calls.length, 1); assert.match(h.el('chatInput').value, /现场留意/);
    click(h.el('chatSendBtn')); await flush(h.env);
    assert.equal(h.calls[1].spotId, first.id);
    assert.equal(h.env.GuideTour.snapshot().current, null);
});

test('general or unknown station responses have no station follow-up card', async () => {
    for (const id of [null, 99999]) {
        const h = await setup(() => response(200, {reply: '通用回答', spotId: id}));
        h.el('chatInput').value = '你好'; click(h.el('chatSendBtn')); await flush(h.env);
        assert.equal(cards(h).length, 0);
    }
});

test('cancelled late response does not append a follow-up card', async () => {
    let finish; const h = await setup(() => new Promise(resolve => {finish = resolve;}));
    const first = h.env.GuideTour.snapshot().stops[0];
    h.env.GuideTour.prepare(first.id); click(h.el('chatSendBtn')); await flush(h.env);
    click(h.el('chatCancelBtn'));
    finish(response(200, {reply: '迟到', spotId: first.id})); await flush(h.env);
    assert.equal(cards(h).length, 0);
});
