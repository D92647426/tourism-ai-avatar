const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
function deferred() {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
}
function clock() {
    let now = 0, next = 0;
    const timers = new Map();
    return {
        setTimeout(fn, ms) { const id = ++next; timers.set(id, { at: now + ms, fn }); return id; },
        clearTimeout(id) { timers.delete(id); },
        tick(ms) {
            const end = now + ms;
            for (;;) {
                const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) break;
                timers.delete(due[0]); now = due[1].at; due[1].fn();
            }
            now = end;
        },
        get size() { return timers.size; }
    };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const response = data => ({ ok: true, json: async () => data });

// Minimal DOM/voice/network boundary: execute the actual main.js unchanged.
function page(options = {}) {
    const time = clock(), nodes = new Map(), requests = [], spoken = [], recognitions = [];
    let stops = 0;
    class Element {
        constructor() {
            this.children = []; this.events = {}; this.style = {}; this.dataset = {}; this.attributes = {};
            this.value = ''; this.textContent = ''; this.disabled = false; this.hidden = false;
            const classes = new Set();
            this.classList = { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) };
        }
        addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
        fire(type, event = {}) { for (const fn of this.events[type] || []) fn({ preventDefault() {}, stopPropagation() {}, ...event }); }
        appendChild(node) { node.parent = this; this.children.push(node); return node; }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
        setAttribute(k, v) { this.attributes[k] = v; }
        querySelectorAll() { return this.buttons || []; }
        querySelector() { return null; }
        getBoundingClientRect() { return { width: 380, height: 500 }; }
        getContext() { return null; }
        contains(node) { return node === this || this.children.some(x => x.contains(node)); }
        focus() {}
        set innerHTML(html) { this.html = html; this.children = []; }
        get innerHTML() { return this.html || this.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    }
    const html = fs.readFileSync(path.join(root, 'src/main/resources/static/index.html'), 'utf8');
    for (const match of html.matchAll(/id="([^"]+)"/g)) nodes.set(match[1], new Element());
    const find = (node, id) => node.id === id ? node : node.children.map(n => find(n, id)).find(Boolean);
    const documentEvents = new Element(), windowEvents = new Element();
    const document = {
        getElementById(id) { return nodes.get(id) || [...nodes.values()].map(n => find(n, id)).find(Boolean) || null; },
        createElement: () => new Element(), querySelector: () => null,
        body: new Element(), head: new Element(), hidden: false,
        addEventListener: documentEvents.addEventListener.bind(documentEvents)
    };
    const quick = new Element(); quick.dataset.msg = 'quick question'; quick.closest = () => quick;
    nodes.get('quickActions').buttons = [quick];
    class Recognition { constructor() { recognitions.push(this); } start() { if (!options.manualRecognition && this.onstart) this.onstart(); } stop() {} }
    const utterances = [], voiceEvents = new Element();
    let voices = options.voices || [{ lang: 'zh-CN' }];
    const synthesis = { getVoices: () => voices, speak: u => { spoken.push(u.text); utterances.push(u); }, cancel: () => { stops++; },
        addEventListener: voiceEvents.addEventListener.bind(voiceEvents),
        removeEventListener: (type, fn) => { voiceEvents.events[type] = (voiceEvents.events[type] || []).filter(x => x !== fn); } };
    function fetch(url, options) {
        if (url !== '/api/chat') return Promise.resolve(response(url === '/api/spots' ? [] : {}));
        const job = deferred(); requests.push({ ...job, options, body: JSON.parse(options.body) }); return job.promise;
    }
    const localStorage = { getItem: key => key === 'interest' ? 'history' : 'demo-user', setItem() {}, removeItem() {} };
    const context = vm.createContext({ document, localStorage, fetch, AbortController, console: { log() {}, error() {} },
        setTimeout: time.setTimeout, clearTimeout: time.clearTimeout, SpeechRecognition: Recognition,
        speechSynthesis: synthesis, SpeechSynthesisUtterance: function(text) { this.text = text; },
        AndroidSpeech: options.bridge,
        addEventListener: windowEvents.addEventListener.bind(windowEvents),
        location: {}, requestAnimationFrame: fn => time.setTimeout(fn, 16), cancelAnimationFrame: time.clearTimeout });
    context.window = context;
    for (const name of ['chat-request.js', 'speech-lifecycle.js', 'main.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'src/main/resources/static/js', name), 'utf8'), context, { filename: name });
    }
    return { time, nodes, requests, spoken, utterances, synthesis, context, quick, recognitions,
        voicesChanged(next) { voices = next; voiceEvents.fire('voiceschanged'); },
        hide() { document.hidden = true; documentEvents.fire('visibilitychange'); },
        pagehide() { windowEvents.fire('pagehide'); },
        startNative() {
            context.AndroidSpeech = { startListening() {}, stopListening() {}, isTtsReady: () => false };
            nodes.get('voiceBtn').fire('click'); context.onSpeechStart();
        },
        get stops() { return stops; },
        typing: () => nodes.get('chatMessages').children.filter(x => x.id === 'typingIndicator'),
        send(text) { nodes.get('chatInput').value = text; nodes.get('chatSendBtn').fire('click'); }
    };
}
module.exports = { deferred, clock, flush, response, page };
