(function (namespace) {
    'use strict';

    /**
     * namespace for Yandex.Speechkit JS code
     * @namespace ya.speechkit
     */
    if (typeof namespace.ya === 'undefined') {
        namespace.ya = {};
    }
    if (typeof namespace.ya.speechkit === 'undefined') {
        namespace.ya.speechkit = {};
    }

    if (typeof namespace.ya.speechkit.settings === 'undefined') {
        var js = document.createElement('script');

        js.type = 'text/javascript';
        js.src = 'https://download.yandex.ru/webspeechkit/webspeechkit-settings.js?seed=' + Math.random();

        document.head.appendChild(js);
    }

    /** Flag of initialization status
     * @private
     * @memberof ya.speechkit
     */
    namespace.ya.speechkit._recorderInited = false;

    /** Set of supported formats
     * @readonly
     * @enum
     * @memberof ya.speechkit
     */
    namespace.ya.speechkit.FORMAT = {
        /** PCM 8KHz gives bad quality of recognition and small file size */
        PCM8: {format: 'pcm', sampleRate: 8000, mime: 'audio/x-pcm;bit=16;rate=8000', bufferSize: 1024},
        /** PCM 16 KHz gives the best quality of recognition and average file size */
        PCM16: {format: 'pcm', sampleRate: 16000, mime: 'audio/x-pcm;bit=16;rate=16000', bufferSize: 2048},
        /** PCM 44 KHz gives big file size and lags on recognition */
        PCM44: {format: 'pcm', sampleRate: 44100, mime: 'audio/x-pcm;bit=16;rate=44100', bufferSize: 4096},
    };

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
                } else {
                    to[i] = from[i];
                }
            }
        }
        return to;
    };

    /**
     * Records sound from mic
     * @class
     * @memberof ya.speechkit
     * @alias Recorder
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

    Recorder.prototype = {
        /**
         * Creates an input point for a given audio format (sets samplerate and buffer size
         * @param {ya.speechkit.FORMAT} format audio format (it's samplerate and bufferSize are being used)
         * @private
         */
        _createNode: function (format) {
            this.context = namespace.ya.speechkit.audiocontext || new namespace.ya.speechkit.AudioContext();
            namespace.ya.speechkit.audiocontext = this.context;

            this.audioInput = this.context.createMediaStreamSource(namespace.ya.speechkit._stream);

            if (!this.context.createScriptProcessor) {
                this.node = this.context.createJavaScriptNode(format.bufferSize, 2, 2);
            } else {
                this.node = this.context.createScriptProcessor(format.bufferSize, 2, 2);
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

            this.node.connect(this.context.destination);
        },
        /**
         * Puts recorder into paused mode
         * @description Recorder in this mode will call on startCallback with empty sound as a heartbeat
         */
        pause: function () {
            this.paused = true;
            this.lastDataOnPause = Number(new Date());
        },
        /**
         * Returns AudioContext which sound is being recordered
         * @returns {AudioContext} Current AudioContext
         * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioContext
         */
        getAudioContext: function () {
            return this.context;
        },
        /**
         * Returns AnalyserNode for realtime audio record analysis
         * @returns {AnalyserNode}
         * @see https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
         */
        getAnalyserNode: function () {
            this.context = namespace.ya.speechkit.audiocontext || new namespace.ya.speechkit.AudioContext();
            namespace.ya.speechkit.audiocontext = this.context;
            var analyserNode = this.context.createAnalyser();
            analyserNode.fftSize = 2048;
            this.inputPoint.connect(analyserNode);
            return analyserNode;
        },
        /**
         * Returns true if recorder is in paused mode
         * @returns {Boolean} True if recorder is paused (not stopped!)
         */
        isPaused: function () {
            return this.paused;
        },
        /**
         * Starts recording
         * @param {Recorder~streamCallback} cb Callback for 16-bit audio stream
         * @param {ya.speechkit.FORMAT} format Format for audio recording
         */
        start: function (cb, format) {
            if (!this.node) {
                this._createNode(format);
            }

            if (this.isPaused()) {
                this.paused = false;
                return;
            }

            this.startCallback = cb;
            this.worker.postMessage({
                command: 'init',
                config: {
                    sampleRate: this.context.sampleRate,
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
         * Stops recording
         * @param {Recorder~wavCallback} cb Callback for finallized record in a form of wav file
         * @param {Number} channelCount Channel count in audio file (1 or 2)
         */
        stop: function (cb, channelCount) {
            this.recording = false;

            this.exportWAV(function (blob) {
                cb(blob);
            }, channelCount || 2);
        },
        /**
         * Returns true if recording is going on (or is on pause)
         * @returns {Boolean} true if recorder is recording sound or sending heartbeat on pause
         */
        isRecording: function () {
            return this.recording;
        },
        /**
         * Clears recorder sound buffer
         * @param {Recorder~clearCallback} cb Callback for indication of clearing process finish
         */
        clear: function (cb) {
            this.currCallback = cb;
            this.worker.postMessage({command: 'clear'});
        },
        /**
         * Returns recordered sound buffers
         * @param {Recorder~buffersCallback} cb Callback for recordered buffers
         */
        getBuffers: function (cb) {
            this.buffCallback = cb;
            this.worker.postMessage({command: 'getBuffers'});
        },
        /**
         * Exports recordered sound buffers in a wav-file
         * @param {Recorder~wavCallback} cb Callback for wav-file
         */
        exportWAV: function (cb, channelCount) {
            this.currCallback = cb;
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

    /**
     * Ask user to share his mic and initialize Recorder class
     * @param {ya.speechkit.initSuccessCallback} initSuccess Callback to call for successful initialization
     * @param {ya.speechkit.initFailCallback} initFail Callback to call on error
     * @memberof ya.speechkit
     */
    namespace.ya.speechkit.initRecorder = function (initSuccess, initFail)
    {
        namespace.ya.speechkit.AudioContext = window.AudioContext || window.webkitAudioContext;

        navigator.getUserMedia = (navigator.getUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia ||
        navigator.webkitGetUserMedia);

        namespace.ya.speechkit._stream = null;

        var badInitialization = function (err) {
            namespace.ya.speechkit._recorderInited = false;
            initFail(err);
        };

        if (navigator.getUserMedia)
        {
            navigator.getUserMedia(
                {audio: true},
                function (stream) {
                    namespace.ya.speechkit._stream = stream;
                    namespace.ya.speechkit._recorderInited = true;
                    initSuccess();
                },
                function (err) {
                    badInitialization('Couldn\'t initialize Yandex Webspeechkit: ' + err);
                }
            );
        } else {
            badInitialization('Your browser doesn\'t support Web Audio API. ' +
                              'Please, use Yandex.Browser: https://browser.yandex.ru');
        }
    };

    /**
     * Callback for successful initialization
     * @callback initSuccessCallback
     * @memberof ya.speechkit
     */

    /**
     * Callback for unsuccessful initialization
     * @callback initFailCallback
     * @param {String} error Error message
     * @memberof ya.speechkit
     */

    /**
     * Callback for wav file export
     * @callback Recorder~wavCallback
     * @param {Blob} data - WAV file
     */

    /**
     * Callback for recordered audio buffers
     * @callback Recorder~buffersCallback
     * @param {Float32Array[]} buffers - recordered buffers for both channels (2 elements)
     */

    /**
     * Callback to indicate Recorder's readiness to record more audio
     * @callback Recorder~clearCallback
     */

    /**
     * Callback for realtime pcm streaming
     * @callback Recorder~streamCallback
     * @param {ArrayBuffer} stream - 16bit pcm stream
     */

}(this));
