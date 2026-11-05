/* REQ-043: page adapter; inputs stay local. See docs/director_design.md. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GuideDirectorPage=factory();})(typeof window!=='undefined'?window:globalThis,function(){
    'use strict';
    /** REQ-043: bind one loaded page to API spots; inputs window and spot array, output void.
     * Preference errors become visible status; no routine exception. docs/director_design.md#L3. */
    function mount(win,spots){
        var doc=win.document,$=function(id){return doc.getElementById(id);};
        if(!$('directorForm')||!win.GuideDirector)return;
        var base,current;
        function note(message){$('directorStatus').textContent=message;}
        function element(tag,text,cls){var node=doc.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;}
        function draw(next,label,options){
            var diff=win.GuideDirector.difference(current,next),list=$('directorStops');list.replaceChildren();
            next.stops.forEach(function(stop,index){
                var row=element('li','');row.appendChild(element('span',String(index+1).padStart(2,'0'),'director-order'));
                var body=element('div','','director-stop-body');body.appendChild(element('h3',stop.name));body.appendChild(element('p',stop.reason));body.appendChild(element('p',stop.prompt,'director-prompt'));row.appendChild(body);
                var actions=element('div','','director-stop-actions');actions.appendChild(element('span',next.themeId?'主题讲解站点':'估算停留 '+stop.minutes+' 分钟'));
                var observe=element('button','去观察');observe.type='button';observe.addEventListener('click',function(){
                    var result=typeof win.GuideExploreSpot==='function'?win.GuideExploreSpot(stop.name):{accepted:false,reason:'观察手册还未就绪，请稍后重试。'};
                    note(result.accepted?'已打开 '+stop.name+' 的观察任务。':result.reason);
                });actions.appendChild(observe);
                var ask=element('button','准备本站讲解');ask.type='button';ask.addEventListener('click',function(event){
                    event.stopPropagation(); // Opening chat must not trigger its document click-away handler.
                    var result=win.GuideTour?win.GuideTour.prepare(stop.id):{accepted:false,reason:'导游还未就绪，请稍后重试。'};
                    note(result.accepted?'问题已放入聊天草稿，请确认后发送。':result.reason);
                });actions.appendChild(ask);row.appendChild(actions);list.appendChild(row);
            });
            $('directorSummary').textContent=next.themeId?label+' · '+next.stops.length+' 站主题讲解顺序':label+' · '+next.stops.length+' 站，估算停留 '+next.total+' / '+options.minutes+' 分钟';
            $('directorNotice').textContent=next.notice;
            $('directorEmpty').hidden=next.stops.length>0;
            if(next.themeId)note('围绕一个问题串起三站。选择本站准备讲解，确认后发送。');
            else if(current)note('相比上一版，保留：'+(diff.kept.join('、')||'无')+'；移除：'+(diff.removed.join('、')||'无')+'。'+(options.weather==='rain'?'已按雨天情境筛选室内候选。':'已按时间和偏好重新编排。'));
            else note('方案已生成。你可以重编排，或从任一站准备讲解。');
            current=next;
            if(win.GuideTour)win.GuideTour.replacePlan(next);
        }
        function render(options,label){
            var next;try{next=win.GuideDirector.plan(options,spots);}catch(error){note(error.message);return;}
            draw(next,label,options);
        }
        function read(){return {minutes:Number($('directorTime').value),party:$('directorParty').value,interest:$('directorInterest').value,weather:'fair'};}
        $('directorForm').addEventListener('submit',function(e){e.preventDefault();base=read();render(base,'我的游览方案');});
        $('directorHalf').addEventListener('click',function(){if(base)render(Object.assign({},base,{minutes:Math.max(15,Math.floor(base.minutes/2))}),'时间减半版');});
        $('directorRain').addEventListener('click',function(){if(base)render(Object.assign({},base,{weather:'rain'}),'雨天备选版');});
        $('directorRestore').addEventListener('click',function(){if(base)render(base,'原始方案');});
        ['directorGenerate','directorHalf','directorRain','directorRestore'].forEach(function(id){$(id).disabled=false;});
        base=read();render(base,'我的游览方案');
        return {showTheme:function(theme){
            var plan={themeId:theme.id,notice:theme.notice,stops:theme.stops.map(function(stop){return {id:stop.spotId,name:stop.name,reason:stop.focus,prompt:stop.question+' '+stop.bridge};})};
            draw(plan,'主题线 · '+theme.title,null);
        }};
    }
    return {mount:mount};
});
