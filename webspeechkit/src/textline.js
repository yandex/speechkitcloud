(function (namespace) {
    'use strict';

    if (typeof namespace.ya === 'undefined') {
        namespace.ya = {};
    }
    if (typeof namespace.ya.speechkit === 'undefined') {
        namespace.ya.speechkit = {};
    }

    namespace.ya.speechkit._mic_on = '<svg version="1.1" id="Layer_1" ' +
    ' xmlns:sketch="http://www.bohemiancoding.com/sketch/ns"' +
    ' xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
    ' x="0px" y="0px" viewBox="0 0 112 112"' +
    ' enable-background="new 0 0 112 112" xml:space="preserve">' +
    ' <g id="tuts" sketch:type="MSPage">' +
    ' <g id="mic_ff" sketch:type="MSLayerGroup">' +
    ' <g sketch:type="MSShapeGroup">' +
    ' <circle id="path-1" fill="rgb(255, 204, 0)" cx="56" cy="56" r="56"/>' +
    ' </g>' +
    ' <g id="speechkit_vector-9" transform="translate(39.000000, 32.000000)" ' +
    ' sketch:type="MSShapeGroup" opacity="0.9">' +
    ' <path id="Shape" d="M17,4c2.8,0,5,2.3,5,5.2v15.6c0,2.9-2.2,5.2-5,5.2s-5-2.3-5-5.2V9.2C12,6.3,14.2,4,17,4 M17,0' +
    ' c-5,0-9,4.1-9,9.2v15.6c0,5.1,4,9.2,9,9.2s9-4.1,9-9.2V9.2C26,4.1,22,0,17,0L17,0z"/>' +
    ' <path id="Shape_1_" ' +
    ' d="M34,23v1.1C34,34,26.4,42,17,42S0,34,0,24.1V23h4v0.1C4,31.3,9.8,38,17,38s13-6.7,13-14.9V23H34z"/>' +
    ' <rect id="Rectangle-311" x="15" y="41" width="4" height="10"/>' +
    ' </g>' +
    ' </g>' +
    ' </g>' +
    ' </svg>';

    namespace.ya.speechkit._mic_off = '<svg version="1.1" id="Layer_1" ' +
    ' xmlns:sketch="http://www.bohemiancoding.com/sketch/ns"' +
    ' xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
    ' x="0px" y="0px" viewBox="0 0 112 112"' +
    ' enable-background="new 0 0 112 112" xml:space="preserve">' +
    ' <g id="tuts" sketch:type="MSPage">' +
    ' <g id="mic_ff" sketch:type="MSLayerGroup">' +
    ' <g id="speechkit_vector-9" transform="translate(39.000000, 32.000000)" ' +
    ' sketch:type="MSShapeGroup" opacity="0.9">' +
    ' <path id="Shape" d="M17,4c2.8,0,5,2.3,5,5.2v15.6c0,2.9-2.2,5.2-5,5.2s-5-2.3-5-5.2V9.2C12,6.3,14.2,4,17,4 M17,0' +
    ' c-5,0-9,4.1-9,9.2v15.6c0,5.1,4,9.2,9,9.2s9-4.1,9-9.2V9.2C26,4.1,22,0,17,0L17,0z"/>' +
    ' <path id="Shape_1_" ' +
    ' d="M34,23v1.1C34,34,26.4,42,17,42S0,34,0,24.1V23h4v0.1C4,31.3,9.8,38,17,38s13-6.7,13-14.9V23H34z"/>' +
    ' <rect id="Rectangle-311" x="15" y="41" width="4" height="10"/>' +
    ' </g>' +
    ' </g>' +
    ' </g>' +
    ' </svg>';

    namespace.ya.speechkit.Textline = function (target, options) {
        this.element = document.getElementById(target);
        this.textinput = document.createElement('input');
        this.textinput.style['text-align'] = 'center';
        this.textinput.style.height = '100%';
        this.textinput.style.width = '100%';
        this.textinput.style.backgroundImage = 'url(\'data:image/svg+xml;utf8,' +
                                                namespace.ya.speechkit._mic_off + '\')';
        this.textinput.style.backgroundRepeat = 'no-repeat';
        this.textinput.style.backgroundPosition = 'right center';
        this.element.appendChild(this.textinput);

        this.dict = null;

        var _this = this;

        this.textinput.onmousemove = function (event) {
            var rect = _this.textinput.getBoundingClientRect();
            if (event.clientX - rect.x > rect.width - rect.height)
            {
                _this.textinput.style.cursor = 'pointer';
            } else {
                _this.textinput.style.cursor = 'text';
            }
        };

        options.dataCallback = function (text, uttr, merge) {
            _this.textinput.value = text;
            if (uttr) {
                if (options.onInputFinished) {
                    options.onInputFinished(text);
                }
                _this.dict.stop();
            }
        };

        options.initCallback = function () {
            _this.textinput.style.backgroundImage = 'url(\'data:image/svg+xml;utf8,' + ya.speechkit._mic_on + '\')';
        };

        options.stopCallback = function () {
            _this.textinput.style.backgroundImage = 'url(\'data:image/svg+xml;utf8,' + ya.speechkit._mic_off + '\')';
            _this.dict = null;
        };

        this.textinput.onmousedown = function (event) {
            var rect = _this.textinput.getBoundingClientRect();

            if (event.clientX <= rect.width - rect.height) {
                return;
            }

            if (!_this.dict) {
                _this.dict = new ya.speechkit.SpeechRecognition();
            }
            if (_this.dict.isPaused())
            {
                _this.dict.start(options);
            } else {
                _this.dict.stop();
            }
        };

        return {
            destroy: function () {
                if (_this.dict) {
                    _this.dict.stop();
                }
                _this.element.removeChild(_this.textinput);
            },
        };
    };
}(this));
