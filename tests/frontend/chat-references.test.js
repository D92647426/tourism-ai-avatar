const test=require('node:test'),assert=require('node:assert/strict');
const view=require('../../src/main/resources/static/js/chat-references.js');
const {createEnv}=require('./harness');

test('references are bounded local candidates rendered as plain text without links',()=>{
    const {document}=createEnv(),parent=document.createElement('div');
    const ref=id=>({id,title:'候选'+id,source:'local-knowledge:'+id});
    view.append(document,parent,{fallback:true,knowledgeReferences:[{...ref(4),title:'<img src=x onerror=alert(1)>'},ref(4),{...ref(5),source:'javascript:alert(1)'},ref(-1),ref(6),ref(7),ref(8)]});
    const details=parent.children[0],list=details.children[2];
    assert.match(details.children[0].textContent,/3/);assert.equal(list.children.length,3);
    assert.match(list.children[0].textContent,/<img/);assert.doesNotMatch(list.children[0].innerHTML,/<img/);
    assert.ok(list.children.every(li=>li.tagName==='LI'&&li.children.length===0));
    assert.match(details.children[1].textContent,/未核验|待核验/);assert.match(details.children[1].textContent,/本地/);
});
test('each message owns its references; empty and absent metadata remain honest',()=>{
    const {document}=createEnv(),a=document.createElement('div'),b=document.createElement('div');
    view.append(document,a,{knowledgeReferences:[{id:1,title:'第一份',source:'local-knowledge:1'}]});
    view.append(document,b,{fallback:false,knowledgeReferences:[]});
    assert.match(a.children[0].children[2].children[0].textContent,/第一份/);
    assert.match(b.children[0].children[1].textContent,/没有匹配/);
    const c=document.createElement('div');view.append(document,c,{});
    assert.match(c.children[0].children[1].textContent,/未提供/);
});
