/* REQ-048: supplied candidates belong to one answer, not verified citations. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GuideChatReferences=factory();})(typeof window!=='undefined'?window:globalThis,function(){
    'use strict';
    /** Append bounded, pure-text candidates to the same bot message.
     * Inputs: document, message element, response. Output: inserted details element.
     * Invalid metadata is omitted with an explicit empty state. No links/network or
     * shared latest-state. Change policy with TEST-048/docs/journey_references_design.md. */
    function append(doc,parent,response){
        var raw=response&&response.knowledgeReferences,items=[],seen=new Set();
        if(Array.isArray(raw))raw.slice(0,30).forEach(function(ref){
            if(items.length>=3||!ref||!Number.isSafeInteger(ref.id)||ref.id<=0||seen.has(ref.id)||typeof ref.title!=='string'||!ref.title.trim()||ref.source!=='local-knowledge:'+ref.id)return;
            seen.add(ref.id);items.push({id:ref.id,title:ref.title.slice(0,80)});
        });
        function el(tag,text){var node=doc.createElement(tag);node.textContent=text;return node;}
        var details=el('details','');details.className='chat-references';
        details.appendChild(el('summary',items.length?'本次参考候选（'+items.length+'条）':'本次参考候选：无可展示条目'));
        var empty=!Array.isArray(raw)?'本次响应未提供参考候选。':raw.length?'本次没有可展示的有效参考候选。':'本次没有匹配的知识候选。';
        var notice=items.length?'以下是提供给导游的资料候选，均待核验，不证明模型逐句采用或已核验。':empty+' 不代表不存在其他官方资料。';
        if(response&&response.fallback)notice+=' 当前为本地降级回答，可能使用景点卡片或规则，并非实时查询。';
        details.appendChild(el('p',notice));
        var list=el('ul','');items.forEach(function(ref){list.appendChild(el('li','K'+ref.id+' · '+ref.title+'（本地课程资料，待核验）'));});details.appendChild(list);
        parent.appendChild(details);return details;
    }
    return {append:append};
});
