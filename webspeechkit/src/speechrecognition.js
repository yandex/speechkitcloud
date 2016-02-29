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
    * Параметры по умолчанию для SpeechRecognition
    * @private
    */
    namespace.ya.speechkit._defaultOptions = function () {
        /**
         * @typedef {Object} SpeechRecognitionOptions
         * @property {SpeechRecognition~initCallback} initCallback - Функция, которая будет вызвана по факту инициализации сессии распознавания
         * @property {SpeechRecognition~errorCallback} errorCallback - Функция, которая будет вызвана по факту ошибки (все ошибки - критичны, и приводят к порче сессии)
         * @property {SpeechRecognition~dataCallback} dataCallback - Функция, в которую будут приходить результаты распознавания
         * @property {SpeechRecognition~infoCallback} infoCallback - Функция для технической информации
         * @property {SpeechRecognition~stopCallback} stopCallback - Функция, которая будет вызвана в момент остановки сессии распознавания
         * @property {Boolean} punctuation - Следует ли пытаться расставлять знаки препинания
         * @property {Boolean} allowStringLanguage - Следует ли отключить фильтрацию обсценной лексики
         * @property {String} model - Языковая модель для распознавания речи
         * @property {String} lang - Язык, речь на котором следует распознавать
         * @property {ya.speechkit.FORMAT} format - Формат передачи аудио сигнала
         * @property {String} [options.applicationName] Название приложения. Для некоторых приложений мы поддерживаем специальную логику. Пример - sandbox.
         */
        return {
                initCallback: noop,
                errorCallback: noop,
                dataCallback: noop,
                infoCallback: noop,
                stopCallback: noop,
                punctuation: false,
                allowStrongLanguage: false,
                model: namespace.ya.speechkit.settings.model,
                applicationName: namespace.ya.speechkit.settings.applicationName,
                lang: namespace.ya.speechkit.settings.lang,
                format: namespace.ya.speechkit.FORMAT.PCM16,
                url: namespace.ya.speechkit.settings.websocketProtocol +
                        namespace.ya.speechkit.settings.asrUrl,
                vad: false,
                speechStart: noop,
                speechEnd: noop,
            };
    };

    /**
    * Создает новый объект типа SpeechRecognition.
    * @class Класс для распознавания большого потока аудио-сигнала.
    * @name SpeechRecognition
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

    SpeechRecognition.prototype = /** @lends SpeechRecognition.prototype */ {
        /**
         * Запускает процесс распознавания речи.
         * @param {Object} [options] Параметры, которые будут использоваться во время сессии.
         * @param {callback:initCallback} [options.initCallback] Функция-обработчик, которая будет вызвана по факту инициализации сессии распознавания.
         * @param {callback:errorCallback} [options.errorCallback] Функция-обработчик, которая будет вызвана по факту ошибки (все ошибки критичны и приводят к завершению сессии).
         * @param {callback:dataCallback} [options.dataCallback] Функция-обработчик, которая будет вызвана после успешного завершения
         * распознавания. В качестве аргумента ей передаются результаты распознавания.
         * @param {callback:infoCallback} [options.infoCallback] Функция для получения технической информации.
         * @param {callback:stopCallback} [options.stopCallback] Функция-обработчик, которая будет вызвана в момент остановки сессии распознавания.
         * @param {String} [options.apikey] API-ключ. Если не задан, то используется ключ, указанный
         * в глобальных настройках {@link settings}.
         * @param {Boolean} [options.punctuation=false] Следует ли использовать пунктуацию.
         * @param {Boolean} [options.allowStrongLanguage=false] Следует ли отключить фильтрацию обсценной лексики.
         * @param {String} [options.model='notes'] Языковая модель для распознавания речи. Список доступных значений:
         * <ul>
         *     <li>'notes' (по умолчанию) — общая лексика;</li>
         *     <li>'queries' — короткие запросы;</li>
         *     <li>'names' — имена; </li>
         *     <li>'dates' — даты; </li>
         *     <li>'maps' — топонимы;</li>
         *     <li>'notes' — тексты;</li>
         *     <li>'numbers' — числа.</li>
         * </ul>
         * <p>Если параметр не указан, то используется
         * значение, заданное в глобальных настройках {@link settings}. Если в настройках значение не задано, то
         * используется модель по умолчанию — 'notes'. </p>
         * @param {String} [options.applicationName] Название приложения. Для некоторых приложений мы поддерживаем специальную логику. Пример - sandbox.
         * @param {String} [options.lang='ru-RU'] Язык, речь на котором следует распознавать. Возможные значения: 'ru-RU', 'en-US', 'tr-TR'.
         * <p>Если параметр не указан, то используется
         * значение, заданное в глобальных настройках {@link settings}. Если в настройках значение не задано, то по умолчанию
         * выбирается русский язык: 'ru-RU'. </p>
         * @param {ya.speechkit.FORMAT} [options.format=ya.speechkit.FORMAT.PCM16] Формат передачи аудио-сигнала.
         * @param {Boolean} [options.partialResults=true] Отправлять ли на сервер промежуточные результаты.
         * @param {Number} [options.utteranceSilence=120] Длительность промежутка тишины во время записи речи (в десятках миллисекунд). Как только встречается
         * такой перерыв в речи, запись звука останавливается, и записанный фрагмент речи отправляется на сервер.
         */
        start: function (options) {
            this.options = namespace.ya.speechkit._extend(
                                namespace.ya.speechkit._extend(
                                    {},
                                    namespace.ya.speechkit._defaultOptions()
                                ),
                                options);
            if (namespace.ya.speechkit.settings.langWhitelist.indexOf(this.options.lang) >= 0) {
                if (namespace.ya.speechkit._stream !== null) {
                    this._onstart();
                } else {
                    namespace.ya.speechkit.initRecorder(
                        this._onstart.bind(this),
                        this.options.errorCallback
                    );
                }
            } else {
                var old_error_callback = this.options.errorCallback;
                this.recorder = namespace.ya.speechkit.WebAudioRecognition(
                    namespace.ya.speechkit._extend(
                    this.options,
                    {
                        errorCallback: function (e) {
                            this.recorder = null;
                            old_error_callback(e);
                        }.bind(this)
                    }
                    ));
                this.recorder.start();
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
                namespace.ya.speechkit._extend(this.options,
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

                        this.options.initCallback(sessionId, code, 'yandex');
                    }.bind(this),
                    onResult: function (text, uttr, merge, words) {
                                this.proc += merge;
                                this.options.infoCallback({
                                    send_bytes: this.send_bytes,
                                    format: this.options.format,
                                    send_packages: this.send,
                                    processed: this.proc
                                });
                                this.options.dataCallback(text, uttr, merge, words);
                            }.bind(this),
                    onError: function (msg) {
                                if (this.recorder) {
                                    this.recorder.stop(function () { this.recorder = null; }.bind(this));
                                }
                                if (this.recognizer) {
                                    this.recognizer.close();
                                    this.recognizer = null;
                                }
                                this.options.errorCallback(msg);
                            }.bind(this),
                }));
            this.recognizer.start();
        },
        /**
         * Завершает сессию распознавания речи.
         * По завершении сессии будет вызвана функция-обработчик stopCallback.
         */
        stop: function () {
            if (this.recognizer) {
                this.recognizer.finish();
            }

            if (this.recorder) {
                this.recorder.stop(
                    function () {
                        this.recognizer = null;
                        this.recorder = null;
                    }.bind(this)
                );
            }
        },
        /**
         * Прерывает сессию распознавания речи (не дожидается финального результата распознавания).
         * По завершении сессии будет вызвана функция-обработчик stopCallback.
         */
        abort: function () {
            if (this.recognizer) {
                this.recognizer.close();
            }
            if (this.recorder) {
                this.recorder.stop(
                    function () {
                        this.recognizer = null;
                        this.recorder = null;
                    }.bind(this)
                );
            }
        },
        /**
         * Ставит сессию распознавания на паузу.
         * Чтобы соединение с сервером не прерывалось и можно было моментально возобновить распознавание,
         * на сервер периодически посылаются небольшие куски данных.
         */
        pause: function () {
            if (this.recorder) {
                this.recorder.pause();
            }
        },
        /**
         * Определяет, стоит ли на паузе сессия распознавания.
         * @returns {Boolean} true, если сессия распознавания речи стоит на паузе, false — иначе.
         */
        isPaused: function () {
            return (!this.recorder || this.recorder.isPaused());
        }
    };

    ya.speechkit.SpeechRecognition = SpeechRecognition;

    /**
     * Функция для распознавания коротких фрагментов речи.
     * <p> При вызове функции recognize() начинается запись звука с микрофона.
     * Как только наступает тишина более чем на одну секунду, запись
     * прекращается, и функция отправляет запрос на сервер для распознавания записанного фрагмента.</p>
     * <p>Приемлемое качество распознавания обеспечивается на фрагментах длительностью не более 10 секунд.
     * При более длительном фрагменте качество распознавания ухудшается.</p>
     * @static
     * @function
     * @name recognize
     * @param {Object} [options] Параметры распознавания речи.
     * @param {callback:SpeechRecognition.initCallback} [options.initCallback] Функция-обработчик, которая будет вызвана по факту
     * инициализации сессии распознавания.
     * @param {callback:SpeechRecognition.errorCallback} [options.errorCallback] Функция-обработчик, которая будет вызвана при возникновении ошибки
     * (все ошибки критичны и приводят к завершению сессии).
     * @param {callback:SpeechRecognition.recognitionDoneCallback} [options.doneCallback] Функция-обработчик, в которую будет отправлен результат распознавания речи.
     * @param {String} [options.apikey] API-ключ. По умолчанию принимает значение, указанное
     * в глобальных настройках {@link settings}.
     * @param {String} [options.model='notes'] Список доступных значений:
     * <ul>
     *     <li>'notes' (по умолчанию) — текст;</li>
     *     <li>'queries' — короткие запросы;</li>
     *     <li>'names' — имена; </li>
     *     <li>'dates' — даты; </li>
     *     <li>'maps' — топонимы;</li>
     *     <li>'notes' — тексты;</li>
     *     <li>'numbers' — числа.</li>
     * </ul>
     * <p>Если параметр не указан, то используется
     * значение, заданное в глобальных настройках {@link settings}. Если в настройках значение не задано, то
     * используется модель по умолчанию — 'notes'. </p>
     * @param {String} [options.applicationName] Название приложения. Для некоторых приложений мы поддерживаем специальную логику. Пример — sandbox.
     * @param {String} [options.lang='ru-RU'] Язык, речь на котором следует распознавать. Возможные значения: 'ru-RU', 'en-US', 'tr-TR'.
     * <p>Если параметр не указан, то используется
     * значение, заданное в глобальных настройках {@link settings}. Если в настройках значение не задано, то по умолчанию
     * выбирается русский язык: 'ru-RU'. </p>
     * @param {Boolean} [options.partialResults=true] Отправлять ли на сервер промежуточные результаты.
     * @param {Number} [options.utteranceSilence=120] Длительность промежутка тишины во время записи речи (в десятках миллисекунд). Как только встречается
     * такой перерыв в речи, запись звука останавливается, и записанный фрагмент речи отправляется на сервер.
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
     * Функция, в которую передается полностью распознанный фрагмент текста.
     * @param {String} text Распознанная речь.
     * @callback
     * @name recognitionDoneCallback
     * @memberOf SpeechRecognition
     */

    /**
     * Функция, которая будет вызвана после успешной инициализации сессии распознавания речи.
     * @callback
     * @name initCallback
     * @memberOf SpeechRecognition
     * @param {String} sessionId Идентификатор сессии.
     * @param {Number} code HTTP-статус, который будет содержаться в ответе сервера (200 в случае успеха).
     */

    /**
     * Функция, в которую будут переданы сообщения об ошибках.
     * @callback
     * @name errorCallback
     * @memberOf SpeechRecognition
     * @param {String} message Текст сообщения об ошибке.
     */

    /**
     * Функция для результатов распознавания речи.
     * @callback
     * @name dataCallback
     * @memberOf SpeechRecognition
     * @param {String} text Распознанный текст.
     * @param {Boolean} utterance Является ли данный текст финальным результатом распознавания.
     * @param {Number} merge Число обработанных запросов, по которым выдан ответ от сервера.
     */

    /**
     * В эту функцию будет передаваться техническая информация.
     * @callback
     * @name infoCallback
     * @memberOf SpeechRecognition.
     * @param {Number} send_bytes Сколько байт аудио-данных было передано на сервер.
     * @param {Number} send_packages Сколько пакетов аудио-данных было передано на сервер.
     * @param {Number} processed Количество пакетов, на которые ответил сервер.
     * @param {ya.speechkit.FORMAT} format Какой формат аудио используется.
     */

    /**
     * Функция, которая будет вызвана после остановки сессии распознавания речи.
     * @callback
     * @name stopCallback
     * @memberOf SpeechRecognition
     */
}(this));
