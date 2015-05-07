(function (namespace) {
    'use strict';

    if (typeof namespace.ya === 'undefined') {
        namespace.ya = {};
    }
    if (typeof namespace.ya.speechkit === 'undefined') {
        namespace.ya.speechkit = {};
    }

    namespace.ya.speechkit.Spotter = function () {
        if (!(this instanceof namespace.ya.speechkit.Spotter)) {
            return new namespace.ya.speechkit.Spotter();
        }

        this.send = 0;
        this.send_bytes = 0;
        this.proc = 0;
        this.recorder = null;
        this.recognizer = null;
        this.vad = null;
    };

    namespace.ya.speechkit.Spotter.prototype = {
        start: function (options) {
            this.options = namespace.ya.speechkit._extend(
                namespace.ya.speechkit._extend(
                    {phrases:[]},
                    namespace.ya.speechkit._defaultOptions()
                ),
                options);

            if (namespace.ya.speechkit._recorderInited) {
                this.onstart();
            } else {
                namespace.ya.speechkit.initRecorder(
                    this.onstart.bind(this),
                    this.options.errorCallback
                );
            }
        },

        onstart: function () {
            var _this = this;
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
                        _this.recorder.start(function (data) {
                            if (_this.options.vad && _this.vad) {
                                _this.vad.update();
                            }
                            _this.send++;
                            _this.send_bytes += data.byteLength;
                            _this.options.infoCallback({
                                send_bytes: _this.send_bytes,
                                format: _this.options.format,
                                send_packages: _this.send,
                                processed: _this.proc
                            });
                            _this.recognizer.addData(data);
                        }, _this.options.format);
                        _this.options.initCallback(sessionId, code);
                    },

                    onResult: function (text, uttr, merge) {
                        _this.proc += merge;
                        _this.options.dataCallback(text, uttr, merge);
                    },

                    onError: function (msg) {
                        _this.recorder.stop(function () {});
                        _this.recognizer.close();
                        _this.recognizer = null;
                        _this.options.errorCallback(msg);
                    },

                    format: this.options.format.mime,
                    phrases: this.options.phrases,
                    url: namespace.ya.speechkit.settings.websocketProtocol +
                         namespace.ya.speechkit.settings.spotterUrl,
                }
            );

            this.recognizer.start();
        },

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

        pause: function () {
            this.recorder.pause();
        },

        isPaused: function () {
            return (!this.recorder || this.recorder.isPaused());
        },
    };
}(this));
