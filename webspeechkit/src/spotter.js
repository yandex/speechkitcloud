(function (namespace) {
    'use strict';

    if (typeof namespace.ya === 'undefined') {
        namespace.ya = {};
    }
    if (typeof namespace.ya.speechkit === 'undefined') {
        namespace.ya.speechkit = {};
    }

    /**
     * @class Класс для использования технологии "Голосовая активация".
     * @name Spotter
     */

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

    namespace.ya.speechkit.Spotter.prototype = /** @lends Spotter.prototype */ {
        /**
         * Начинает запись аудио с микрофона и поиск ключевых фраз.
         * @param {Object} options Параметры записи и распознавания.
         * @param {callback:SpeechRecognition.initCallback} [options.initCallback] Функция-обработчик, которая будет вызвана по факту инициализации сессии распознавания.
         * @param {callback:SpeechRecognition.errorCallback} [options.errorCallback] Функция-обработчик, которая будет вызвана по факту ошибки (все ошибки критичны и приводят к завершению сессии).
         * @param {callback:SpeechRecognition.dataCallback} [options.dataCallback] Функция-обработчик, которая будет вызвана после успешного завершения
         * распознавания.
         * @param {callback:SpeechRecognition.infoCallback} [options.infoCallback] Функция для получения технической информации.
         * @param {Function} [options.stopCallback] Функция-обработчик, которая будет вызвана в момент остановки сессии распознавания.
         * @param {String} [options.apiKey] API-ключ. Если не задан, то используется ключ, указанный
         * в настройках ya.speechkit.settings.apiKey.
         * @param {Boolean} [options.punctuation=false] Следует ли использовать пунктуацию.
         * @param {String} [options.model='freeform'] Языковая модель для распознавания речи. Если параметр не указан, то используется
         * значение, заданное в настройках ya.speechkit.model. Если в настройках значение не задано, то
         * используется модель по умолчанию - 'freeform'.
         * @param {String} [options.lang='ru-RU'] Язык, речь на котором следует распознавать. Если параметр не указан, то используется
         * значение, заданное в настройках ya.speechkit.lang. Если в настройках значение не задано, то по умолчанию
         * выбирается русский язык: 'ru-RU'.
         * @param {ya.speechkit.FORMAT} [options.format=ya.speechkit.FORMAT.PCM16] Формат передачи аудио-сигнала.
         * @param {String} options.phrases Список ключевых фраз, перечисленных через запятую. Например, 'Записывай, Завершить запись'.
         */
        start: function (options) {
            this.options = namespace.ya.speechkit._extend(
                namespace.ya.speechkit._extend(
                    {phrases:[]},
                    namespace.ya.speechkit._defaultOptions()
                ),
                options);

            if (namespace.ya.speechkit._stream !== null) {
                this._onstart();
            } else {
                namespace.ya.speechkit.initRecorder(
                    this._onstart.bind(this),
                    this.options.errorCallback
                );
            }
        },

        _onstart: function () {
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
                namespace.ya.speechkit._extend(this.options,
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

                    format: this.options.format,
                    phrases: this.options.phrases,
                    url: namespace.ya.speechkit.settings.websocketProtocol +
                         namespace.ya.speechkit.settings.spotterUrl,
                })
            );

            this.recognizer.start();
        },
        /**
         * Останавливает запись звука и распознавания. Как только запись будет остановлена, вызывается функция-обработчик,
         * которая была указана в параметре
         * <xref scope="external" href="https://tech.yandex.ru/speechkit/jsapi/doc/ref/reference/ya.speechkit.Spotter.xml#param-options.stopCallback">options.stopCallback</xref>
         * в конструкторе класса.
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
         * Ставит запись звука и распознавания на паузу.
         */
        pause: function () {
            this.recorder.pause();
        },

        /**
         * Проверяет, не стоит ли запись звука на паузе.
         * @returns true - если запись стоит на паузе, false - иначе.
         */
        isPaused: function () {
            return (!this.recorder || this.recorder.isPaused());
        },
    };
}(this));
