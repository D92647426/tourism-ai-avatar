// TEST-046: run real main/security scripts through the visitor controls.
const test = require('node:test');
const assert = require('node:assert/strict');
const {createEnv,loadScript,flush,response}=require('./harness');

function setup(chatReply) {
    const calls=[];
    const env=createEnv({fetch(url,opts) {
        if(url==='/api/auth/me')return response(200,{username:'alice',role:'GUEST'});
        if(url==='/api/auth/csrf')return response(200,{headerName:'X-XSRF-TOKEN',token:'test'});
        if(url==='/api/spots')return response(200,[]);
        if(url==='/api/chat/context')return response(200,{conversationId:'room',narrationMode:'family'});
        if(url==='/api/chat/new')return response(200,{conversationId:'new',spotId:null,narrationMode:'standard'});
        if(url==='/api/chat') {
            const body=JSON.parse(opts.body);calls.push(body);
            return chatReply ? chatReply(body) : response(200,{reply:'介绍',fallback:true,narrationMode:body.narrationMode,conversationId:'room'});
        }
        return response(200,{});
    }});
    loadScript(env,'security.js');loadScript(env,'main.js');
    return {env,calls,el:id=>env.document.getElementById(id)};
}

test('restores session mode; changes preserve drafts without sending and new conversation resets',async()=>{
    const h=setup();await flush(h.env);
    assert.equal(h.el('chatNarrationMode').value,'family');
    h.el('chatInput').value='我想知道的';h.el('chatNarrationMode').value='brief';
    h.el('chatNarrationMode').dispatch('change');await flush(h.env);
    assert.equal(h.calls.length,0);assert.equal(h.el('chatInput').value,'我想知道的');
    h.el('chatSendBtn').dispatch('click');await flush(h.env);
    assert.equal(h.calls[0].narrationMode,'brief');
    assert.match(h.el('chatMessages').children.at(-1).innerHTML,/精简讲解/);
    h.el('chatNewBtn').dispatch('click');await flush(h.env);
    assert.equal(h.el('chatNarrationMode').value,'standard');
});

test('pending disables selection; changing mode discards an old retry snapshot',async()=>{
    let resolve;
    const h=setup(()=>new Promise(done=>{resolve=done;}));await flush(h.env);
    h.el('chatInput').value='介绍';h.el('chatSendBtn').dispatch('click');await flush(h.env);
    assert.equal(h.el('chatNarrationMode').disabled,true);
    resolve(response(503,{}));await flush(h.env);
    assert.equal(h.el('chatRetryBtn').hidden,false);
    h.el('chatNarrationMode').value='brief';h.el('chatNarrationMode').dispatch('change');
    h.el('chatRetryBtn').dispatch('click');await flush(h.env);
    assert.equal(h.calls.length,1);assert.equal(h.el('chatRetryBtn').hidden,true);
    assert.equal(h.el('chatNarrationMode').disabled,false);
});
