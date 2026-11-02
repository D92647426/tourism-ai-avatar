/* REQ-043: deterministic course itinerary editor, not navigation. docs/director_design.md. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GuideDirector=factory();})(typeof window!=='undefined'?window:globalThis,function(){
    'use strict';
    // Durations and scene tags are authored course estimates, never live facility claims.
    var catalogue=[
        {name:'灵山大佛',minutes:20,theme:'culture',family:1,shelter:false,prompt:'观察双手姿态，把看到的细节与自己的解释分开。'},
        {name:'九龙灌浴',minutes:15,theme:'family',family:3,shelter:false,prompt:'不预设演出发生，观察莲花与水景的构造。'},
        {name:'灵山梵宫',minutes:25,theme:'art',family:1,shelter:true,prompt:'找一种光或纹样，描述它怎样改变空间的感觉。'},
        {name:'佛教文化博览馆',minutes:20,theme:'culture',family:1,shelter:true,prompt:'选一个展陈细节，写出你还想核对的问题。'},
        {name:'菩提大道',minutes:10,theme:'nature',family:2,shelter:false,prompt:'记录一种植物或重复的排列，留意它的节奏。'},
        {name:'祥符禅寺',minutes:15,theme:'culture',family:1,shelter:false,prompt:'比较两处建筑细节，区分观察与猜测。'},
        {name:'五印坛城',minutes:20,theme:'art',family:1,shelter:false,prompt:'找出一处颜色与形状的组合，用自己的话描述。'}
    ];
    /** Validate explicit preferences and available API spots. Output bounded, detached course plan.
     * Throws on invalid preferences; never mutates inputs or fabricates missing API spots. */
    function plan(input,spots){
        if(!input||!Number.isInteger(input.minutes)||input.minutes<15||input.minutes>180||
            !['solo','family','easy'].includes(input.party)||!['culture','art','nature'].includes(input.interest)||
            !['fair','rain'].includes(input.weather))throw new Error('请选择有效的时间、同行方式与兴趣。');
        var available=new Map((Array.isArray(spots)?spots:[]).filter(function(s){return s&&Number.isInteger(s.id)&&typeof s.name==='string';}).map(function(s){return [s.name,s];}));
        var ranked=catalogue.filter(function(s){return available.has(s.name)&&(input.weather!=='rain'||s.shelter);}).map(function(s,index){
            return {item:s,index:index,score:(s.theme===input.interest?6:0)+(input.party==='family'?s.family*2:0)+(input.party==='easy'?-s.minutes/10:0)};
        }).sort(function(a,b){return b.score-a.score||a.index-b.index;});
        var stops=[],total=0,limit=input.party==='easy'?2:4;
        ranked.forEach(function(row){var s=row.item;if(stops.length>=limit||total+s.minutes>input.minutes)return;
            var reason=s.theme===input.interest?'与你的'+({culture:'人文故事',art:'建筑艺术',nature:'自然观察'}[input.interest])+'兴趣相符。':'补充一种不同的观察角度。';
            if(input.party==='family'&&s.family>=2)reason+='适合一起找细节、互相提问。';
            if(input.party==='easy')reason+='少选站点，给停留留出余量。';
            if(input.weather==='rain')reason+='课程资料按室内候选编排，是否开放与实际避雨条件需现场确认。';
            stops.push({id:available.get(s.name).id,name:s.name,minutes:s.minutes,prompt:s.prompt,reason:reason});total+=s.minutes;
        });
        return {options:Object.assign({},input),stops:stops,total:total,remaining:input.minutes-total,
            notice:'停留时长为课设估算，不含步行、排队和演出等待；顺序为内容编排，不是地图导航。请以景区公告与现场条件为准。'};
    }
    /** REQ-043: compare two plan() outputs (before may be null), returning kept/removed names.
     * No I/O or mutation; callers supply valid plans. docs/director_design.md#L3. */
    function difference(before,after){
        var previous=before?before.stops:[],next=after.stops;
        return {kept:next.filter(function(s){return previous.some(function(p){return p.id===s.id;});}).map(function(s){return s.name;}),
            removed:previous.filter(function(s){return !next.some(function(p){return p.id===s.id;});}).map(function(s){return s.name;})};
    }
    return {plan:plan,difference:difference};
});
