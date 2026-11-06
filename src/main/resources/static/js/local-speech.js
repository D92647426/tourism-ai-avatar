// REQ-053 / TEST-053: sentence queue with one prefetch; docs/local_voice_design.md.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GuideLocalSpeech=factory();})(typeof window!=='undefined'?window:globalThis,function(){
    'use strict';
    /** Pure Unicode-aware splitting, preserving content; short chunks bound first-audio latency. */
    function split(text){
        var parts=[],buffer='',length=0;
        Array.from(typeof text==='string'?text.trim():'').forEach(function(char){
            buffer+=char;length++;
            if(/[。！？!?；;\n]/.test(char)||length>=32||(length>=10&&/[，,、]/.test(char))){if(buffer.trim())parts.push(buffer);buffer='';length=0;}
        });
        if(buffer.trim())parts.push(buffer);return parts;
    }
    /** Create an injectable media engine. speak(text,settings,hooks)->idempotent cancel.
     * hooks start/pause/wait/end/fallback(unfinished text)/error(code) use genuine events.
     * Errors never expose HTTP bodies. Change queue policy here; docs/local_voice_design.md. */
    function create(options){
        options=options||{};
        return {speak:function(text,settings,hooks){
            settings=settings||{};hooks=hooks||{};
            var parts=split(text),stopped=false,current=null,controller=options.AbortController?new options.AbortController():null;
            var url=null,AudioCtor=options.Audio,urls=options.URL;
            function valid(audio){return !stopped&&current===audio;}
            function release(){
                if(current){current.onplaying=current.onpause=current.onended=current.onerror=current.onwaiting=null;try{current.pause();if(current.removeAttribute)current.removeAttribute('src');else current.src='';current.load();}catch(e){}current=null;}
                if(url){try{urls.revokeObjectURL(url);}catch(e){}url=null;}
            }
            function cancel(){if(stopped)return;stopped=true;if(controller)controller.abort();release();}
            function fail(index,error){
                if(stopped)return;
                cancel();
                if(error&&error.name==='NotAllowedError'){if(hooks.error)hooks.error('playback-blocked');}
                else if(hooks.fallback)hooks.fallback(parts.slice(index).join(''));
            }
            function request(index){
                if(index>=parts.length)return null;
                return Promise.resolve().then(function(){
                    if(stopped)throw Error('cancelled');
                    return options.fetch('/api/speech/synthesize',{method:'POST',headers:{'Content-Type':'application/json'},
                        body:JSON.stringify({text:parts[index],speed:settings.speechRate||1}),signal:controller?controller.signal:undefined});
                }).then(function(response){if(!response.ok)throw Error('unavailable');return response.blob();})
                  .then(function(blob){if(!blob.size||blob.size>4*1024*1024)throw Error('invalid-audio');return {blob:blob};})
                  .catch(function(error){return {error:error};}); // prefetch failures are always observed
            }
            async function play(index,pending){
                var result=await pending;if(stopped)return;
                if(result.error)return fail(index,result.error);
                var next=request(index+1),audio;
                try{
                    url=urls.createObjectURL(result.blob);audio=new AudioCtor();current=audio;audio.src=url;
                    audio.volume=Number.isFinite(settings.volume)?settings.volume:1;audio.preload='auto';
                    audio.onplaying=function(){if(valid(audio)&&hooks.start)hooks.start();};
                    audio.onpause=function(){if(valid(audio)&&hooks.pause)hooks.pause();};
                    audio.onwaiting=function(){if(valid(audio)&&hooks.wait)hooks.wait();};
                    audio.onerror=function(event){if(valid(audio))fail(index,event&&event.error);};
                    audio.onended=function(){
                        if(!valid(audio))return;release();
                        if(index+1===parts.length){cancel();if(hooks.end)hooks.end();}
                        else{if(hooks.wait)hooks.wait();play(index+1,next);}
                    };
                    var started=audio.play();if(started&&started.catch)started.catch(function(error){if(valid(audio))fail(index,error);});
                }catch(error){fail(index,error);}
            }
            Promise.resolve().then(function(){
                if(stopped)return;
                if(!parts.length){cancel();if(hooks.end)hooks.end();return;}
                if(!AudioCtor||!urls||!options.fetch||!controller)return fail(0);
                play(0,request(0));
            });
            return cancel;
        }};
    }
    return {create:create,split:split};
});
