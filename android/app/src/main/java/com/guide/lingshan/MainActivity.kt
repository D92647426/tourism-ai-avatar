package com.guide.lingshan

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.guide.lingshan.databinding.ActivityMainBinding
import java.util.Locale
import java.util.UUID
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false
    private var tts: TextToSpeech? = null

    /**
     * 当前 TTS 任务 ID（协议 2 的 gs-*，或旧网页兼容的 legacy-*）。
     * 只在主线程改写；JS 线程通过 @Volatile 读取可见。REQ-036 / docs/speech_lifecycle.md API-036。
     */
    @Volatile
    private var activeTtsId: String? = null

    /**
     * TTS 就绪状态：仅 setLanguage 返回 LANG_AVAILABLE(0)/LANG_COUNTRY_AVAILABLE(1)/
     * LANG_COUNTRY_VAR_AVAILABLE(2) 之一后才为 true，null/ERROR/负值不算成功。
     */
    @Volatile
    private var ttsReady = false

    /** 页面是否仍可安全执行 evaluateJavascript；onDestroy 先置 false，避免 destroy 后回调。 */
    @Volatile
    private var pageAlive = true

    /** 全局只安装一个 UtteranceProgressListener，按真实 uttId 转发回调。 */
    private var ttsListenerInstalled = false

    companion object {
        private const val TTS_PROTOCOL_VERSION = 2
        private const val LEGACY_UTTERANCE_PREFIX = "legacy-"
    }

    private val requestPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                startNativeRecognition()
            } else {
                sendToJs("if(window.onSpeechError)window.onSpeechError('permission-denied')")
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        )

        setupWebView()
        initTts()
        loadUrl()
    }

    @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
    private fun setupWebView() {
        binding.webView.apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                cacheMode = WebSettings.LOAD_NO_CACHE
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                mediaPlaybackRequiresUserGesture = false
                allowUniversalAccessFromFileURLs = true
                allowFileAccessFromFileURLs = true
            }

            setLayerType(View.LAYER_TYPE_HARDWARE, null)

            // 注入原生语音识别接口
            addJavascriptInterface(AndroidSpeechBridge(), "AndroidSpeech")

            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(msg: ConsoleMessage?): Boolean {
                    msg?.let { Log.d("WEBVIEW_JS", "[${it.messageLevel()}] ${it.message()}") }
                    return true
                }
                override fun onReceivedTitle(view: WebView?, title: String?) {
                    binding.titleBar.text = title ?: getString(R.string.app_name)
                }
            }

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    binding.progressBar.visibility = View.GONE
                    view?.evaluateJavascript("""
                        (function(){
                            var canvas = document.createElement('canvas');
                            var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                            var msg = [];
                            msg.push('WebGL: ' + (gl ? 'OK' : 'FAIL'));
                            msg.push('PIXI: ' + (typeof PIXI !== 'undefined' ? PIXI.VERSION : 'MISSING'));
                            msg.push('Live2D: ' + (typeof PIXI !== 'undefined' && PIXI.live2d ? 'OK' : 'MISSING'));
                            console.log('=== DIAG === ' + msg.join(' | '));
                        })();
                    """.trimIndent(), null)
                }
            }
        }

        binding.btnSettings.setOnClickListener { showUrlDialog() }
    }

    // ===== 语音识别超时 =====
    private val recognizerTimeout = android.os.Handler(android.os.Looper.getMainLooper())
    private var timeoutRunnable: Runnable? = null

    private fun startRecognitionTimeout() {
        stopRecognitionTimeout()
        timeoutRunnable = Runnable {
            Log.w("SPEECH", "Recognition timeout")
            stopNativeRecognition()
            sendToJs("if(window.onSpeechError)window.onSpeechError('timeout')")
        }
        recognizerTimeout.postDelayed(timeoutRunnable!!, 10000)
    }

    private fun stopRecognitionTimeout() {
        timeoutRunnable?.let { recognizerTimeout.removeCallbacks(it) }
        timeoutRunnable = null
    }

    /**
     * 初始化原生 TTS。REQ-036 / docs/speech_lifecycle.md API-036：
     * setLanguage 返回 0(LANG_AVAILABLE/SUCCESS)、LANG_COUNTRY_AVAILABLE(1)、
     * LANG_COUNTRY_VAR_AVAILABLE(2) 都代表中文声线可用；null/ERROR/负值才算失败。
     * 语速/pitch 保持旧默认值（rate 1.0、pitch 1.1）。
     */
    private fun initTts() {
        tts = TextToSpeech(this) { status ->
            runOnUiThread {
                val engine = tts
                if (!pageAlive) return@runOnUiThread
                if (status == TextToSpeech.SUCCESS && engine != null) {
                    val langResult: Int? = engine.setLanguage(Locale.CHINESE)
                    ttsReady = langResult != null && isLanguageAvailable(langResult)
                    engine.setSpeechRate(1.0f)
                    engine.setPitch(1.1f)
                    installTtsListener()
                    Log.d("SPEECH", "TTS init: ready=$ttsReady, langResult=$langResult")
                    sendToJs("if(window.onTtsReady)window.onTtsReady($ttsReady)")
                } else {
                    ttsReady = false
                    Log.e("SPEECH", "TTS init failed: $status")
                    sendToJs("if(window.onTtsReady)window.onTtsReady(false)")
                }
            }
        }
    }

    /**
     * REQ-036 / docs/speech_lifecycle.md API-036：setLanguage 的可用返回值是
     * LANG_AVAILABLE(0)、LANG_COUNTRY_AVAILABLE(1)、LANG_COUNTRY_VAR_AVAILABLE(2)，
     * 不能只比较 SUCCESS；null/ERROR/负值（LANG_MISSING_DATA/LANG_NOT_SUPPORTED）不可用。
     */
    private fun isLanguageAvailable(result: Int): Boolean =
        result == TextToSpeech.LANG_AVAILABLE ||
            result == TextToSpeech.LANG_COUNTRY_AVAILABLE ||
            result == TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE

    // ===== 原生语音识别 JS 桥接 =====

    inner class AndroidSpeechBridge {
        @JavascriptInterface
        fun startListening() {
            Log.d("SPEECH", "JS -> startListening()")
            runOnUiThread {
                // 先彻底停止旧的识别器，避免华为 "already in progress" 错误
                stopNativeRecognition()

                val perm = ContextCompat.checkSelfPermission(
                    this@MainActivity, Manifest.permission.RECORD_AUDIO
                )
                Log.d("SPEECH", "RECORD_AUDIO permission: ${if (perm == PackageManager.PERMISSION_GRANTED) "GRANTED" else "DENIED"}")

                if (perm != PackageManager.PERMISSION_GRANTED) {
                    Log.d("SPEECH", "Requesting permission...")
                    requestPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                } else {
                    startNativeRecognition()
                }
            }
        }

        @JavascriptInterface
        fun stopListening() {
            Log.d("SPEECH", "JS -> stopListening()")
            runOnUiThread { stopNativeRecognition() }
        }

        @JavascriptInterface
        fun isAvailable(): Boolean {
            val available = SpeechRecognizer.isRecognitionAvailable(this@MainActivity)
            Log.d("SPEECH", "isAvailable: $available")
            return available
        }

        // ===== 原生 TTS（REQ-036 / docs/speech_lifecycle.md API-036）=====

        /**
         * TTS 桥协议版本。REQ-036 API-036：返回 2 表示支持 speakWithId 和带任务 ID 的回调。
         */
        @JavascriptInterface
        fun getTtsProtocolVersion(): Int = TTS_PROTOCOL_VERSION

        /**
         * 旧网页兼容入口（无任务 ID）。REQ-036 API-036：仍可播报，但不提供竞态隔离；
         * 以 legacy-<UUID> 作为真实 utteranceId，回调降级为旧的无 ID 形式。
         */
        @JavascriptInterface
        fun speak(text: String) {
            Log.d("SPEECH", "JS -> TTS speak(legacy): ${text.take(30)}...")
            runOnUiThread {
                if (!pageAlive) return@runOnUiThread
                speakOnMain(text, LEGACY_UTTERANCE_PREFIX + UUID.randomUUID().toString())
            }
        }

        /**
         * 协议 2 播报入口。REQ-036 API-036：id 由网页生成（gs-页面nonce-序号），
         * 回调 onTtsStart(id)/onTtsEnd(id)/onTtsError(error,id)/onTtsStop(id) 都使用同一 id。
         */
        @JavascriptInterface
        fun speakWithId(text: String, id: String) {
            Log.d("SPEECH", "JS -> TTS speakWithId: ${id.take(64)}")
            runOnUiThread {
                if (!pageAlive) return@runOnUiThread
                speakOnMain(text, id)
            }
        }

        /**
         * 停止当前播报。REQ-036 API-036：先快照并隔离 active id 再调用 tts.stop()，
         * 避免引擎同步 onStop 回调污染新状态；协议 2 网页收到带 id 的 onTtsStop。
         */
        @JavascriptInterface
        fun stopSpeaking() {
            Log.d("SPEECH", "JS -> TTS stopSpeaking()")
            runOnUiThread { stopCurrentSpeech(notifyStopped = pageAlive) }
        }

        /**
         * TTS 就绪查询。REQ-036 API-036：@Volatile 布尔值，JS 线程可见；
         * setLanguage 返回 LANG_AVAILABLE/LANG_COUNTRY_AVAILABLE/LANG_COUNTRY_VAR_AVAILABLE 之一才为 true。
         */
        @JavascriptInterface
        fun isTtsReady(): Boolean = ttsReady
    }

    private fun sendToJs(js: String) {
        // REQ-036：activity 销毁后 WebView 可能已不可用，禁止再 evaluateJavascript。
        if (!pageAlive) return
        Log.d("SPEECH", "sendToJs: $js")
        binding.webView.post {
            if (!pageAlive) return@post
            binding.webView.evaluateJavascript(js, null)
        }
    }

    // ===== TTS 生命周期辅助（REQ-036 / docs/speech_lifecycle.md API-036）=====

    /** 全局只安装一个 UtteranceProgressListener，按回调真实 uttId 路由，避免每次 speak 替换监听器。 */
    private fun installTtsListener() {
        if (ttsListenerInstalled) return
        val engine = tts ?: return
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                dispatchTtsEvent("start", utteranceId, null)
            }

            override fun onDone(utteranceId: String?) {
                dispatchTtsEvent("end", utteranceId, null)
            }

            override fun onStop(utteranceId: String?, interrupted: Boolean) {
                dispatchTtsEvent("stop", utteranceId, null)
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                dispatchTtsEvent("error", utteranceId, "playback-error")
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?, errorCode: Int) {
                dispatchTtsEvent("error", utteranceId, "error-$errorCode")
            }
        })
        ttsListenerInstalled = true
    }

    /**
     * 在主线程串行处理 TTS 回调。REQ-036：只转发属于当前 activeTtsId 的事件，
     * 旧任务/旧网页的迟到回调不得清掉新任务的 active ID 或改变嘴型。
     */
    private fun dispatchTtsEvent(kind: String, utteranceId: String?, error: String?) {
        runOnUiThread {
            if (!pageAlive) return@runOnUiThread
            if (utteranceId == null) {
                // 个别引擎不回调 ID：仅对 legacy 任务保留旧的无 ID 回调，绝不污染 gs-* 任务。
                val current = activeTtsId ?: return@runOnUiThread
                if (!isLegacyUtterance(current)) return@runOnUiThread
                if (kind != "start") activeTtsId = null
                when (kind) {
                    "start" -> sendTtsStart(null, true)
                    "end" -> sendTtsEnd(null, true)
                    "error" -> sendTtsError(error ?: "playback-error", null, true)
                    // 旧网页没有 onTtsStop 回调，stop 不转发。
                }
                return@runOnUiThread
            }
            if (utteranceId != activeTtsId) return@runOnUiThread
            val legacy = isLegacyUtterance(utteranceId)
            when (kind) {
                "start" -> sendTtsStart(utteranceId, legacy)
                "end" -> {
                    activeTtsId = null
                    sendTtsEnd(utteranceId, legacy)
                }
                "stop" -> {
                    activeTtsId = null
                    if (!legacy) sendTtsStop(utteranceId)
                }
                "error" -> {
                    activeTtsId = null
                    sendTtsError(error ?: "playback-error", utteranceId, legacy)
                }
            }
        }
    }

    private fun isLegacyUtterance(id: String): Boolean = id.startsWith(LEGACY_UTTERANCE_PREFIX)

    // 协议 2 回调全部用 JSONObject.quote 编码字符串实参，防止 ID/错误文本注入 JS。

    private fun sendTtsStart(id: String?, legacy: Boolean) {
        if (legacy) {
            sendToJs("if(window.onTtsStart)window.onTtsStart()")
        } else if (id != null) {
            sendToJs("if(window.onTtsStart)window.onTtsStart(${JSONObject.quote(id)})")
        }
    }

    private fun sendTtsEnd(id: String?, legacy: Boolean) {
        if (legacy) {
            sendToJs("if(window.onTtsEnd)window.onTtsEnd()")
        } else if (id != null) {
            sendToJs("if(window.onTtsEnd)window.onTtsEnd(${JSONObject.quote(id)})")
        }
    }

    private fun sendTtsStop(id: String) {
        sendToJs("if(window.onTtsStop)window.onTtsStop(${JSONObject.quote(id)})")
    }

    private fun sendTtsError(error: String, id: String?, legacy: Boolean) {
        if (legacy) {
            sendToJs("if(window.onTtsError)window.onTtsError(${JSONObject.quote(error)})")
        } else if (id != null) {
            sendToJs(
                "if(window.onTtsError)window.onTtsError(${JSONObject.quote(error)}, ${JSONObject.quote(id)})"
            )
        }
    }

    /** 主线程提交播报：先停旧任务，再登记新 activeTtsId；引擎返回 ERROR 时立即报告失败。 */
    private fun speakOnMain(text: String, utteranceId: String) {
        val engine = tts
        // 新播报先停旧任务，避免上一段音频残留；旧 ID 已先隔离，迟到回调不会污染新任务。
        stopCurrentSpeech(notifyStopped = true)
        if (engine == null || !ttsReady) {
            Log.w("SPEECH", "TTS not ready, reject utterance: $utteranceId")
            sendTtsError("not-ready", utteranceId, isLegacyUtterance(utteranceId))
            return
        }
        installTtsListener()
        activeTtsId = utteranceId
        // REQ-036：引擎可能在主线程抛 RuntimeException，不能炸到页面；清匹配 ID 并按错误上报。
        val result = try {
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
        } catch (e: RuntimeException) {
            Log.w("SPEECH", "TTS speak threw: ${e.javaClass.simpleName}", e)
            if (activeTtsId == utteranceId) activeTtsId = null
            sendTtsError("speak-failed", utteranceId, isLegacyUtterance(utteranceId))
            return
        }
        if (result == TextToSpeech.ERROR) {
            if (activeTtsId == utteranceId) activeTtsId = null
            sendTtsError("speak-failed", utteranceId, isLegacyUtterance(utteranceId))
        }
    }

    /** 停止播报：先隔离 active id 再调用引擎 stop，旧回调无法改写新任务；协议 2 通知带 ID 的 stop。 */
    private fun stopCurrentSpeech(notifyStopped: Boolean) {
        val stoppedId = activeTtsId
        activeTtsId = null
        // REQ-036：stop 抛 RuntimeException 也不能阻断生命周期收尾，仍按快照 ID 通知网页。
        try {
            tts?.stop()
        } catch (e: RuntimeException) {
            Log.w("SPEECH", "TTS stop threw: ${e.javaClass.simpleName}", e)
        }
        if (notifyStopped && stoppedId != null && !isLegacyUtterance(stoppedId)) {
            sendTtsStop(stoppedId)
        }
    }

    private fun startNativeRecognition() {
        if (isListening) {
            Log.d("SPEECH", "Already listening, skip")
            return
        }

        val available = SpeechRecognizer.isRecognitionAvailable(this)
        Log.d("SPEECH", "isRecognitionAvailable: $available")

        if (!available) {
            sendToJs("if(window.onSpeechError)window.onSpeechError('not-available')")
            return
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
        Log.d("SPEECH", "SpeechRecognizer created")

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                isListening = true
                Log.d("SPEECH", "onReadyForSpeech")
                sendToJs("if(window.onSpeechStart)window.onSpeechStart()")
            }

            override fun onBeginningOfSpeech() {
                Log.d("SPEECH", "onBeginningOfSpeech")
            }

            override fun onRmsChanged(rmsdB: Float) {}

            override fun onBufferReceived(buffer: ByteArray?) {}

            override fun onEndOfSpeech() {
                isListening = false
                Log.d("SPEECH", "onEndOfSpeech")
            }

            override fun onError(error: Int) {
                isListening = false
                stopRecognitionTimeout()
                Log.e("SPEECH", "onError: $error")
                val errMsg = when (error) {
                    SpeechRecognizer.ERROR_NETWORK -> "network"
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network"
                    SpeechRecognizer.ERROR_NO_MATCH -> "no-match"
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no-speech"
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "permission-denied"
                    else -> "unknown"
                }
                sendToJs("if(window.onSpeechError)window.onSpeechError('$errMsg')")
                speechRecognizer?.destroy()
                speechRecognizer = null
            }

            override fun onResults(results: Bundle?) {
                isListening = false
                stopRecognitionTimeout()
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: ""
                val escaped = text.replace("\\", "\\\\").replace("'", "\\'")
                sendToJs("if(window.onSpeechResult)window.onSpeechResult('$escaped')")
                speechRecognizer?.destroy()
                speechRecognizer = null
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: ""
                val escaped = text.replace("\\", "\\\\").replace("'", "\\'")
                sendToJs("if(window.onSpeechPartial)window.onSpeechPartial('$escaped')")
            }

            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        speechRecognizer?.startListening(intent)
        startRecognitionTimeout()
    }

    private fun stopNativeRecognition() {
        isListening = false
        stopRecognitionTimeout()
        speechRecognizer?.apply {
            stopListening()
            destroy()
        }
        speechRecognizer = null
    }

    // ===== URL & 设置 =====

    private fun loadUrl() {
        val prefs = getSharedPreferences("lingshan", MODE_PRIVATE)
        var url = prefs.getString("server_url", "")

        if (url.isNullOrBlank()) {
            showUrlDialog()
            return
        }

        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://$url"
        }

        binding.progressBar.visibility = View.VISIBLE
        binding.webView.loadUrl(url)
        binding.urlHint.text = url
    }

    private fun showUrlDialog() {
        val input = EditText(this).apply {
            hint = "192.168.1.100:8080"
            setSingleLine(true)
            val prefs = getSharedPreferences("lingshan", MODE_PRIVATE)
            setText(prefs.getString("server_url", ""))
        }

        AlertDialog.Builder(this)
            .setTitle("Server Address")
            .setMessage("Enter your PC's LAN IP and port.\n(Phone and PC must be on same WiFi)")
            .setView(input)
            .setPositiveButton("Connect") { _, _ ->
                val url = input.text.toString().trim()
                if (url.isNotBlank()) {
                    getSharedPreferences("lingshan", MODE_PRIVATE)
                        .edit().putString("server_url", url).apply()
                    loadUrl()
                } else {
                    Toast.makeText(this, "Please enter a valid address", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && binding.webView.canGoBack()) {
            binding.webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onPause() {
        // REQ-036：切后台立即停止识别与播报，不遗留音频，并通知网页关闭嘴型/清理状态。
        stopNativeRecognition()
        stopCurrentSpeech(notifyStopped = true)
        super.onPause()
    }

    override fun onDestroy() {
        // 先禁用 JS 回调（避免 WebView destroy 后 evaluateJavascript），再停止引擎。
        pageAlive = false
        stopNativeRecognition()
        ttsReady = false
        activeTtsId = null
        try {
            tts?.stop()
        } catch (e: RuntimeException) {
            Log.w("SPEECH", "TTS destroy stop threw: ${e.javaClass.simpleName}", e)
        }
        try {
            tts?.shutdown()
        } catch (e: RuntimeException) {
            Log.w("SPEECH", "TTS shutdown threw: ${e.javaClass.simpleName}", e)
        }
        tts = null
        super.onDestroy()
    }
}
