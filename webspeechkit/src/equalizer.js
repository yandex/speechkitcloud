(function (namespace) {
    'use strict';

    if (typeof namespace.ya === 'undefined') {
        namespace.ya = {};
    }
    if (typeof namespace.ya.speechkit === 'undefined') {
        namespace.ya.speechkit = {};
    }

    namespace.ya.speechkit.Equalizer = function (target, recorder) {
        this.recorder = recorder;
        this.element = document.getElementById(target);
        this.element.style.textAlign = 'center';
        this.element.innerText = '';
        this.graf = document.createElement('canvas');
        this.graf.style.width = '100%';
        this.graf.style.height = '100%';
        this.graf.width = 1000;

        this.element.appendChild(this.graf);

        if (!navigator.cancelAnimationFrame) {
            navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame ||
                                             navigator.mozCancelAnimationFrame;
        }
        if (!navigator.requestAnimationFrame) {
            navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame ||
                                              navigator.mozRequestAnimationFrame;
        }

        this.refID = null;

        this.startDrawRealtime();
    };

    namespace.ya.speechkit.Equalizer.prototype = {
        destroy: function () {
            this.stopDrawRealtime();
            this.element.removeChild(this.graf);
        },
        stopDrawRealtime: function () {
            window.cancelAnimationFrame(this.rafID);
            this.rafID = null;
        },
        startDrawRealtime: function () {
            var _this = this;
            function updateAnalysers(time) {
                if (!_this.analyserNode) {
                    if (_this.recorder) {
                        _this.analyserNode = _this.recorder.getAnalyserNode();
                        _this.context = _this.recorder.context;
                    } else {
                        return;
                    }
                }

                var canvasWidth = _this.graf.width;
                var canvasHeight = _this.graf.height;
                var analyserContext = _this.graf.getContext('2d');

                var SPACING = 2;
                var BAR_WIDTH = 1;
                var numBars = Math.round(canvasWidth / SPACING);
                var freqByteData = new Uint8Array(_this.analyserNode.frequencyBinCount);

                _this.analyserNode.getByteFrequencyData(freqByteData);

                analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
                analyserContext.fillStyle = '#F6D565';
                analyserContext.lineCap = 'round';
                var multiplier = _this.analyserNode.frequencyBinCount / numBars;

                for (var i = 0; i < numBars; ++i) {
                    var magnitude = 0;
                    var offset = Math.floor(i * multiplier);
                    for (var j = 0; j < multiplier; j++) {
                        magnitude += freqByteData[offset + j];
                    }
                    magnitude = magnitude / multiplier / 2;
                    analyserContext.fillStyle = 'hsl( ' + Math.round(i * 60 / numBars) + ', 100%, 50%)';
                    analyserContext.fillRect(i * SPACING, canvasHeight, BAR_WIDTH, -magnitude);
                }
                _this.rafID = window.requestAnimationFrame(updateAnalysers);
            }

            this.rafID = window.requestAnimationFrame(updateAnalysers);
        }
    };
}(this));
