(function (namespace) {
    'use strict';

    if (typeof namespace.ya === 'undefined') {
        namespace.ya = {};
    }
    if (typeof namespace.ya.speechkit === 'undefined') {
        namespace.ya.speechkit = {};
    }

    /**
     * Создает новый объект типа Recognizer.
     * @class Создает сессию и отправляет запрос на сервер для распознавания речи.
     * @name Recognizer
     * @param {Object} [options] Опции.
     * @param {callback:initCallback} [options.onInit] Функция-обработчик, которая будет вызвана после успешной инициализации
     * сессии.
     * @param {callback:dataCallback} [options.onResult] Функция-обработчик, которая будет вызвана после завершения распознавания речи.
     * @param {callback:errorCallback} [options.onError]
     * @param {String} [options.uuid=см. описание] UUID сессии. По умолчанию принимает значение, указанное
     * в настройках ya.speechkit.settings.uuid.
     * @param {String} [options.apikey] API-ключ. Если не задан, то используется ключ, указанный
     * в настройках ya.speechkit.settings.apikey.
     * @param {ya.speechkit.FORMAT} [options.format=ya.speechkit.FORMAT.PCM16] Формат аудиопотока.
     * @param {String} [options.url=см. описание] URL сервера, на котором будет производиться распознавание.
     * Если параметр не указан, то берется значение, заданное в настройках ya.speechkit.settings.asrUrl. По умолчанию оно равно
     * 'webasr.yandex.net/asrsocket.ws'.
     * @param {Boolean} [options.punctuation=true] Использовать ли пунктуацию.
     * @param {Boolean} [options.allowStrongLanguage=false] Отключить фильтрацию обсценной лексики.
     * @param {String} [options.model='notes'] Языковая модель, которая должна быть использована при распознавании.
     * Если параметр не указан, то используется значение, заданное в настройках ya.speechkit.model. Если в настройках значение не задано, то
     * используется модель 'notes'.
     * @param {String} [options.lang='ru-RU'] Язык распознавания. Возможные значения: 'ru-RU', 'en-US', 'tr-TR', 'uk-UA'.
     * <p>Если параметр не указан, то используется
     * значение, заданное в настройках ya.speechkit.lang. Если в настройках значение не задано, то по умолчанию
     * выбирается русский язык: 'ru-RU'. </p>
     * @param {String} [options.applicationName] Название приложения. Для некоторых приложений мы поддерживаем специальную логику. Пример - sandbox.
     */
    var Recognizer = function (options) {
        if (!(this instanceof namespace.ya.speechkit.Recognizer)) {
            return new namespace.ya.speechkit.Recognizer(options);
        }
        this.options = namespace.ya.speechkit._extend(
                        {apikey: namespace.ya.speechkit.settings.apikey,
                         uuid: namespace.ya.speechkit.settings.uuid,
                         applicationName: namespace.ya.speechkit.settings.applicationName,
                         url: namespace.ya.speechkit.settings.websocketProtocol +
                            namespace.ya.speechkit.settings.asrUrl,
                         onInit: function () {},
                         onResult: function () {},
                         onError: function () {},
                         punctuation: true,
                         allowStrongLanguage: false
                        },
                        options);

        // Backward compatibility
        this.options.key = this.options.apikey;
        this.options.format = this.options.format.mime;

        this.sessionId = null;
        this.socket = null;

        this.buffered = [];
        this.totaldata = 0;
    };

    Recognizer.prototype = /** @lends Recognizer.prototype */{
        /**
         * Send raw data to websocket.
         * @param data Any data to send to websocket (json string, raw audio data).
         * @private
         */
        _sendRaw: function (data) {
            if (this.socket) {
                this.socket.send(data);
            }
        },
        /**
         * Stringify JSON and send it to websocket.
         * @param {Object} json Object needed to be send to websocket.
         * @private
         */
        _sendJson: function (json) {
            this._sendRaw(JSON.stringify({type: 'message', data: json}));
        },
        /**
         * Запускает процесс распознавания.
         */
        start: function () {
            this.sessionId = null;
            try {
                this.socket = new WebSocket(this.options.url);
            } catch (e) {
                this.options.onError('Error on socket creation: ' + e);
                this.options.stopCallback();
                return;
            }

            this.socket.onopen = function () {
                // {uuid: uuid, key: key, format: audioFormat, punctuation: punctuation ...
                // console.log('Initial request: ' + JSON.stringify(this.options));
                this._sendJson(this.options);
            }.bind(this);

            this.socket.onmessage = function (e) {
                var message = JSON.parse(e.data);

                if (message.type == 'InitResponse'){
                    this.sessionId = message.data.sessionId;
                    this.options.onInit(message.data.sessionId, message.data.code);
                } else if (message.type == 'AddDataResponse'){
                    this.options.onResult(message.data.text, message.data.uttr, message.data.merge, message.data.words);
                    if (typeof message.data.close !== 'undefined' && message.data.close) {
                        this.close();
                    }
                } else if (message.type == 'Error'){
                    this.options.onError('Session ' + this.sessionId + ': ' + message.data);
                    this.close();
                } else {
                    this.options.onError('Session ' + this.sessionId + ': ' + message);
                    this.close();
                }
            }.bind(this);

            this.socket.onerror = function (error) {
                this.options.onError('Socket error: ' + error.message);
            }.bind(this);

            this.socket.onclose = function (event) {
            }.bind(this);
        },
        /**
         * Добавляет данные с аудио к потоку для распознавания речи.
         * Если сессия распознавания еще не была создана, то данные будут буферизованы и отправятся на сервер
         * по факту установления соединения.
         * @param {ArrayBuffer} data Буфер с аудио сигналом в формате PCM 16bit.
         */
        addData: function (data) {
            this.totaldata += data.byteLength;

            if (!this.sessionId) {
                this.buffered.push(data);
                return;
            }

            for (var i = 0; i < this.buffered.length; i++){
                this._sendRaw(new Blob([this.buffered[i]], {type: this.options.format}));
                this.totaldata += this.buffered[i].byteLength;
            }

            this.buffered = [];
            this._sendRaw(new Blob([data], {type: this.options.format}));
        },
        /**
         * Принудительно завершает запись звука и отсылает запрос (не закрывает сессию распознавания, пока не получит от сервера последний ответ).
         */
        finish: function () {
            this._sendJson({command: 'finish'});
        },
        /**
         * Завершает сессию распознавания речи, закрывая соединение с сервером.
         */
        close: function () {
            this.options.onInit = function () {};
            this.options.onResult = this.options.onInit;
            this.options.onError = this.options.onInit;

            if (this.socket) {
                this.socket.close();
                this.options.stopCallback();
            }
            this.socket = null;
        }
    };

    namespace.ya.speechkit.Recognizer = Recognizer;

    /**
     * Функция-обработчик, которая будет вызвана после успешной инициализации
     * сессии.
     * @callback
     * @name initCallback
     * @param {String} sessionId Идентификатор сессии.
     * @param {Number} code HTTP-статус, который будет содержаться в ответе сервера после инициализации сессии (200).
     * @memberOf Recognizer
     */

    /**
     * Функция-обработчик, которая будет вызвана в случае возникновения ошибки.
     * @callback
     * @name errorCallback
     * @param {String} message Текст сообщения об ошибке.
     * @memberOf Recognizer
     */

    /**
     * Функция-обработчик, которая будет вызвана после завершения распознавания речи.
     * @callback
     * @name dataCallback
     * @param {String} text Распознанный текст.
     * @param {Boolean} utterance Является ли данный текст финальным результатом распознавания.
     * @param {Number} merge Число обработанных запросов по которым выдан ответ. (Сколько пакетов с данными были соединены в этот результат).
     * @memberOf Recognizer
     */
}(this));
