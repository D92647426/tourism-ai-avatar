/**
 * Live2D Helper — 数字人渲染与口型控制
 * 依赖: PIXI.js v5, live2dcubismcore.min.js (Cubism2), pixi-live2d-display (Cubism2)
 */
var Live2DHelper = (function() {
    'use strict';

    var app = null;
    var model = null;
    var isReady = false;
    var isSpeaking = false;
    var mouthTimer = null;

    // 默认模型配置
    var config = {
        modelPath: '/models/haru/haru.model.json',
        scale: 0.22,
        x: 0,
        y: 30
    };

    /**
     * 初始化 Live2D
     * @param {HTMLCanvasElement} canvas
     * @param {Object} opts { modelPath, scale, x, y }
     */
    function init(canvas, opts) {
        // 防止重复初始化
        if (app) {
            console.warn('Live2DHelper: 已初始化，跳过');
            return Promise.resolve();
        }

        if (opts) {
            if (opts.modelPath) config.modelPath = opts.modelPath;
            if (opts.scale !== undefined) config.scale = opts.scale;
            if (opts.x !== undefined) config.x = opts.x;
            if (opts.y !== undefined) config.y = opts.y;
        }

        // 获取画布实际尺寸
        var rect = canvas.getBoundingClientRect();
        var width = canvas.width || 320;
        var height = canvas.height || 420;

        // 如果canvas没有设置尺寸，用CSS尺寸
        if (!canvas.width || canvas.width === 0) {
            width = rect.width || 320;
            height = rect.height || 420;
            canvas.width = width;
            canvas.height = height;
        }

        return new Promise(function(resolve, reject) {
            try {
                // 检查 PIXI 是否加载
                if (typeof PIXI === 'undefined') {
                    throw new Error('PIXI.js 未加载');
                }

                // 检查 live2d 模块是否加载
                if (!PIXI.live2d || !PIXI.live2d.Live2DModel) {
                    throw new Error('pixi-live2d-display 未加载。请确认 live2dcubismcore.min.js 和 pixi-live2d-display.min.js 已正确引入');
                }

                // 创建 PIXI Application
                app = new PIXI.Application({
                    view: canvas,
                    width: width,
                    height: height,
                    transparent: true,
                    backgroundColor: 0x000000,
                    backgroundAlpha: 0,
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });

                console.log('Live2DHelper: PIXI Application 创建成功 (' + width + 'x' + height + ')');

                // 禁用音效，不拦截点击（点击由外层 stage div 处理）
                PIXI.live2d.config.sound = false;

                PIXI.live2d.Live2DModel.from(config.modelPath)
                    .then(function(m) {
                        model = m;
                        app.stage.addChild(model);

                        model.scale.set(config.scale);
                        model.anchor.set(0.5, 0.35);
                        model.x = width / 2 + (config.x || 0);
                        model.y = height * 0.42;

                        // 不绑定 hit 事件 — 点击统一走 stage

                        isReady = true;
                        console.log('Live2DHelper: 模型加载成功!');
                        resolve(model);
                    })
                    .catch(function(err) {
                        console.error('Live2DHelper: 模型加载失败 -', err.message);
                        showErrorOnCanvas(canvas, width, height);
                        reject(err);
                    });

            } catch (err) {
                console.error('Live2DHelper: 初始化失败 -', err.message);
                showErrorOnCanvas(canvas, width, height);
                reject(err);
            }
        });
    }

    /** 加载失败的画布提示 */
    function showErrorOnCanvas(canvas, width, height) {
        try {
            var ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, width, height);
                // 绘制圆形背景
                ctx.fillStyle = '#e8f5e9';
                ctx.beginPath();
                ctx.arc(width/2, height/2 - 20, 60, 0, Math.PI * 2);
                ctx.fill();
                // 绘制emoji
                ctx.fillStyle = '#2d8f4e';
                ctx.font = '50px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🧑‍💼', width/2, height/2);
                // 文字提示
                ctx.fillStyle = '#999';
                ctx.font = '13px sans-serif';
                ctx.fillText('Live2D 加载中...', width/2, height/2 + 50);
            }
        } catch(e) {}
    }

    // ===== 口型控制 =====

    function startSpeaking(interval) {
        if (!model) return;
        isSpeaking = true;
        interval = interval || 100;
        animateMouth(interval);
    }

    function stopSpeaking() {
        isSpeaking = false;
        if (mouthTimer) {
            clearTimeout(mouthTimer);
            mouthTimer = null;
        }
        if (model) {
            setMouthOpen(0);
        }
    }

    function animateMouth(interval) {
        if (!isSpeaking || !model) return;
        var value = 0.2 + Math.random() * 0.8;
        setMouthOpen(value);
        mouthTimer = setTimeout(function() {
            animateMouth(interval);
        }, interval);
    }

    function setMouthOpen(value) {
        if (!model) return;
        try {
            model.internalModel.coreModel.setParameterValueById(
                'ParamMouthOpenY',
                Math.min(1, Math.max(0, value))
            );
        } catch(e) {}
    }

    // ===== 表情与动作 =====

    function setExpression(exp) {
        if (!model) return;
        try { model.expression(exp); } catch(e) {}
    }

    function randomExpression() {
        var exps = ['f01', 'f02', 'f03', 'f04', 'f05', 'f06', 'f07', 'f08'];
        setExpression(exps[Math.floor(Math.random() * exps.length)]);
    }

    function playMotion(motion) {
        if (!model) return;
        try { model.motion(motion, 3); } catch(e) {}
    }

    // ===== 情感触发 =====

    function reactToText(text) {
        if (!model || !text) return;
        var lower = text;
        if (lower.indexOf('欢迎') !== -1 || lower.indexOf('你好') !== -1 || lower.indexOf('您好') !== -1) {
            setExpression('f01'); // 微笑
        } else if (lower.indexOf('抱歉') !== -1 || lower.indexOf('遗憾') !== -1) {
            setExpression('f04'); // 遗憾
        } else if (lower.indexOf('精彩') !== -1 || lower.indexOf('推荐') !== -1 || lower.indexOf('太棒') !== -1) {
            setExpression('f02'); // 开心
        }
    }

    // ===== 状态查询 =====

    function ready() { return isReady && model !== null; }
    function getModel() { return model; }

    return {
        init: init,
        startSpeaking: startSpeaking,
        stopSpeaking: stopSpeaking,
        setMouthOpen: setMouthOpen,
        setExpression: setExpression,
        randomExpression: randomExpression,
        playMotion: playMotion,
        reactToText: reactToText,
        ready: ready,
        getModel: getModel
    };
})();
