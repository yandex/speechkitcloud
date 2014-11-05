window.webspeechkit.Dictation = function(asr_url, uuid, apikey) { 
    var backref = this;
        backref.send = 0;
        backref.send_bytes = 0;
        backref.proc = 0;
        backref.bufsize = 1024;

        backref.webSocketPath = function(){
            var loc = window.location, new_uri;
            if (loc.protocol === "https:") {
                new_uri = "wss:";
            } else {
                new_uri = "ws:";
            }
            new_uri += "//" ;//+ loc.host;
            new_uri += asr_url;
            return new_uri;
        }

        backref.start = function(format, samplerate, initCallback, errorCallback, dataCallback, infoCallback) {
            if (webspeechkit.recorderInited) {
                backref.onstart(format, samplerate, initCallback, errorCallback, dataCallback, infoCallback);
            }
            else {
                webspeechkit.initRecorder(
                    function(){
                        backref.onstart(format, samplerate, initCallback, errorCallback, dataCallback, infoCallback);
                    },
                    function(err){
                        errorCallback("Could not init AudioContext: " + err); 
                    }
                )               
            }
        }

        backref.onstart = function(format, samplerate, initCallback, errorCallback, dataCallback, infoCallback) {
            format = format || "pcm";
            backref.send = 0;
            backref.send_bytes = 0;
            backref.proc = 0;


            backref.recorder = new webspeechkit.Recorder(backref.bufsize, 1, function(){
                errorCallback("Failed to create Recorder");
            }, null, samplerate);

            samplerate = samplerate || backref.recorder.context.sampleRate;
            var format_string = "audio/x-speex";
            if (format != "speex")
                format_string = "audio/x-pcm;bit=16;rate=" + samplerate;

            backref.recognizer = new webspeechkit.Recognizer(
                backref.webSocketPath(),
                uuid, 
                apikey, 
                format_string,
            {
                onInit: function(sessionId, code){
                    initCallback(sessionId, code);
                    backref.recorder.start(function(data){
                        backref.send++;
                        backref.send_bytes += data.byteLength;
                        infoCallback({
                                    send_bytes: backref.send_bytes,
                                    format: format,
                                    samplerate: samplerate,
                                    send_packages: backref.send,
                                    processed: backref.proc
                                    });
                        backref.recognizer.addData(data);
                    }, format)
                },
                onResult: function(text, uttr, merge){
                    backref.proc += merge;
                    dataCallback(text, uttr, merge); 
                },
                onError: function(msg){
                    backref.recorder.stop(function(){});
                    errorCallback(msg);
                }
            });
            };

            backref.stop = function() {
                backref.recorder.stop(
                                function () {
                                    backref.recognizer.close()
                                }
                            );
            };
};

