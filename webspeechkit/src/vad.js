(function(webspeechkit){
	var Vad = function(options) {
		this.init(options);
	};

        webspeechkit.Vad = function(options) {
            return new Vad(options);
        };

	Vad.prototype = {
		init: function(options) {
			// The default options
			this.options = {
				energy_offset: 1e-8, // The initial offset.
				energy_threshold_ratio_pos: 2, // Signal must be twice the offset
				energy_threshold_ratio_neg: 0.5, // Signal must be half the offset
				// energy_integration: 100, // Offset change per iteration. ie., a 1/100th of the signal size
				energy_integration: 1, // Size of integration change compared to the signal per second.
                                speechStart: function() {},
                                speechEnd: function() {},
				filter: [
					{f: 200, v:0}, // 0 -> 200 is 0
					{f: 2000, v:1} // 200 -> 2k is 1
				],
                                recorder: null
			};
			// Read in instancing options.
			for(var option in options) {
				if(options.hasOwnProperty(option)) {
					this.options[option] = options[option];
				}
			}

			// The Web Audio API context

                        this.context = this.options.recorder.context;
                        this.analyserNode = this.options.recorder.getAnalyserNode();

			// Calculate time relationships
			this.hertzPerBin = this.context.sampleRate / this.analyserNode.fftSize;
			this.iterationFrequency = this.hertzPerBin;
			this.iterationPeriod = 1 / this.iterationFrequency;

			this.setFilter(this.options.filter);

			this.ready = {};
			this.vadState = false; // True when Voice Activity Detected

			// Energy detector props
			this.energy_offset = this.options.energy_offset;
			this.energy_threshold_pos = this.energy_offset * this.options.energy_threshold_ratio_pos;
			this.energy_threshold_neg = this.energy_offset * this.options.energy_threshold_ratio_neg;

			this.voiceTrend = 0;
			this.voiceTrendMax = 10;
			this.voiceTrendMin = -10;
			this.voiceTrendStart = 5;
			this.voiceTrendEnd = -5;

			// Setup local storage of the Linear FFT data
			this.floatFrequencyDataLinear = new Float32Array(this.analyserNode.frequencyBinCount);
		},
		update: function() {
			// Update the local version of the Linear FFT
                        var fft = new Float32Array(this.analyserNode.frequencyBinCount);
                        this.analyserNode.getFloatFrequencyData(fft);
			for(var i = 0, iLen = fft.length; i < iLen; i++) {
				this.floatFrequencyDataLinear[i] = Math.pow(10, fft[i] / 10);
			}
			this.ready = {};
                        this.monitor();
		},
		setFilter: function(shape) {
			this.filter = [];
			for(var i = 0, iLen = this.analyserNode.fftSize / 2; i < iLen; i++) {
				this.filter[i] = 0;
				for(var j = 0, jLen = shape.length; j < jLen; j++) {
					if(i * this.hertzPerBin < shape[j].f) {
						this.filter[i] = shape[j].v;
						break; // Exit j loop
					}
				}
			}
		},
		getEnergy: function() {
			if(this.ready.energy) {
				return this.energy;
			}

			var energy = 0;
			var fft = this.floatFrequencyDataLinear;

			for(var i = 0, iLen = fft.length; i < iLen; i++) {
				energy += this.filter[i] * fft[i] * fft[i];
			}

			this.energy = energy;
			this.ready.energy = true;

			return energy;
		},
		monitor: function() {
			var self = this;
			var energy = this.getEnergy();
			var signal = energy - this.energy_offset;

			if(signal > this.energy_threshold_pos) {
				this.voiceTrend = (this.voiceTrend + 1 > this.voiceTrendMax) ? this.voiceTrendMax : this.voiceTrend + 1;
			} else if(signal < -this.energy_threshold_neg) {
				this.voiceTrend = (this.voiceTrend - 1 < this.voiceTrendMin) ? this.voiceTrendMin : this.voiceTrend - 1;
			} else {
				// voiceTrend gets smaller
				if(this.voiceTrend > 0) {
					this.voiceTrend--;
				} else if(this.voiceTrend < 0) {
					this.voiceTrend++;
				}
			}

			var start = false, end = false;
			if(this.voiceTrend > this.voiceTrendStart) {
				// Start of speech detected
				start = true;
			} else if(this.voiceTrend < this.voiceTrendEnd) {
				// End of speech detected
				end = true;
			}

			// Integration brings in the real-time aspect through the relationship with the frequency this functions is called.
			var integration = signal * this.iterationPeriod * this.options.energy_integration;

			// Idea?: The integration is affected by the voiceTrend magnitude? - Not sure. Not doing atm.

			// The !end limits the offset delta boost till after the end is detected.
			if(integration > 0 || !end) {
				this.energy_offset += integration;
			} else {
				this.energy_offset += integration * 10;
			}
			this.energy_offset = this.energy_offset < 0 ? 0 : this.energy_offset;
			this.energy_threshold_pos = this.energy_offset * this.options.energy_threshold_ratio_pos;
			this.energy_threshold_neg = this.energy_offset * this.options.energy_threshold_ratio_neg;

			// Broadcast the messages
			if(start && !this.vadState) {
				this.vadState = true;
                                this.options.speechStart();
			}
			if(end && this.vadState) {
				this.vadState = false;
                                this.options.speechEnd();
			}
			return signal;
		}
	};
	return Vad;
}(window.webspeechkit));
