// REQ-036: explicitly controlled browser speech mock; never shipped in static/.
// Load with agent-browser --init-script ONLY against an isolated local preview.
// No sound is produced. State screenshots verify event wiring, not audio quality.
(function() {
    if (location.hostname !== '127.0.0.1') return;
    localStorage.setItem('userId', 'isolated-speech-demo');
    localStorage.setItem('username', '语音状态演示');
    var voices = [{ lang: 'zh-CN', name: 'Controlled mock (silent)', voiceURI: 'silent-demo', default: true }];
    var utterances = [], events = new EventTarget();
    var synthesis = {
        getVoices: function() { return voices.slice(); },
        speak: function(u) { utterances.push(u); },
        cancel: function() {},
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events)
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true, value: function(text) { this.text = text; }
    });
    window.__speechDemo = {
        lastText: function() { return utterances.length ? utterances[utterances.length - 1].text : ''; },
        start: function() { var u = utterances[utterances.length - 1]; if (u && u.onstart) u.onstart(); },
        end: function() { var u = utterances[utterances.length - 1]; if (u && u.onend) u.onend(); },
        setVoices: function(next) { voices = next; events.dispatchEvent(new Event('voiceschanged')); }
    };
})();
