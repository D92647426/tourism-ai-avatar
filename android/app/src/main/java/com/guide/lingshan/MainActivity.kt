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

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false
    private var tts: TextToSpeech? = null
    private var ttsReady = false

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

    private fun initTts() {
        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val result = tts?.setLanguage(java.util.Locale.CHINESE)
                ttsReady = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
                Log.d("SPEECH", "TTS init: ready=$ttsReady, langResult=$result")
                sendToJs("if(window.onTtsReady)window.onTtsReady($ttsReady)")
            } else {
                Log.e("SPEECH", "TTS init failed: $status")
                ttsReady = false
                sendToJs("if(window.onTtsReady)window.onTtsReady(false)")
            }
        }
        tts?.setSpeechRate(1.0f)
        tts?.setPitch(1.1f)
    }

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

        // ===== 原生 TTS =====
        @JavascriptInterface
        fun speak(text: String) {
            Log.d("SPEECH", "TTS speak: ${text.take(30)}...")
            if (!ttsReady || tts == null) {
                sendToJs("if(window.onTtsError)window.onTtsError('not-ready')")
                return
            }
            val utteranceId = "utt_${System.currentTimeMillis()}"
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(uttId: String?) {
                    sendToJs("if(window.onTtsStart)window.onTtsStart()")
                }
                override fun onDone(uttId: String?) {
                    sendToJs("if(window.onTtsEnd)window.onTtsEnd()")
                }
                override fun onError(uttId: String?) {
                    sendToJs("if(window.onTtsError)window.onTtsError('playback-error')")
                }
                @Deprecated("Deprecated in Java")
                override fun onError(uttId: String?, errorCode: Int) {
                    sendToJs("if(window.onTtsError)window.onTtsError('error-$errorCode')")
                }
            })
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
        }

        @JavascriptInterface
        fun stopSpeaking() {
            tts?.stop()
        }

        @JavascriptInterface
        fun isTtsReady(): Boolean = ttsReady
    }

    private fun sendToJs(js: String) {
        Log.d("SPEECH", "sendToJs: $js")
        binding.webView.post {
            binding.webView.evaluateJavascript(js, null)
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

    override fun onDestroy() {
        stopNativeRecognition()
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }
}
