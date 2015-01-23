(function(webspeechkit){
    webspeechkit.Spotter = function (asr_url, uuid, apikey) {
        this.send = 0;
        this.send_bytes = 0;
        this.proc = 0;
        this.recorder = null;        
        this.recognizer = null;
        this.vad = null;
        this.asr_url = asr_url;
        this.uuid = uuid;
        this.apikey = apikey;
        var backref = this;

        this.webSocketPath = function() {
            if ((this.asr_url.indexOf("wss://")==0) || (this.asr_url.indexOf("ws://")==0))
                return this.asr_url;
            var loc = window.location, new_uri;
            if (loc.protocol === "https:") {
                new_uri = "wss:";
            } else {
                new_uri = "ws:";
            }
            new_uri += "//" + this.asr_url;
            return new_uri;
        };

        this.start= function(options) {
            var donothing = function(){};
            this.options = {
                initCallback: donothing,
                errorCallback: donothing,
                dataCallback: donothing,
                infoCallback: donothing,
                stopCallback: donothing,
                punctuation: false,
                format: webspeechkit.FORMAT.PCM16,
                vad: false,
                speechStart: donothing,
                speechEnd: donothing,
                bufferSize: 1024,
		phrases: []
            };
            
            for(var option in options) {
                if(this.options.hasOwnProperty(option)) {
                    this.options[option] = options[option];
                }
            }

            if (webspeechkit.recorderInited) {
                this.onstart();
            }
            else {
                webspeechkit.initRecorder(
                    this.onstart.bind(this),
                    this.options.errorCallback 
                )               
            }
        };
        
        this.onstart = function() {
            if (this.recorder && this.recorder.isPaused())
                this.recorder.start();

            if (this.recognizer)
                return;
            
            this.send = 0;
            this.send_bytes = 0;
            this.proc = 0;

            if (!this.recorder) {
                this.recorder = new webspeechkit.Recorder(this.options.bufferSize, 1, function(){
                    this.options.errorCallback("Failed to create Recorder");
                }.bind(this), null, this.options.format.samplerate);
                if (this.options.vad)
                    this.vad = new webspeechkit.Vad({recorder: this.recorder,
                                                speechStart: this.options.speechStart,
                                                speechEnd: this.options.speechEnd});
            }

            this.recognizer = new webspeechkit.Recognizer(
                this.webSocketPath(),
		{
		    onInit: function(sessionId, code){
			backref.recorder.start(function(data){
			    if (backref.options.vad && backref.vad) {
				backref.vad.update();
			    }
			    backref.send++;
			    backref.send_bytes += data.byteLength;
			    backref.options.infoCallback({
					send_bytes: backref.send_bytes,
					format: backref.options.format,
					send_packages: backref.send,
					processed: backref.proc
					});
			    backref.recognizer.addData(data);
			}, backref.options.format)
			backref.options.initCallback(sessionId, code);
		    },
		    onResult: function(text, uttr, merge){
			backref.proc += merge;
			backref.options.dataCallback(text, uttr, merge); 
		    },
		    onError: function(msg){
			backref.recorder.stop(function(){});
			backref.recognizer.close()
			backref.recognizer = null;
			backref.options.errorCallback(msg);
		    }
		},
		{
		    uuid : this.uuid, 
		    key : this.apikey, 
		    format: this.options.format.mime,
		    phrases: this.options.phrases
		});
            
            this.recognizer.start();
        };
        
        this.stop = function() {
            if (backref.recognizer)
                backref.recognizer.close();
            backref.recorder.stop(
                function () {
                    backref.recognizer = null;
                    backref.options.stopCallback();
                }
            );
        };
        
        this.pause = function() {
            backref.recorder.pause();
        };
        
        this.isPaused = function() {
            return (!backref.recorder || backref.recorder.isPaused());                    
        };
    };
}(window.webspeechkit));
