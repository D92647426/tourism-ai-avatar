'use strict';

// 前端行为测试的极简 DOM/浏览器环境（Node 内置 vm，不依赖浏览器或第三方库）。
// 目标：真实执行 src/main/resources/static/js 下的脚本，验证认证相关交互。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const STATIC_JS = path.resolve(__dirname, '..', '..', 'src', 'main', 'resources', 'static', 'js');

class Element {
    get textContent() { return this._textContent; }
    set textContent(value) {
        this._textContent = String(value);
        this.innerHTML = this._textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    constructor(id, dataset, classes) {
        this.id = id || '';
        this.tagName = 'DIV';
        this.dataset = Object.assign({}, dataset);
        this.style = {};
        this.style.setProperty = function(name, value) { this[name] = value; };
        this.textContent = '';
        this.innerHTML = '';
        this.value = '';
        this.disabled = false;
        this.width = 0;
        this.height = 0;
        this.parentElement = null;
        this.children = [];
        this._classes = new Set(classes || []);
        this._handlers = {};
        this._query = null;
        this._queryAll = null;
    }

    get classList() {
        const self = this;
        return {
            add(name) { self._classes.add(name); },
            remove(name) { self._classes.delete(name); },
            contains(name) { return self._classes.has(name); },
            toggle(name) { self._classes.has(name) ? self._classes.delete(name) : self._classes.add(name); }
        };
    }

    addEventListener(type, handler) {
        (this._handlers[type] = this._handlers[type] || []).push(handler);
    }

    dispatch(type, event) {
        (this._handlers[type] || []).forEach((handler) => handler.call(this, event || {}));
    }

    dispatchAll(type, event) {
        (this._handlers[type] || []).slice().forEach((handler) => handler.call(this, event || {}));
    }

    appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
    }

    replaceChildren(...children) { this.children = []; children.forEach(child => this.appendChild(child)); }

    remove() { }

    contains() { return false; }

    matches(selector) {
        if (selector && selector.startsWith('.')) {
            return this._classes.has(selector.slice(1));
        }
        return false;
    }

    closest(selector) {
        return this.matches(selector) ? this : null;
    }

    querySelector(selector) {
        return this._query ? this._query(selector) : null;
    }

    querySelectorAll(selector) {
        return this._queryAll ? this._queryAll(selector) : [];
    }

    setAttribute(k,v) { this[k]=v; }
    getContext() {
        const noop = () => { };
        return {
            fillStyle: '', strokeStyle: '', lineWidth: 1,
            beginPath: noop, arc: noop, fill: noop, stroke: noop,
            moveTo: noop, lineTo: noop
        };
    }

    getBoundingClientRect() {
        return { width: 380, height: 500, top: 0, left: 0 };
    }

    focus() { }
}

function createDocument() {
    const map = new Map();
    const doc = {
        head: new Element('head'),
        body: new Element('body'),
        documentElement: new Element('html'),
        _elements: map,
        getElementById(id) {
            if (!map.has(id)) {
                map.set(id, new Element(id));
            }
            return map.get(id);
        },
        createElement(tag) {
            const element = new Element('');
            element.tagName = String(tag).toUpperCase();
            return element;
        },
        querySelector(selector) {
            const single = doc._selectors || {};
            if (Object.prototype.hasOwnProperty.call(single, selector)) {
                const value = single[selector];
                return typeof value === 'function' ? value() : value;
            }
            return null;
        },
        querySelectorAll(selector) {
            const many = doc._selectorsAll || {};
            if (Object.prototype.hasOwnProperty.call(many, selector)) {
                const value = many[selector];
                return typeof value === 'function' ? value() : value;
            }
            return [];
        },
        addEventListener() { },
        _selectors: {},
        _selectorsAll: {}
    };
    return doc;
}

function response(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
    };
}

/**
 * 创建可执行前端脚本的沙箱。
 *
 * @param {{fetch?: Function, selectors?: Object, selectorsAll?: Object,
 *          elements?: Object<string, {dataset?: Object, classes?: string[]}>}} options
 * @returns {object} 沙箱环境（含 document/localStorage/location/window/fetchCalls 等）
 */
function createEnv(options) {
    const opts = options || {};
    const doc = createDocument();
    Object.assign(doc._selectors, opts.selectors || {});
    Object.assign(doc._selectorsAll, opts.selectorsAll || {});
    Object.entries(opts.elements || {}).forEach(([id, spec]) => {
        doc._elements.set(id, new Element(id, spec && spec.dataset, spec && spec.classes));
    });

    const storage = new Map(Object.entries(opts.storage || {}));
    const fetchCalls = [];
    const fetchImpl = opts.fetch || (() => response(404, {}));
    const env = {
        document: doc,
        location: { href: '' },
        console: { log() { }, warn() { }, error() { } },
        localStorage: {
            getItem(key) { return storage.has(key) ? storage.get(key) : null; },
            setItem(key, value) { storage.set(key, String(value)); },
            removeItem(key) { storage.delete(key); },
            clear() { storage.clear(); },
            _data: storage
        },
        setTimeout() { return 0; },
        clearTimeout() { },
        setInterval() { return 0; },
        clearInterval() { },
        echarts: { init: () => ({ setOption() { }, resize() { }, dispose() { } }) },
        addEventListener() { },
        removeEventListener() { },
        fetch(url, fetchOptions) {
            const call = { url: String(url), options: fetchOptions || {} };
            fetchCalls.push(call);
            return Promise.resolve().then(() => fetchImpl(call.url, call.options));
        },
        fetchCalls
    };
    env.window = env;
    env._context = vm.createContext(env);
    return env;
}

function loadScript(env, filename) {
    if (filename === 'main.js') {
        if (!env.GuideChatRequest) loadScript(env,'chat-request.js');
        if (!env.GuideJourney) loadScript(env,'journey-core.js');
        if (!env.GuideJourneyPage) loadScript(env,'journey.js');
        if (!env.GuideChatReferences) loadScript(env,'chat-references.js');
        if (!env.GuideChatFollowups) loadScript(env,'chat-followups.js');
        if (!env.GuideSpeech) loadScript(env,'speech-lifecycle.js');
        if (!env.GuideDisplayConfig) loadScript(env,'display-config.js');
    }
    if (filename === 'admin.js' && !env.AdminStats) loadScript(env,'admin-stats.js');
    if ((filename === 'main.js' || filename === 'admin.js') && !env.GuideVoiceSettings) loadScript(env,'voice-settings.js');
    const file = path.join(STATIC_JS, filename);
    const code = fs.readFileSync(file, 'utf8');
    vm.runInContext(code, env._context, { filename: file });
}

async function flush(env) {
    for (let i = 0; i < 8; i++) {
        await new Promise((resolve) => setImmediate(resolve));
    }
}

module.exports = { Element, createEnv, loadScript, flush, response };
