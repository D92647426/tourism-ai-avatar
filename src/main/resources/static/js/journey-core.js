/* REQ-047: page-local lecture selection, never a visit log. docs/journey_references_design.md. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GuideJourney=factory();})(typeof window!=='undefined'?window:globalThis,function(){
    'use strict';
    /** Create an isolated journey with replace/select/clear/snapshot.
     * Input: replace accepts <=4 unique positive safe IDs and nonempty names.
     * Output: detached snapshots. Invalid replace throws TypeError atomically;
     * unknown select returns false. No I/O. Change limits with TEST-047. */
    function create(){
        var stops=[],currentId=null,revision=0;
        function copy(stop){return stop?{id:stop.id,name:stop.name}:null;}
        function snapshot(){
            var index=stops.findIndex(function(stop){return stop.id===currentId;});
            return {revision:revision,stops:stops.map(copy),current:copy(stops[index]),next:copy(index<0?null:stops[index+1])};
        }
        return {
            replace:function(input){
                if(!Array.isArray(input)||input.length>4)throw new TypeError('游览方案无效，请重新编排。');
                var ids=new Set(),next=input.map(function(stop){
                    if(!stop||!Number.isSafeInteger(stop.id)||stop.id<=0||ids.has(stop.id)||typeof stop.name!=='string'||!stop.name.trim()||stop.name.length>200)throw new TypeError('游览站点无效，请重新编排。');
                    ids.add(stop.id);return copy(stop);
                });
                stops=next;currentId=null;revision++;return snapshot();
            },
            select:function(id){if(!stops.some(function(stop){return stop.id===id;}))return false;currentId=id;return true;},
            clear:function(){currentId=null;},snapshot:snapshot
        };
    }
    return {create:create};
});
