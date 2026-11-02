/* REQ-047: explicit itinerary-to-guide handoff. docs/journey_references_design.md. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GuideJourneyPage=factory();})(typeof window!=='undefined'?window:globalThis,function(){
    'use strict';
    /** Mount once with window and callbacks invalidate()/changed(). Returns GuideTour.
     * Invalid plans/IDs and busy/draft refusal become visible feedback, not state changes.
     * No fetch/storage/auto-send. Validation: journey-core, TEST-047 and design doc. */
    function mount(win,callbacks){
        var $=function(id){return win.document.getElementById(id);},journey=win.GuideJourney.create();
        function note(text){$('journeyFeedback').textContent=text;}
        function render(){
            var state=journey.snapshot();
            $('journeyCurrent').textContent=state.current?'讲解选择：'+state.current.name:'从方案中选择一站，准备数字人的讲解。';
            $('journeyNext').textContent=state.current?(state.next?'下一站：'+state.next.name:'这是方案的最后一站。'):(state.stops.length?'尚未选择讲解站点。':'暂无可讲解方案，请重新编排。');
            $('journeyNextBtn').disabled=!state.next;$('chatJourneyNext').hidden=!state.next;
            if(callbacks.changed)callbacks.changed();
        }
        function prepare(id){
            var stop=journey.snapshot().stops.find(function(item){return item.id===id;});
            if(!stop){note('该站不在当前方案中，请重新选站。');return {accepted:false,reason:'该站不在当前方案中，请重新选站。'};}
            var result=typeof win.GuideChatDraft==='function'?win.GuideChatDraft('请介绍【'+stop.name+'】，先讲最值得了解的一点。',{spotId:stop.id,tour:true}):{accepted:false,reason:'导游还未就绪，请稍后重试。'};
            if(result.accepted){journey.select(id);render();note('已准备 '+stop.name+' 的讲解草稿，请确认后发送；不代表已经到访。');}
            else note(result.reason);
            return result;
        }
        function next(event){
            event.stopPropagation();var stop=journey.snapshot().next;
            if(stop)prepare(stop.id);else note('没有下一站。可以重新编排方案或选择其他站。');
        }
        $('journeyNextBtn').addEventListener('click',next);$('chatJourneyNext').addEventListener('click',next);render();
        return {
            replacePlan:function(plan){
                var previous=journey.snapshot();
                try{journey.replace(plan&&plan.stops);}catch(error){note(error.message);return false;}
                if(previous.revision&&callbacks.invalidate)callbacks.invalidate();
                render();note(previous.revision?'方案已更新，请重新选择讲解站；未发送草稿会保留。':'方案只安排讲解顺序，不验证到访位置。');return true;
            },
            prepare:prepare,
            syncSpot:function(id){var current=journey.snapshot().current;if(current&&current.id!==id){journey.clear();render();note('当前聊天已切换景点，需回方案重新选择讲解站。');}},
            clearSelection:function(){journey.clear();render();},snapshot:journey.snapshot
        };
    }
    return {mount:mount};
});
