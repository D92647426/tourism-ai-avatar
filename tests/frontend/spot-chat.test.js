'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createEnv, loadScript, flush, response} = require('./harness');

test('detail selects real spotId without sending; followups, reopening and reset preserve clear context', async () => {
    const spots = [1,2].map(id => ({id,name:'景点'+id,address:'地址',brief:'简介',history:'故事',highlights:[]}));
    const calls=[];
    let currentSpot = null;
    const env=createEnv({fetch(url,options) {
        if(url==='/api/spots') return response(200,spots);
        if(url==='/api/auth/me') return response(200,{username:'alice',role:'GUEST'});
        if(url==='/api/auth/csrf') return response(200,{headerName:'X-XSRF-TOKEN',token:'test'});
        if(url==='/api/chat/new') return response(200,{conversationId:'new-room',spotId:null});
        if(url==='/api/chat') {
            const body=JSON.parse(options.body); calls.push(body);
            currentSpot = body.spotId || currentSpot;
            return response(200,{reply:'回答',conversationId:'room',spotId:currentSpot});
        }
        return response(200,{});
    }});
    loadScript(env,'security.js'); loadScript(env,'main.js'); await flush(env);
    const el=id=>env.document.getElementById(id);
    const click=target=>target.dispatch('click',{stopPropagation(){}});
    function select(index) {
        click(el('spotsGrid').children[index]);
        click(el('modalBody').children.at(-1));
    }
    async function send(message) {el('chatInput').value=message;click(el('chatSendBtn'));await flush(env);}
    select(0);
    assert.equal(calls.length,0);
    assert.match(el('chatContext').textContent,/景点1/);
    await send('它有什么故事'); assert.equal(calls[0].spotId,1);
    await send('它什么时候开放'); assert.equal('spotId' in calls[1],false);
    click(el('chatPanelClose'));click(el('chatFab'));
    assert.match(el('chatContext').textContent,/景点1/);
    assert.equal(calls.length,2);
    select(1);await send('它什么时候开放');
    assert.equal(calls[2].spotId,2);assert.equal(calls[2].conversationId,'room');
    click(el('chatNewBtn'));await flush(env);
    assert.match(el('chatContext').textContent,/通用导览/);
    await send('推荐路线');assert.equal('spotId' in calls[3],false);
    assert.equal(calls[3].conversationId,'new-room');
});

test('reload restores server context and text can switch it without sending a stale spotId', async () => {
    let body;
    const env=createEnv({fetch(url,options) {
        if(url==='/api/spots') return response(200,[{id:1,name:'旧景点',address:'地址'},{id:2,name:'新景点',address:'地址'}]);
        if(url==='/api/chat/context') return response(200,{conversationId:'existing',spotId:1});
        if(url==='/api/auth/csrf') return response(200,{headerName:'X-XSRF-TOKEN',token:'test'});
        if(url==='/api/chat') {body=JSON.parse(options.body);return response(200,{reply:'新景点回答',spotId:2,conversationId:'existing'});}
        return response(200,{});
    }});
    loadScript(env,'security.js');loadScript(env,'main.js');await flush(env);
    const el=id=>env.document.getElementById(id);
    assert.match(el('chatContext').textContent,/旧景点/);
    el('chatInput').value='新景点是什么';el('chatSendBtn').dispatch('click');await flush(env);
    assert.equal(body.conversationId,'existing');assert.equal('spotId' in body,false);
    assert.match(el('chatContext').textContent,/新景点/);
});

test('pending question cannot race a new spot selection or send twice', async () => {
    let resolveChat; let requests=0;
    const env=createEnv({fetch(url) {
        if(url==='/api/spots') return response(200,[{id:1,name:'第一站',address:'地址',highlights:[]}]);
        if(url==='/api/auth/csrf') return response(200,{headerName:'X-XSRF-TOKEN',token:'test'});
        if(url==='/api/chat') {requests++;return new Promise(resolve=>{resolveChat=resolve;});}
        return response(200,{});
    }});
    loadScript(env,'security.js');loadScript(env,'main.js');await flush(env);
    const el=id=>env.document.getElementById(id), event={stopPropagation(){}};
    el('chatInput').value='问题';el('chatSendBtn').dispatch('click');await flush(env);
    el('chatInput').value='第二个';el('chatSendBtn').dispatch('click');
    el('spotsGrid').children[0].dispatch('click');
    const ask=el('modalBody').children.at(-1);ask.dispatch('click',event);
    assert.equal(requests,1);assert.match(ask.textContent,/请等待/);
    assert.doesNotMatch(el('chatContext').textContent,/第一站/);
    resolveChat(response(200,{reply:'完成',spotId:null,conversationId:'room'}));await flush(env);
});
