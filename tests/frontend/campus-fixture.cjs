// REQ-054–059: real campus entry, strict DOM, controlled media and asynchronous boundaries.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {clock, deferred} = require('./chat-fixture.cjs');
const root = path.resolve(__dirname, '../..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/main/resources/campus/catalog.json')));
const response = (data, status = 200) => ({ok: status < 400, status, json: async () => data});
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setImmediate(r)); };
function page(options = {}) {
    const time = clock(), nodes = new Map(), requests = [], images = [], utterances = [], recognitions = [], geo = [], calls = [], watches = [], clearedWatches = [];
    let now = Date.parse('2026-11-09T04:00:00Z'), stops = 0, contextReads = 0;
    class Element {
        constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.events = {}; this.attributes = {}; this.dataset = {}; this.style = {}; this.value = ''; this.hidden = false; this.disabled = false; this._text = ''; this.classes = new Set(); }
        get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
        set textContent(v) { this._text = String(v); this.children = []; }
        get className() { return [...this.classes].join(' '); }
        set className(v) { this.classes = new Set(v.split(/\s+/).filter(Boolean)); }
        get classList() { return {add: x => this.classes.add(x), remove: x => this.classes.delete(x), contains: x => this.classes.has(x), toggle: (x, force) => { const on = force === undefined ? !this.classes.has(x) : force; on ? this.classes.add(x) : this.classes.delete(x); return on; }}; }
        addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
        removeEventListener(type, fn) { this.events[type] = (this.events[type] || []).filter(f => f !== fn); }
        fire(type, event = {}) { for (const fn of this.events[type] || []) fn({preventDefault(){}, target:this, ...event}); }
        appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
        append(...children) { children.forEach(c => this.appendChild(c)); }
        replaceChildren(...children) { this._text = ''; this.children = []; this.append(...children); }
        remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); }
        contains(node) { return node === this || this.children.some(c => c.contains(node)); }
        setAttribute(k,v) { this.attributes[k] = String(v); if (k === 'class') this.className = v; }
        getAttribute(k) { return this.attributes[k] ?? null; }
        removeAttribute(k) { delete this.attributes[k]; }
        focus() { document.activeElement = this; }
        scrollIntoView() {}
    }
    const html = fs.readFileSync(path.join(root, 'src/main/resources/static/campus.html'), 'utf8');
    for (const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const node = new Element(match[1]); node.id = match[3]; node.hidden = /\bhidden\b/.test(match[2]);
        for (const [,key,value] of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) node.setAttribute(key,value);
        nodes.set(node.id,node);
    }
    const documentEvents = new Element(), windowEvents = new Element();
    const document = {hidden:false, body:new Element(), documentElement:new Element(),
        getElementById:id => nodes.get(id) || null, createElement:tag => new Element(tag), createElementNS:(_,tag) => new Element(tag),
        addEventListener:documentEvents.addEventListener.bind(documentEvents)};
    class Image { constructor(){images.push(this);} }
    class Recognition { constructor(){recognitions.push(this);} start(){ if(this.onstart)this.onstart(); } stop(){} abort(){} }
    const voiceEvents = new Element();
    const synthesis = {getVoices:() => options.voices || [{lang:'zh-CN',voiceURI:'test-zh',name:'中文'}], speak:u => utterances.push(u), cancel:() => stops++, addEventListener:voiceEvents.addEventListener.bind(voiceEvents),removeEventListener:voiceEvents.removeEventListener.bind(voiceEvents)};
    function fetch(url, opts = {}) {
        calls.push({url,options:opts});
        if (url === '/api/auth/csrf') return Promise.resolve(response({token:'csrf-test',headerName:'X-XSRF-TOKEN'}));
        if (url === '/api/campus/catalog') return Promise.resolve(response(catalog));
        if (url === '/api/campus/context') return options.contextFetch ? options.contextFetch(contextReads++) : Promise.resolve(response(options.context || {conversationId:'conversation-1',contextRevision:0,campusId:null,placeId:null}));
        if (url === '/api/digital-human-config') return Promise.resolve(response(options.config || {}));
        if (url.startsWith('/api/campus/weather')) return Promise.resolve(response(options.weather || {status:'unavailable',label:'北京市区参考天气'}));
        if (url === '/api/speech/synthesize') return Promise.resolve(response({},401));
        const job = deferred(); requests.push({...job,url,options:opts,body:opts.body ? JSON.parse(opts.body) : {}}); return job.promise;
    }
    class TestDate extends Date { static now(){return now;} }
    const context = vm.createContext({document,fetch,AbortController,URL,Image,Date:TestDate,console,
        setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,
        navigator:{geolocation:{getCurrentPosition:(ok,bad) => geo.push({ok,bad}),
            watchPosition:(ok,bad) => { const watch={ok,bad,id:watches.length};watches.push(watch);return watch.id; },
            clearWatch:id => clearedWatches.push(id)}},
        matchMedia:() => ({matches:!!options.reducedMotion}), SpeechRecognition:Recognition,
        speechSynthesis:synthesis,SpeechSynthesisUtterance:function(text){this.text=text;},Audio:options.Audio || function(){},
        addEventListener:windowEvents.addEventListener.bind(windowEvents),localStorage:{getItem:()=>null,setItem(){}},location:{},
        open:()=>{},requestAnimationFrame:fn=>time.setTimeout(fn,16),cancelAnimationFrame:time.clearTimeout});
    context.window = context;
    for (const [,src] of html.matchAll(/<script\b[^>]*src="(\/js\/[^\"]+)"[^>]*>/g)) {
        const name = src.slice(4).split('?')[0]; vm.runInContext(fs.readFileSync(path.join(root,'src/main/resources/static/js',name),'utf8'),context,{filename:name});
    }
    return {nodes,time,requests,images,utterances,recognitions,geo,calls,context,catalog,watches,clearedWatches,
        get stops(){return stops;}, tick(ms){now+=ms;time.tick(ms);},
        send(text){nodes.get('campusInput').value=text;nodes.get('campusForm').fire('submit');},
        click(id){nodes.get(id).fire('click');}, hide(){document.hidden=true;documentEvents.fire('visibilitychange');},
        show(){document.hidden=false;documentEvents.fire('visibilitychange');},
        pagehide(){windowEvents.fire('pagehide');},
        chats:()=>requests.filter(r=>r.url==='/api/campus/chat')};
}
function turn(revision, placeId = 'pingleyuan-library', extra = {}) {
    return {conversationId:'conversation-1',turnId:'turn-'+revision,contextRevision:revision,reply:'逸夫图书馆可以学习和借还图书。',speech:'图书馆介绍',mode:'local',
        sceneAction:{type:'SHOW_PLACE',placeIds:[placeId]},context:{campusId:'pingleyuan',placeId},
        choices:[{kind:'ask',label:'学习',message:'安静学习'},{kind:'ask',label:'借还',message:'找书借还'},{kind:'followup',label:'继续追问',message:'还有哪些信息'},{kind:'custom',label:'自定义',message:''}],references:[],...extra};
}
module.exports={page,turn,response,flush,deferred};
