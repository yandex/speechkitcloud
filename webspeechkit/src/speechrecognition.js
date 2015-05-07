(function (namespace) {
    'use strict';

    if (typeof namespace.ya === 'undefined') {
        namespace.ya = {};
    }
    if (typeof namespace.ya.speechkit === 'undefined') {
        namespace.ya.speechkit = {};
    }

    function noop() {}

    /**
    * Default options for SpeechRecognition
    * @private
    */
    namespace.ya.speechkit._defaultOptions = function () {
        /**
         * @typedef {Object} SpeechRecognitionOptions
         * @property {SpeechRecognition~initCallback} initCallback - Callback to call upon successful initialization
         * @property {SpeechRecognition~errorCallback} errorCallback - Callback to call upon error
         * @property {SpeechRecognition~dataCallback} dataCallback - Callback for partialy recognized text
         * @property {SpeechRecognition~infoCallback} infoCallback - Callback for technical data
         * @property {SpeechRecognition~stopCallback} stopCallback - Callback for recognition stop
         * @property {Boolean} punctuation - Will you need some punctuation
         * @property {String} model - Model to use for recognition
         * @property {String} lang - Language to use for recognition
         * @property {ya.speechkit.FORMAT} format - Format for audio record
         */
        return {
                initCallback: noop,
                errorCallback: noop,
                dataCallback: noop,
                infoCallback: noop,
                stopCallback: noop,
                punctuation: false,
                advancedOptions: {},
                model: namespace.ya.speechkit.settings.model,
                lang: namespace.ya.speechkit.settings.lang,
                format: namespace.ya.speechkit.FORMAT.PCM16,
                vad: false,
                speechStart: noop,
                speechEnd: noop,
            };
    };

    /**
    * Creates a new SpeechRecognition session
    * @class
    * @classdesc A class for long speech recognition queries
    * @memberof ya.speechkit
    */
    var SpeechRecognition = function () {
        if (!(this instanceof namespace.ya.speechkit.SpeechRecognition)) {
            return new namespace.ya.speechkit.SpeechRecognition();
        }
        this.send = 0;
        this.send_bytes = 0;
        this.proc = 0;
        this.recorder = null;
        this.recognizer = null;
        this.vad = null;
    };

    SpeechRecognition.prototype = {
        /**
         * Starts recording sound and it's recognition
         * @param {SpeechRecognitionOptions} options - Options to use during recognition process
         */
        start: function (options) {
            this.options = namespace.ya.speechkit._extend(
                                namespace.ya.speechkit._extend(
                                    {},
                                    namespace.ya.speechkit._defaultOptions()
                                ),
                                options);

            if (namespace.ya.speechkit._recorderInited) {
                this._onstart();
            } else {
                namespace.ya.speechkit.initRecorder(
                    this._onstart.bind(this),
                    this.options.errorCallback
                );
            }
        },
        /**
         * Will be called after successful call of initRecorder
         * @private
         */
        _onstart: function () {
            if (this.recorder && this.recorder.isPaused()) {
                this.recorder.start();
            }

            if (this.recognizer) {
                return;
            }

            this.send = 0;
            this.send_bytes = 0;
            this.proc = 0;

            if (!this.recorder) {
                this.recorder = new namespace.ya.speechkit.Recorder();
                if (this.options.vad) {
                    this.vad = new namespace.ya.speechkit.Vad({recorder: this.recorder,
                                                     speechStart: this.options.speechStart,
                                                     speechEnd: this.options.speechEnd});
                }
            }

            this.recognizer = new namespace.ya.speechkit.Recognizer(
                {
                    onInit: function (sessionId, code) {
                        this.recorder.start(function (data) {
                            if (this.options.vad && this.vad) {
                                this.vad.update();
                            }
                            this.send++;
                            this.send_bytes += data.byteLength;
                            this.options.infoCallback({
                                send_bytes: this.send_bytes,
                                format: this.options.format,
                                send_packages: this.send,
                                processed: this.proc
                            });
                            this.recognizer.addData(data);
                        }.bind(this), this.options.format);

                        this.options.initCallback(sessionId, code);
                    }.bind(this),
                    onResult: function (text, uttr, merge) {
                                this.proc += merge;
                                this.options.dataCallback(text, uttr, merge);
                            }.bind(this),
                    onError: function (msg) {
                                this.recorder.stop(function () {});
                                this.recognizer.close();
                                this.recognizer = null;
                                this.options.errorCallback(msg);
                            }.bind(this),

                    model: this.options.model,
                    lang: this.options.lang,
                    format: this.options.format.mime,
                    punctuation: this.options.punctuation,
                    key: this.options.apiKey,
                    advancedOptions: this.options.advancedOptions
                });
            this.recognizer.start();
        },
        /**
         * Stops recognition process
         * @description When recognition process will stop stopCallback will be called
         */
        stop: function () {
            if (this.recognizer) {
                this.recognizer.close();
            }

            this.recorder.stop(
                function () {
                    this.recognizer = null;
                    this.options.stopCallback();
                }.bind(this)
            );
        },
        /**
         * Sets recognition process to pause mode
         * @description Heartbeet with empty sound will be send in pause mode to prevent session drop
         */
        pause: function () {
            this.recorder.pause();
        },
        /**
         * Returns true if recognition session is in pause mode
         * @returns {Boolean} True if recognition session is in pause mode
         */
        isPaused: function () {
            return (!this.recorder || this.recorder.isPaused());
        }
    };

    ya.speechkit.SpeechRecognition = SpeechRecognition;

    /**
    * Function for simple recognition
    * @param {SpeechRecognitionOptions} options - Options to use during recognition process
    * @param {recognitionDoneCallback} options.doneCallback - Callback for full recognized text
    * @memberof ya.speechkit
    */
    namespace.ya.speechkit.recognize = function (options) {
        var dict = new namespace.ya.speechkit.SpeechRecognition();

        var opts = namespace.ya.speechkit._extend(
                        namespace.ya.speechkit._extend(
                            {},
                            namespace.ya.speechkit._defaultOptions()
                        ),
                        options);

        opts.doneCallback = options.doneCallback;

        opts.dataCallback = function (text, uttr, merge) {
            if (uttr) {
                if (opts.doneCallback) {
                    opts.doneCallback(text);
                }
                dict.stop();
            }
        };

        opts.stopCallback = function () {
            dict = null;
        };

        dict.start(opts);
    };

    /**
     * Callback for full recognized text
     * @param {String} text - Recognized user speech
     * @callback recognitionDoneCallback
     *
     */

    /**
     * Callback for successful recognition session initialization
     * @callback SpeechRecognition~initCallback
     * @param {String} sessionId - Session identifier
     * @param {Number} code - Http status of initialization response
     */

    /**
     * Callback for recognition error message
     * @callback SpeechRecognition~errorCallback
     * @param {String} message - Error message
     */

    /**
     * Callback for recognition error message
     * @callback SpeechRecognition~dataCallback
     * @param {String} text - Recognized text
     * @param {Boolean} utterance - Is this a final text result for this utterance
     * @param {Number} merge - How many requests were merged in this response
     */

    /**
     * Callback for technical information messages
     * @callback SpeechRecognition~infoCallback
     * @param {Number} send_bytes - How many bytes of audio data were send during session
     * @param {Number} send_packages - How many packages with audio data were send during session
     * @param {Number} processed - How many audio packages were processed by server
     * @param {ya.speechkit.FORMAT} format - Which format is used for audio
     */

    /**
     * Callback to indicate recognition process has stopped
     * @callback SpeechRecognition~stopCallback
     */
}(this));
