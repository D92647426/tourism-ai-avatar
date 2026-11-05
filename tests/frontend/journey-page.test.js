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
function referenceMessages(h){return h.el('chatMessages').children.filter(message=>message.children.some(child=>child.className==='chat-references'));}

test('itinerary prepares real station drafts and next station retains narration without auto-send',async()=>{
    const h=await setup(),plan=h.env.GuideTour.snapshot(),a=plan.stops[0],b=plan.stops[1];
    assert.ok(a&&b);assert.equal(h.calls.length,0);
    assert.equal(h.env.GuideTour.prepare(a.id).accepted,true);assert.equal(h.calls.length,0);
    assert.match(h.el('chatContext').textContent,new RegExp(b.name));
    click(h.el('chatSendBtn'));await flush(h.env);
    assert.equal(h.calls[0].spotId,a.id);assert.equal(h.calls[0].narrationMode,'family');
    click(h.el('chatJourneyNext'));assert.equal(h.calls.length,1);assert.equal(h.env.GuideTour.snapshot().current.id,b.id);
    click(h.el('chatSendBtn'));await flush(h.env);
    assert.equal(h.calls[1].spotId,b.id);assert.equal(h.calls[1].narrationMode,'family');assert.equal(h.calls[1].conversationId,'room');
    const answers=referenceMessages(h);assert.equal(answers.length,2);
    assert.match(answers[0].children[0].children[2].children[0].textContent,/候选1/);
    assert.match(answers[1].children[0].children[2].children[0].textContent,/候选2/);
    click(h.el('chatNewBtn'));await flush(h.env);assert.equal(h.env.GuideTour.snapshot().current,null);assert.equal(h.el('chatJourneyNext').hidden,true);
});

test('draft or busy refusal never moves selection; last station has no next and unknown id stays put',async()=>{
    let finish;const h=await setup(()=>new Promise(resolve=>{finish=resolve;}));
    const plan=h.env.GuideTour.snapshot(),a=plan.stops[0],b=plan.stops[1];
    h.el('chatInput').value='原草稿';assert.equal(h.env.GuideTour.prepare(a.id).accepted,false);assert.equal(h.env.GuideTour.snapshot().current,null);
    h.el('quickActions').dispatch('click',{target:{closest:()=>({dataset:{msg:'快捷问题'}})}});assert.equal(h.el('chatInput').value,'原草稿');
    h.el('chatInput').value='';h.env.GuideTour.prepare(a.id);click(h.el('chatSendBtn'));await flush(h.env);
    assert.equal(h.env.GuideTour.prepare(b.id).accepted,false);assert.equal(h.env.GuideTour.snapshot().current.id,a.id);
    finish(response(200,{reply:'完成',spotId:a.id,narrationMode:'family'}));await flush(h.env);
    const last=plan.stops.at(-1);assert.equal(h.env.GuideTour.prepare(last.id).accepted,true);assert.equal(h.env.GuideTour.snapshot().next,null);
    assert.equal(h.env.GuideTour.prepare(99999).accepted,false);assert.equal(h.env.GuideTour.snapshot().current.id,last.id);
    const before=h.el('chatInput').value;click(h.el('journeyNextBtn'));assert.equal(h.el('chatInput').value,before);
});

test('replanning preserves draft, drops old retry and requires explicit re-selection',async()=>{
    const h=await setup(()=>response(503,{})),a=h.env.GuideTour.snapshot().stops[0];
    h.env.GuideTour.prepare(a.id);click(h.el('chatSendBtn'));await flush(h.env);assert.equal(h.el('chatRetryBtn').hidden,false);
    h.el('chatInput').value='未发送的想法';click(h.el('directorHalf'));
    h.el('quickActions').dispatch('click',{target:{closest:()=>({dataset:{msg:'快捷问题'}})}});
    assert.equal(h.el('chatInput').value,'未发送的想法');assert.equal(h.env.GuideTour.snapshot().current,null);
    click(h.el('chatRetryBtn'));click(h.el('chatSendBtn'));await flush(h.env);assert.equal(h.calls.length,1);
    assert.match(h.el('chatRequestStatus').textContent,/重新选站|重新选择/);
    h.el('chatInput').value='';
    assert.equal(h.env.GuideChatDraft('观察页准备的问题').accepted,false);
    assert.equal(h.env.GuideChatDraft('未知站点的问题',{spotId:99999}).accepted,false);
    h.el('chatInput').value='手动追问';click(h.el('chatSendBtn'));await flush(h.env);assert.equal(h.calls.length,1);
    h.el('chatInput').value='';const next=h.env.GuideTour.snapshot().stops[0];assert.equal(h.env.GuideTour.prepare(next.id).accepted,true);
    click(h.el('chatSendBtn'));await flush(h.env);assert.equal(h.calls[1].spotId,next.id);
});

test('plan invalidation cancels pending answer and its references even after late completion',async()=>{
    let finish;const h=await setup(()=>new Promise(resolve=>{finish=resolve;}));
    h.env.GuideTour.prepare(h.env.GuideTour.snapshot().stops[0].id);click(h.el('chatSendBtn'));await flush(h.env);
    click(h.el('directorRain'));
    finish(response(200,{reply:'不该出现',spotId:1,knowledgeReferences:[{id:99,title:'迟到候选',source:'local-knowledge:99'}]}));await flush(h.env);
    assert.equal(referenceMessages(h).length,0);assert.equal(h.el('chatRetryBtn').hidden,true);
    assert.ok(h.el('chatMessages').children.every(message=>!message.innerHTML.includes('不该出现')));
});

test('successfully switching outside the plan exits journey context',async()=>{
    const h=await setup((body,n)=>response(200,{reply:'答',spotId:n===1?body.spotId:null,conversationId:'room',narrationMode:'family',knowledgeReferences:[]}));
    h.env.GuideTour.prepare(h.env.GuideTour.snapshot().stops[0].id);click(h.el('chatSendBtn'));await flush(h.env);
    h.el('chatInput').value='其他地方';click(h.el('chatSendBtn'));await flush(h.env);
    assert.equal(h.env.GuideTour.snapshot().current,null);assert.equal(h.el('chatJourneyNext').hidden,true);
    assert.match(referenceMessages(h)[1].children[0].children[1].textContent,/没有匹配/);
});

test('cancelled response cannot attach candidates to a later successful retry',async()=>{
    let old;const h=await setup((body,n)=>n===1?new Promise(resolve=>{old=resolve;}):response(200,{reply:'重试完成',spotId:body.spotId,narrationMode:'family',knowledgeReferences:[{id:2,title:'重试候选',source:'local-knowledge:2'}]}));
    h.env.GuideTour.prepare(h.env.GuideTour.snapshot().stops[0].id);click(h.el('chatSendBtn'));await flush(h.env);
    click(h.el('chatCancelBtn'));click(h.el('chatRetryBtn'));await flush(h.env);
    old(response(200,{reply:'迟到回答',knowledgeReferences:[{id:1,title:'旧候选',source:'local-knowledge:1'}]}));await flush(h.env);
    const answers=referenceMessages(h);assert.equal(answers.length,1);
    assert.match(answers[0].children[0].children[2].children[0].textContent,/重试候选/);
    assert.doesNotMatch(answers[0].children[0].children[2].children[0].textContent,/旧候选/);
});

test('a server-invalid station leaves a corrective message and permits another explicit selection',async()=>{
    const h=await setup((body,n)=>n===1?response(400,{}):response(200,{reply:'有效站点',spotId:body.spotId,narrationMode:'family'}));
    const stops=h.env.GuideTour.snapshot().stops;h.env.GuideTour.prepare(stops[0].id);click(h.el('chatSendBtn'));await flush(h.env);
    assert.match(h.el('chatRequestStatus').textContent,/刷新页面|重新选择/);assert.equal(h.el('chatRetryBtn').hidden,true);
    assert.equal(h.env.GuideTour.prepare(stops[1].id).accepted,true);click(h.el('chatSendBtn'));await flush(h.env);
    assert.equal(h.calls[1].spotId,stops[1].id);
});


test('answer replay preserves the actual current journey, draft and narration without chat requests', async () => {
    const h = await setup(), first = h.env.GuideTour.snapshot().stops[0];
    h.env.GuideTour.prepare(first.id); click(h.el('chatSendBtn')); await flush(h.env);
    const before = JSON.stringify(h.env.GuideTour.snapshot()), context = h.el('chatContext').textContent;
    const card = h.el('chatMessages').children.flatMap(message => message.children.filter(child => child.className === 'chat-audio'))[0];
    assert.ok(card); h.el('chatInput').value = '保留这句草稿';
    click(card.children[1].children[0]); await flush(h.env);
    assert.equal(h.calls.length, 1); assert.equal(JSON.stringify(h.env.GuideTour.snapshot()), before);
    assert.equal(h.el('chatContext').textContent, context); assert.equal(h.el('chatInput').value, '保留这句草稿');
    assert.equal(h.el('chatNarrationMode').value, 'family');
});
