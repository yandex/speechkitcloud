(function (namespace) {
    'use strict';

    /**
     * Пространство имен для классов и методов библиотеки Yandex.Speechkit JS
     * @namespace ya.speechkit
     */
    if (typeof namespace.ya === 'undefined') {
        namespace.ya = {};
    }
    if (typeof namespace.ya.speechkit === 'undefined') {
        namespace.ya.speechkit = {};
    }

    namespace.ya.speechkit.AudioContext = window.AudioContext || window.webkitAudioContext;

    if (typeof namespace.ya.speechkit.settings === 'undefined') {
        var js = document.createElement('script');

        js.type = 'text/javascript';
        js.src = 'https://webasr.yandex.net/jsapi/v1/webspeechkit-settings.js?seed=' + Math.random();

        document.head.appendChild(js);
    }

    /** Набор поддерживаемых форматов аудио.
     * @readonly
     * @enum
     * @memberof ya.speechkit
     */
    namespace.ya.speechkit.FORMAT = {
        /** PCM 8KHz дает плохое качество распознавания, но малый объем передаваемых на сервер данных */
        PCM8: {format: 'pcm', sampleRate: 8000, mime: 'audio/x-pcm;bit=16;rate=8000', bufferSize: 1024},
        /** PCM 16 KHz наилучшее качество распознавания при среднем объеме данных */
        PCM16: {format: 'pcm', sampleRate: 16000, mime: 'audio/x-pcm;bit=16;rate=16000', bufferSize: 2048},
        /** PCM 44 KHz большой размер передаваемых данных, возможны задержки на узком канале */
        PCM44: {format: 'pcm', sampleRate: 44100, mime: 'audio/x-pcm;bit=16;rate=44100', bufferSize: 4096},
    };

    /** Media stream used by SpeechKit
     * @private
     * @memberof ya.speechkit
     */
    namespace.ya.speechkit._stream = null;

    /**
     * Deep copies fileds from object 'from' to object 'to'
     * @param {Object} from Source object
     * @param {Object} to Destination object
     * @private
     */
    namespace.ya.speechkit._extend = function (to, from) {
        var i;
        var toStr = Object.prototype.toString;
        var astr = '[object Array]';
        to = to || {};

        for (i in from) {
            if (from.hasOwnProperty(i)) {
                if (typeof from[i] === 'object') {
                    to[i] = (toStr.call(from[i]) === astr) ? [] : {};
                    namespace.ya.speechkit._extend(to[i], from[i]);
                } else if (typeof from[i] !== 'undefined' || typeof to[i] === 'undefined') {
                    to[i] = from[i];
                }
            }
        }
        return to;
    };

    /**
     * Создает объект для записи аудио-сигнала с микрофона.
     * @class Класс, управляющий записью звука с микрофона.
     * @name Recorder
     */
    var Recorder = function ()
    {
        if (!namespace.ya.speechkit._stream) {
            return null;
        }

        if (!(this instanceof Recorder)) {
            return new Recorder();
        }

        this.worker = namespace.ya.speechkit.newWorker();

        this.recording = false;

        this.paused = false;
        this.lastDataOnPause = 0;

        this.nullsArray = [];

        this.currCallback = null;
        this.buffCallback = null;
        this.startCallback = null;

        this.worker.onmessage = function (e) {
            if (e.data.command == 'int16stream')
            {
                var data = e.data.buffer;

                if (this.startCallback) {
                    this.startCallback(data);
                }
            } else if (e.data.command == 'getBuffers' && this.buffCallback) {
                this.buffCallback(e.data.blob);
            } else if (e.data.command == 'clear' && this.currCallback) {
                this.currCallback();
            } else if (this.currCallback) {
                this.currCallback(e.data.blob);
            }
        }.bind(this);

    };

    Recorder.prototype = /** @lends Recorder.prototype */ {
        /**
         * Creates an input point for a given audio format (sets samplerate and buffer size
         * @param {ya.speechkit.FORMAT} format audio format (it's samplerate and bufferSize are being used)
         * @private
         */
        _createNode: function (format) {
            if (!namespace.ya.speechkit.audiocontext) {
                namespace.ya.speechkit.audiocontext = new namespace.ya.speechkit.AudioContext();
            }

            this.audioInput = namespace.ya.speechkit.audiocontext.createMediaStreamSource(
                                                                            namespace.ya.speechkit._stream);

            if (!namespace.ya.speechkit.audiocontext.createScriptProcessor) {
                this.node = namespace.ya.speechkit.audiocontext.createJavaScriptNode(format.bufferSize, 2, 2);
            } else {
                this.node = namespace.ya.speechkit.audiocontext.createScriptProcessor(format.bufferSize, 2, 2);
            }

            this.audioInput.connect(this.node);
            this.node.onaudioprocess = function (e) {
                if (!this.recording) {return;}

                if (this.paused) {
                    if (Number(new Date()) - this.lastDataOnPause > 2000) {
                        this.lastDataOnPause = Number(new Date());
                        this.worker.postMessage({
                            command: 'record',
                            buffer: [
                                this.nullsArray,
                                this.nullsArray
                            ]
                        });
                    }
                } else {
                    this.worker.postMessage({
                        command: 'record',
                        buffer: [
                            e.inputBuffer.getChannelData(0),
                            e.inputBuffer.getChannelData(1)
                        ]
                    });
                }
            }.bind(this);

            this.node.connect(namespace.ya.speechkit.audiocontext.destination);
        },
        /**
         * Ставит запись звука на паузу.
         * Во время паузы на сервер будут отправляться периодически запросы с пустым звуком, чтобы сервер не обрывал сессию.
         */
        pause: function () {
            this.paused = true;
            this.lastDataOnPause = Number(new Date());
        },
        /**
         * @returns {AudioContext} Текущий <xref scope="external" locale="ru" href="https://developer.mozilla.org/ru/docs/Web/API/AudioContext">
         * AudioContext</xref><xref scope="external" locale="en-com" href="https://developer.mozilla.org/en-US/docs/Web/API/AudioContext">AudioContext</xref>,
         * с которого записывается звук.
         */
        getAudioContext: function () {
            return namespace.ya.speechkit.audiocontext;
        },
        /**
         * @returns {AnalyserNode} <xref scope="external" locale="ru" href="https://developer.mozilla.org/ru/docs/Web/API/AnalyserNode">
         * AnalyserNode</xref><xref scope="external" locale="en-com" href="https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode">
         * AnalyserNode</xref> — объект, предназначенный для анализа аудио-сигнала в реальном времени.
         */
        getAnalyserNode: function () {
            if (!namespace.ya.speechkit.audiocontext) {
                namespace.ya.speechkit.audiocontext = new namespace.ya.speechkit.AudioContext();
            }
            var analyserNode = namespace.ya.speechkit.audiocontext.createAnalyser();
            analyserNode.fftSize = 2048;
            this.audioInput.connect(analyserNode);
            return analyserNode;
        },
        /**
         * @returns {Boolean} true, если запись звука стоит на паузе, false — в противном случае.
         */
        isPaused: function () {
            return this.paused;
        },
        /**
         * Начинает запись звука с микрофона.
         * @param {callback:streamCallback} cb Функция-обработчик, в которую будет передаваться записанный аудио-поток.
         * @param {ya.speechkit.FORMAT} [format=PCM16] Формат для записи аудио-сигнала. Доступные значения:
         * <ul>
         *     <li> PCM8 — плохое качество распознавания, но малый объем передаваемых на сервер данных;</li>
         *     <li> PCM16 — наилучшее качество распознавания при среднем объеме данных; </li>
         *     <li> PCM44 — большой размер передаваемых данных, возможны задержки на узком канале.</li>
         *</ul>
         */
        start: function (cb, format) {
            var backref = this;
            if (!namespace.ya.speechkit._stream) {
                return namespace.ya.speechkit.initRecorder(function () {backref.start(cb, format);}, console.log);
            }

            if (!this.node) {
                this._createNode(format);
            }

            if (this.isPaused()) {
                this.paused = false;
                return;
            }
            if (typeof cb !== 'undefined') {
                this.startCallback = cb;
            } else {
                this.startCallback = null;
            }
            this.worker.postMessage({
                command: 'init',
                config: {
                    sampleRate: namespace.ya.speechkit.audiocontext.sampleRate,
                    format: format || namespace.ya.speechkit.FORMAT.PCM16,
                    channels: this.channelCount,
                }
            });

            this.nullsArray = [];
            var bufferLen = (format || namespace.ya.speechkit.FORMAT.PCM16).bufferSize;
            for (var i = 0; i < bufferLen; i++) {
                this.nullsArray.push(0);
            }

            this.clear(function () {this.recording = true;}.bind(this));
        },
        /**
         * Останавливает запись звука.
         * @param {callback:wavCallback} cb Функция-обработчик, в которую будет передан объект <xref href="https://developer.mozilla.org/en-US/docs/Web/API/Blob" scope="external">Blob</xref>
         * с записанным аудио в формате wav.
         * @param {Number} [channelCount=2] Сколько каналов должно быть в wav-файле: 1 — mono, 2 — stereo.
         */
        stop: function (cb, channelCount) {
            this.recording = false;
            if (this.node) {
                this.node.disconnect();
            }

            this.node = null;
            if (namespace.ya.speechkit._stream &&
                namespace.ya.speechkit._stream.getAudioTracks) {
                namespace.ya.speechkit._stream.getAudioTracks()[0].stop();
            } else if (namespace.ya.speechkit._stream &&
                typeof namespace.ya.speechkit._stream.stop !== 'undefined') {
                namespace.ya.speechkit._stream.stop();
            }
            namespace.ya.speechkit._stream = null;
            if (typeof namespace.ya.speechkit.audiocontext !== 'undefined' &&
                namespace.ya.speechkit.audiocontext !== null &&
                typeof namespace.ya.speechkit.audiocontext.close !== 'undefined') {
                namespace.ya.speechkit.audiocontext.close();
                namespace.ya.speechkit.audiocontext = null;
            }

            if (typeof cb !== 'undefined') {
                this.exportWav(function (blob) {
                    cb(blob);
                }, channelCount || 2);
            }
        },
        /**
         * @returns {Boolean} true, если идет запись звука, false — если запись стоит в режиме паузы.
         */
        isRecording: function () {
            return this.recording;
        },
        /**
         * Очищает буферы с записанным аудио-сигналом.
         * @param {callback:clearCallback} cb Функция-обработчик, которая будет вызвана, когда произойдет очистка.
         */
        clear: function (cb) {
            if (typeof cb !== 'undefined') {
                this.currCallback = cb;
            } else {
                this.currCallback = null;
            }
            this.worker.postMessage({command: 'clear'});
        },
        /**
         * Метод для получения буферов с записанным аудио-сигналом.
         * @param {callback:buffersCallback} cb Функция, в которую будут переданы буферы с аудио-сигналом.
         */
        getBuffers: function (cb) {
            if (typeof cb !== 'undefined') {
                this.buffCallback = cb;
            } else {
                this.buffCallback = null;
            }
            this.worker.postMessage({command: 'getBuffers'});
        },
        /**
         * Экспортирует записанный звук в wav-файл.
         * @param {callback:wavCallback} cb Функция, в которую будет передан объект <xref href="https://developer.mozilla.org/en-US/docs/Web/API/Blob" scope="external">Blob</xref> с файлом.
         * @param {Number} [channelCount=1] Количество каналов в wav-файле: 1 — mono, 2 — stereo.
         */
        exportWav: function (cb, channelCount) {
            if (typeof cb !== 'undefined') {
                this.currCallback = cb;
            } else {
                this.currCallback = null;
            }
            var type = 'audio/wav';

            if (!this.currCallback) {throw new Error('Callback not set');}

            var exportCommand = 'export' + (channelCount != 2 && 'Mono' || '') + 'WAV';

            this.worker.postMessage({
                command: exportCommand,
                type: type
            });
        }
    };

    namespace.ya.speechkit.Recorder = Recorder;

    namespace.ya.speechkit.getUserMedia = navigator.getUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia ||
        navigator.webkitGetUserMedia;

    namespace.ya.speechkit.mediaDevices = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ?
        navigator.mediaDevices :
        (namespace.ya.speechkit.getUserMedia ? {
            getUserMedia: function (c) {
                return new Promise(function (y, n) {
                    namespace.ya.speechkit.getUserMedia.call(navigator, c, y, n);
                });
            }
        } : null);

    namespace.ya.speechkit._stream = null;
    namespace.ya.speechkit.audiocontext = null;

    /**
     * Запрашивает у пользователя права для записи звука с микрофона.
     * @param {callback:initSuccessCallback} initSuccess Функция-обработчик, которая будет вызвана при успешном подключении к микрофону.
     * @param {callback:initFailCallback} initFail Функция-обработчик, в которую будет передано сообщения об ошибке, в случае неуспеха.
     */
    namespace.ya.speechkit.initRecorder = function (initSuccess, initFail)
    {
        var badInitialization = function (err) {
            namespace.ya.speechkit._stream = null;
            if (typeof initFail !== 'undefined') {
                initFail(err);
            }
        };

        if (namespace.ya.speechkit.mediaDevices)
        {
            namespace.ya.speechkit.mediaDevices.getUserMedia(
                {audio: true}).then(
                function (stream) {
                    namespace.ya.speechkit._stream = stream;
                    if (typeof initSuccess !== 'undefined') {
                        initSuccess();
                    }
                }).catch(
                function (err) {
                    badInitialization(err.message || err.name || err);
                });
        } else {
            badInitialization('Your browser doesn\'t support Web Audio API. ' +
                              'Please, use Yandex.Browser: https://browser.yandex.ru');
        }
    };

    /**
     * Поддерживается ли рапознавание заданного языка.
     * @return true, если язык поддерживается, false — иначе.
     */
    namespace.ya.speechkit.isLanguageSupported = function (lang)
    {
        if (namespace.ya.speechkit.settings.langWhitelist.indexOf(lang) >= 0) {
            return namespace.ya.speechkit.isSupported();
        } else {
            return namespace.ya.speechkit.isWebAudioSupported();
        }
    };

    /**
     * Поддерживаются ли технологии рапознавания Яндекса.
     * @return true, если поддерживаются, false — иначе.
     */
    namespace.ya.speechkit.isSupported = function ()
    {
        var userAgent = navigator.userAgent.toLowerCase();
        // Yandex recognition is 100% supported on mobile devices only in firefox
        return ((namespace.ya.speechkit.mediaDevices !== null) &&
                ((/mozilla|firefox/.test(userAgent) && !/yabrowser/.test(userAgent)) ||
                !/iphone|ipod|ipad|android|blackberry/.test(userAgent)));
    };

    /**
     * Поддерживается ли рапознавание с помощью WebAudio API.
     * @return true, если поддерживается, false — иначе.
     */
    namespace.ya.speechkit.isWebAudioSupported = function ()
    {
        var userAgent = navigator.userAgent.toLowerCase();
        var SpeechRecognition = namespace.SpeechRecognition || namespace.webkitSpeechRecognition;
        // Native recognition is only supported in original chrome and chromium
        return (typeof SpeechRecognition !== 'undefined' && !/yabrowser|opera|opr/.test(userAgent));
    };


    /**
     * Функция, которая будет вызвана по факту успешного получения прав на доступ к микрофону.
     * @callback
     * @name initSuccessCallback
     * @memberof Recorder
     */

    /**
     * Функция-обработчик, которая будет вызвана при возникновении ошибки при получении доступа к микрофону.
     * @callback initFailCallback
     * @param {String} error Сообщение об ошибке.
     * @memberof Recorder
     */

    /**
     * Функция для <xref href="https://developer.mozilla.org/en-US/docs/Web/API/Blob" scope="external">Blob</xref> с wav-файлом.
     * @callback
     * @name wavCallback
     * @param {<xref href="https://developer.mozilla.org/en-US/docs/Web/API/Blob" scope="external">Blob</xref> с MIME типом audio/wav} data wav-файл.
     * @memberof Recorder
     */

    /**
     * Функция-обработчик, в которую будут переданы буферы записанного аудио.
     * @callback
     * @name buffersCallback
     * @param {Float32Array[]} buffers Буферы записанного аудио для двух каналов (моно и стерео).
     * @memberof Recorder
     */

    /**
     * Функция, которая будет вызвана после очистки буферов (это сигнал готовности к повторному запуску).
     * @callback
     * @name clearCallback
     * @memberof Recorder
     */

    /**
     * Функция-обработчик, в которую будет передаваться записанный аудио-поток.
     * @callback
     * @name streamCallback
     * @param {ArrayBuffer} stream Записанный PCM поток 16-bit.
     * @memberof Recorder
     */

}(this));
