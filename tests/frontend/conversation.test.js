// REQ-039: exercise real main/security scripts with server-like chat responses.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEnv, loadScript, flush, response } = require('./harness');

test('chat reuses server conversation id and new conversation resets it through CSRF API', async () => {
    const calls = [];
    const env = createEnv({fetch(url, opts) {
        if (url === '/api/auth/me') return response(200, {username:'alice',role:'GUEST'});
        if (url === '/api/auth/csrf') return response(200,{headerName:'X-XSRF-TOKEN',token:'test'});
        if (url === '/api/spots') return response(200,[]);
        if (url === '/api/digital-human-config') return response(200,{name:'灵灵'});
        if (url === '/api/chat') {
            calls.push({url,body:JSON.parse(opts.body),headers:opts.headers});
            return response(200,{reply:'回答',fallback:true,conversationId:'room-1'});
        }
        if (url === '/api/chat/new') {
            calls.push({url,headers:opts.headers});
            return response(200,{conversationId:'room-2',spotId:null});
        }
        return response(200,{});
    }});
    loadScript(env,'security.js'); loadScript(env,'main.js'); await flush(env);
    const input = env.document.getElementById('chatInput');
    input.value = '第一个'; env.document.getElementById('chatSendBtn').dispatch('click'); await flush(env);
    input.value = '它的故事'; env.document.getElementById('chatSendBtn').dispatch('click'); await flush(env);
    assert.equal(calls[0].body.conversationId,null);
    assert.equal(calls[1].body.conversationId,'room-1');
    assert.equal('userId' in calls[1].body,false);
    env.document.getElementById('chatNewBtn').dispatch('click'); await flush(env);
    assert.equal(calls[2].url,'/api/chat/new');
    assert.equal(calls[2].headers['X-XSRF-TOKEN'],'test');
    input.value='新问题'; env.document.getElementById('chatSendBtn').dispatch('click'); await flush(env);
    assert.equal(calls[3].body.conversationId,'room-2');
});

test('expired conversation gives an actionable new conversation prompt', async () => {
    const env=createEnv({fetch(url) {
        if(url==='/api/auth/me') return response(200,{username:'alice',role:'GUEST'});
        if(url==='/api/auth/csrf') return response(200,{headerName:'X-XSRF-TOKEN',token:'test'});
        if(url==='/api/spots') return response(200,[]);
        if(url==='/api/digital-human-config') return response(200,{name:'灵灵'});
        if(url==='/api/chat') return response(410,{});
        return response(200,{});
    }});
    loadScript(env,'security.js'); loadScript(env,'main.js'); await flush(env);
    env.document.getElementById('chatInput').value='追问';
    env.document.getElementById('chatSendBtn').dispatch('click'); await flush(env);
    assert.ok(env.document.getElementById('chatMessages').children.some(child=>/对话已过期/.test(child.innerHTML)));
    assert.equal(env.document.getElementById('chatNewBtn').disabled,false);
});
