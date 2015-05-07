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
     * Plays audio file
     * @param {String} url - URL of audio (browser internal or external)
     * @param {Function} callback - Callback to call when audio will stop
     * @memberof ya.speechkit
     */
    namespace.ya.speechkit.play = function (url, cb) {
        var audio = new Audio(url);
        audio.onended = cb || function () {};
        audio.play();
    };

    /**
     * Creates a new object for text-to-speech
     * @class
     * @classdesc Class for text-to-speech conversion
     * @param {TtsOptions} options - Options for Tts
     * @memberof ya.speechkit
     * @alias Tts
     */
    var Tts = function (options) {
        if (!(this instanceof namespace.ya.speechkit.Tts)) {
            return new namespace.ya.speechkit.Tts();
        }
        /**
         * @typedef {Object} TtsOptions
         * @property {String} ttsUrl - Url of tts server
         * @property {String} apiKey - Developer's API key {@link http://ya.ru}
         * @property {String} emotion - Emotion
         * @property {String} speaker - Speaker
         * @property {Number} speed - Speed of speech
         * @property {Number} pitch - Pitch
         */
        this.options = options;
    };

    Tts.prototype = {
        /**
         * Speaks text with text-to-speech technology
         * @param {String} text - Text ot speak
         * @param {Function} cb - Callback to call after all text message will be spoken
         * @param {TtsOptions} options - Options for Tts
         */
        say: function (text, cb, options) {
            var args = namespace.ya.speechkit._extend(
                            namespace.ya.speechkit._extend({
                                    apiKey: namespace.ya.speechkit.settings.apiKey,
                                    ttsUrl: namespace.ya.speechkit.settings.ttsUrl,
                                    emotion: 'neutral',
                                    speaker: 'omazh',
                                    speed: 1.0,
                                    pitch: 0,
                                },
                                this.options),
                            options);

            namespace.ya.speechkit.play(args.ttsUrl +
                        '/crafted?key=' + args.apiKey +
                        '&speaker=' + args.speaker +
                        '&emotion=' + args.emotion +
                        '&pitch_shift=' + args.pitch +
                        '&speed=' + args.speed +
                        '&text=' + text,
                        cb);
        },

        /**
         * Gets available speakers
         * @param {String} ttsUrl - URL of Yandex.TTS server (leave it empty)
         * @returns {Object} JSON with speakers and their emotions
         */
        speakers: function (ttsUrl) {
            return new Promise(function (resolve, reject) {

                if (speakersCache) {
                    resolve(speakersCache);
                } else {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', (ttsUrl || this.options.ttsUrl) + '/speakers');

                    xhr.onreadystatechange = function () {
                        if (this.readyState == 4) {
                            if (this.status == 200) {
                                try {
                                    speakersCache = JSON.parse(this.responseText);
                                    resolve(speakersCache);
                                } catch (ex) {
                                    reject(ex);
                                }
                            } else {
                                reject('Can\'t get speakers list!');
                            }
                        }
                    };

                    xhr.send();
                }
            }.bind(this));
        }
    };

    namespace.ya.speechkit.Tts = Tts;
}(this));
