// REQ-042: device voice selection and numeric speech settings; docs/voice_settings.md.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GuideVoiceSettings=factory();})(typeof window!=='undefined'?window:globalThis,function(){
    'use strict';
    /** Normalize public config without coercing strings or losing volume zero. No I/O/errors. */
    function normalize(raw){
        raw=raw||{};
        return {volume:Number.isFinite(raw.volume)&&raw.volume>=0&&raw.volume<=1?raw.volume:1,
            speechRate:Number.isFinite(raw.speechRate)&&raw.speechRate>=0.5&&raw.speechRate<=2?raw.speechRate:1,
            voiceType:typeof raw.voiceType==='string'&&raw.voiceType.trim()&&raw.voiceType.trim().length<=200?raw.voiceType.trim():'auto'};
    }
    function chinese(voices){return Array.from(voices||[]).filter(function(v){return v&&/^zh(?:[-_]|$)/i.test(v.lang)&&typeof v.voiceURI==='string'&&v.voiceURI&&v.voiceURI.length<=200;});}
    /** Select an actually available Chinese voice; gender labels never invent a device capability. */
    function choose(raw,voices){
        var config=normalize(raw),list=chinese(voices),key=config.voiceType;
        if(key==='local:character')return {voice:list.find(function(v){return v.default;})||list[0]||null,notice:'本地角色声线；服务不可用时回退设备中文声音。'};
        if(!list.length)return {voice:null,notice:'此设备暂无可用中文声线，保留文字回答。'};
        var exact=list.find(function(v){return v.voiceURI===key;});
        if(exact)return {voice:exact,notice:'使用设备声线：'+(exact.name||exact.voiceURI)};
        return {voice:list.find(function(v){return v.default;})||list[0],notice:key==='auto'?'使用设备默认中文声线。':
            key==='male'||key==='female'?'旧设置 '+key+' 已回退到设备中文声线，不保证男女声。':'所选声线在此设备不可用，已回退到设备中文声线。'};
    }
    return {normalize:normalize,chinese:chinese,choose:choose};
});
