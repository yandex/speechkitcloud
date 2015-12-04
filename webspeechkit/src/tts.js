(function (namespace) {
    'use strict';

    if (typeof namespace.ya === 'undefined') {
        namespace.ya = {};
    }
    if (typeof namespace.ya.speechkit === 'undefined') {
        namespace.ya.speechkit = {};
    }

    var speakersCache = null;

    /**
     * Воспроизводит аудиофайл.
     * @function
     * @static
     * @param {String | BLOB} url URL, по которому доступен либо аудио-файл, либо звук в формате BLOB.
     * @param {Function} [cb] Функция-обработчик, которая будет вызвана после завершения воспроизведения.
     * @name play
     */
    namespace.ya.speechkit.play = function (url, cb) {
        var audio = new Audio(url);
        audio.volume = 1.0;
        audio.onended = cb || function () {};
        audio.play();
    };

    /**
     * @class Класс, предназначенный для использования технологии синтеза речи (озвучивания текста).
     * @name Tts
     * @param {TtsOptions} [options] Опции.
     * @param {String} [options.apiKey] API-ключ (если в настройках ключ не был указан, то в конструкторе его необходимо указать).
     * @param {String} [options.emotion='neutral'] Эмоциональная окраска голоса. Доступные значения:
     * <ul>
     *     <li>'neutral' - нейтральный (по умолчанию);</li>
     *     <li>'good' - доброжелательный;</li>
     *     <li>'evil' - злой.</li>
     * </ul>
     * @param {Array} [options.emotions] Массив эмоций вида [['emotion1', weight1], ['emotion2', weight2]], предназначенный для взвешенного смешивания эмоций
     * @param {String} [options.speaker='omazh'] Голос для озвучивания. Список доступных значений можно получить вызвав функцию Tts.speakers:
     * * <ul>
     *     <li>женские голоса: 'omazh' (по умолчанию) и 'jane';</li>
     *     <li>'мужские голоса: 'zahar' и 'ermil'.</li>
     * </ul>
     * @param {Array} [options.speakers] Массив голосов вида [['voice1', weight1], ['voice2', weight2]], предназначенный для взвешенного смешивания голосов
     * @param {String} [options.gender] Пол говорящего, Доступный значения: 'male', 'female'
     * @param {Array} [options.genders] Массив полов вида [['gender1', weight1], ['gender2', weight2]], предназначенный для взвешенного смешивания полов говорящего
     * @param {Number} [options.speed=1.0] Скорость воспроизведения. Можно установить в диапазоне от 0.3 до 3.
     * @param {Boolean} [options.fast=false] Использовать "быстрый" синтез, который ускоряет генерацию звука путём уменьшения его качества
     * @param {String} [options.lang='ru-RU'] Язык текста, который надо произнести. Доступные значения: 'ru-RU', 'en-EN', 'tr-TR', 'uk-UA'
     * @param {Float} [options.speed=1.0] Скорость синтеза речи, принимает значения от 0.0 (медленно) до 2.0 (быстро)
     */
    var Tts = function (options) {
        if (!(this instanceof namespace.ya.speechkit.Tts)) {
            return new namespace.ya.speechkit.Tts(options);
        }
        var _this = this;
        /**
         * Опции озвучивания текста.
         * @type TtsOptions
         * @name Tts.options
         * @field
         */
        this.options = namespace.ya.speechkit._extend(
                        {
                            apiKey: namespace.ya.speechkit.settings.apiKey,
                            uuid: namespace.ya.speechkit.settings.uuid,
                            url: namespace.ya.speechkit.settings.websocketProtocol +
                                namespace.ya.speechkit.settings.ttsStreamUrl,
                            infoCallback: function () {},
                            errorCallback: function (msg) {
                                                console.log(msg);
                                            },
                        },
                        options);
        this.sessionId = null;
        this.socket = null;

        this.buffered = [];

    };

    Tts.prototype = /** @lends Tts.prototype */{
        /**
         * Send raw data to websocket
         * @param data Any data to send to websocket (json string, raw audio data)
         * @private
         */
        _sendRaw: function (data) {
            if (this.socket) {
                this.socket.send(data);
            }
        },
        /**
         * Stringify JSON and send it to websocket
         * @param {Object} json Object needed to be send to websocket
         * @private
         */
        _sendJson: function (json) {
            this._sendRaw(JSON.stringify({type: 'message', data: json}));
        },
        /**
         * Озвучивание текста.
         * @param {String} text Текст.
         * @param {Function} [cb] Функция-обработчик, которая будет вызвана по завершении воспроизведения.
         * @param {TtsOptions} [options] Опции.
         */
        say: function (text, cb, options) {            
            this.speak(
                namespace.ya.speechkit._extend(
                this.options,
                    namespace.ya.speechkit._extend(
                        {
                            text: text,
                            dataCallback: function (blob) {
                                var url = URL.createObjectURL(blob);
                                namespace.ya.speechkit.play(url, cb);
                            }
                        },
                    options)
                )
            );
        },
        /**
         * Озвучивание текста.
         * @param {TtsOptions} [options] Опции.
         */
        speak: function (options) {
            var opts = namespace.ya.speechkit._extend(
                            namespace.ya.speechkit._extend(
                            {},
                            this.options),
                        options);
            try {
                this.socket = new WebSocket(opts.url);
            } catch (e) {
                opts.errorCallback('Error on socket creation: ' + e);
                return;
            }

            var context = namespace.ya.speechkit.audiocontext || new namespace.ya.speechkit.AudioContext();
            namespace.ya.speechkit.audiocontext = context;

            this.socket.onopen = function () {
                this._sendJson(opts);
            }.bind(this);

            var play_queue = [];
            var playing = false;

            this.socket.binaryType = 'arraybuffer';

            this.socket.onmessage = function (e) {
                var message = {};
                if (e.data && e.data[0] == '{') {
                    try {
                        message = JSON.parse(e.data);
                    } catch (ex) {
                        message = {type: 'Audio', data: e.data};
                    }
                } else {
                    message = {type: 'Audio', data: e.data};
                }
                if (message.type == 'InitResponse') {
                    this.sessionId = message.data.sessionId;
                } else if (message.type == 'Error') {
                    opts.errorCallback('Session ' + this.sessionId + ': ' + message.data);
                    this.socket.close();
                } else if (message.type == 'Phonemes') {
                    opts.infoCallback(message.data);
                } else if (message.type == 'Audio') {
                    play_queue.push(message.data);
                } else {
                    opts.errorCallback('Session ' + this.sessionId + ': ' + message);
                    this.socket.close();
                }
            }.bind(this);

            this.socket.onerror = function (error) {
                opts.errorCallback('Socket error: ' + error.message);
            }.bind(this);

            this.socket.onclose = function (event) {
                var res = Array.prototype.concat.apply([], play_queue);
                var blob = new Blob(res, {type: 'audio/x-wav'});
                if (typeof opts.dataCallback !== 'undefined') {
                    opts.dataCallback(blob);
                } else {
                    var url = URL.createObjectURL(blob);
                    namespace.ya.speechkit.play(url, opts.stopCallback);
                }
            }.bind(this);
        },
        /**
         * Возвращает список доступных голосов и эмоций.
         * @returns {Object} JSON-объект, содержащий набор доступных голосов и эмоций.
         */
        speakers: function (lang) {
            return new Promise(function (resolve, reject) {

                if (speakersCache) {
                    resolve(speakersCache);
                } else {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', this.options.url.replace('wss://', 'https://')
                                                    .replace('ws://', 'http://')
                                                    .replace('ttssocket.ws', 'speakers?engine=ytcp&lang=' + (lang || '')));

                    xhr.onreadystatechange = function () {
                        if (this.readyState == 4) {
                            if (this.status == 200) {
                                try {
                                    speakersCache = JSON.parse(this.responseText);
                                    resolve(speakersCache);
                                } catch (ex) {
                                    reject(ex.message);
                                }
                            } else {
                                reject('Can\'t get speakers list!');
                            }
                        }
                    };

                    xhr.send();
                }
            }.bind(this));
        },
    };

    namespace.ya.speechkit.Tts = Tts;
}(this));

