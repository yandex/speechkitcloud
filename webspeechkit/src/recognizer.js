(function (namespace) {
    'use strict';

    if (typeof namespace.ya === 'undefined') {
        namespace.ya = {};
    }
    if (typeof namespace.ya.speechkit === 'undefined') {
        namespace.ya.speechkit = {};
    }

    /**
     * Creates a new recognition session
     * @class
     * @classdesc Class for low-level recognition process control
     * @param {Object} options Set of callbacks for initialization, recoginition and error handling
     * @param {Recognizer~initCallback} options.onInit - Callback to be called upon successful session initialization
     * @param {Recognizer~dataCallback} options.onResult Callback to be called with recognized data
     * @param {Recognizer~errorCallback} options.onError Callback to be called upon error
     * @param {String} options.uuid - Recognition session UUID (defaults to ya.speechkit.settings.uuid)
     * @param {String} options.key - API key (defaults to ya.speechkit.settings.apiKey)
     * @param {ya.speechkit.FORMAT} options.format - Format of audio stream (defaults to ya.speechkit.settings.format)
     * @param {String} options.url - URL for recognition process (defaults to ya.speechkit.settings.asrUrl)
     * @param {Boolean} options.punctuation - Will recognition try to make punctuation or not (defaults to True)
     * @param {String} options.model - Model for recognition (defaults to ya.speechkit.settings.model)
     * @param {String} options.lang - Language for recognition (defaults to ya.speechkit.settings.lang)
     * @memberof ya.speechkit
     * @alias Recognizer
     */
    var Recognizer = function (options) {
        if (!(this instanceof namespace.ya.speechkit.Recognizer)) {
            return new namespace.ya.speechkit.Recognizer();
        }
        this.options = namespace.ya.speechkit._extend(
                        {key: namespace.ya.speechkit.settings.apiKey,
                         uuid: namespace.ya.speechkit.settings.uuid,
                         url: namespace.ya.speechkit.settings.websocketProtocol +
                            namespace.ya.speechkit.settings.asrUrl,
                         onInit: function () {},
                         onResult: function () {},
                         onError: function () {},
                         punctuation: true,
                        },
                        options);
        this.sessionId = null;
        this.socket = null;

        this.buffered = [];
        this.totaldata = 0;
    };

    Recognizer.prototype = {
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
         * Starts recognition process
         */
        start: function () {
            this.socket = new WebSocket(this.options.url);

            this.socket.onopen = function () {
                // {uuid: uuid, key: key, format: audioFormat, punctuation: punctuation ...
                // console.log("Initial request: " + JSON.stringify(this.options));
                this._sendJson(this.options);
            }.bind(this);

            this.socket.onmessage = function (e) {
                var message = JSON.parse(e.data);

                if (message.type == 'InitResponse'){
                    this.sessionId = message.data.sessionId;
                    this.options.onInit(message.data.sessionId, message.data.code);
                } else if (message.type == 'AddDataResponse'){
                    this.options.onResult(message.data.text, message.data.uttr, message.data.merge);
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
         * Sends data for recognition
         * @description If there is no active session, then data will be buffered and sent after session establishment
         * @param {ArrayBuffer} data Raw audio data
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
         * Closes recognition session
         */
        close: function () {
            this.options = {onInit: function () {}, onResult: function () {}, onError: function () {}};

            if (this.socket) {
                this.socket.close();
            }
            this.socket = null;
        }
    };

    namespace.ya.speechkit.Recognizer = Recognizer;

    /**
     * Callback for successful recognition session initialization
     * @callback Recognizer~initCallback
     * @param {String} sessionId - Session identifier
     * @param {Number} code - Http status of initialization response
     */

    /**
     * Callback for recognition error message
     * @callback Recognizer~errorCallback
     * @param {String} message - Error message
     */

    /**
     * Callback for recognition error message
     * @callback Recognizer~dataCallback
     * @param {String} text - Recognized text
     * @param {Boolean} utterance - Is this a final text result for this utterance
     * @param {Number} merge - How many requests were merged in this response
     */
}(this));
