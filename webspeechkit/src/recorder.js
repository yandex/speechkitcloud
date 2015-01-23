(function(window){

 window.webspeechkit = {
    recorderInited: false,
    FORMAT : {
        PCM8: {format: 'pcm', samplerate: 8000, mime: "audio/x-pcm;bit=16;rate=8000"},
        PCM16: {format: 'pcm', samplerate: 16000, mime: "audio/x-pcm;bit=16;rate=16000"},
        PCM44: {format: 'pcm', samplerate: 44100, mime: "audio/x-pcm;bit=16;rate=44100"},
        SPEEX8: {format: 'speex', samplerate: 8000, mime: "audio/x-speex"},
        SPEEX16: {format: 'speex', samplerate: 16000, mime: "audio/x-speex"}
        }
};

 var scriptPath = function () {
    var scripts = document.getElementsByTagName('script');
    var path = '';
    if(scripts && scripts.length>0) {
        for(var i in scripts) {
            if(scripts[i].src && scripts[i].src.match(/\/recorder.js$/)) {
                path = scripts[i].src.replace(/(.*)\/recorder.js$/, '$1');
                break;
            }
        }
    }
    return path;
 };

 var WORKER_PATH = scriptPath()+'/recorderWorker.js';


 function Recorder(stream)
 {
    function RecorderImpl(bufferSize, channelCount, onError, workerPath, outSampleRate)
    {
        this.bufferLen = bufferSize || 4096;
        this.channelCount = Math.max(1, Math.min(channelCount || 2, 2)); // 1 or 2, defaults to 2
        this.context = webspeechkit.audiocontext || new AudioContext();
        webspeechkit.audiocontext = this.context;

        this.outSampleRate = outSampleRate || this.context.sampleRate


        this.inputPoint = this.context.createBiquadFilter();
        this.inputPoint.type = "lowpass";
        this.inputPoint.frequency.value = this.outSampleRate;
        this.inputPoint.Q.value = 1;
        this.inputPoint.gain.value = 5;

        this.audioInput = this.context.createMediaStreamSource(stream);
        this.audioInput.connect(this.inputPoint);

        if(!this.context.createScriptProcessor){
            this.node = this.context.createJavaScriptNode(this.bufferLen, 2, this.channelCount);
        } else {
            this.node = this.context.createScriptProcessor(this.bufferLen, 2, this.channelCount);
        }

        this.inputPoint.connect(this.node);
        this.node.connect(this.context.destination);

        this.worker = new Worker(workerPath || WORKER_PATH);

        this.recording = false;

        this.paused = false;
        this.lastDataOnPause = 0;

        this.nullsArray = [];

        this.currCallback;
        this.buffCallback;
        this.startCallback;

        this.node.onaudioprocess = function(e){

            if (!this.recording) return;
            
            if (this.paused) {
                if (Number(new Date()) - this.lastDataOnPause > 2000) {
                    this.lastDataOnPause = Number(new Date());
                    this.worker.postMessage({
                        command: 'record',
                        buffer: [
                            this.nullsArray,
                            this.nullsArray
                        ]
                    });
                }
            }
            else{
                this.worker.postMessage({
                    command: 'record',
                    buffer: [
                        e.inputBuffer.getChannelData(0),
                        e.inputBuffer.getChannelData(1)
                    ]
                });
            }
        }.bind(this);

        this.worker.onmessage = function(e){
            if (e.data.command == 'int16stream')
            {
                var data = e.data.buffer;

                if (this.startCallback) {
                    this.startCallback(data);
                }
            }
            else  if (e.data.command == 'getBuffers' && this.buffCallback)
            {
                this.buffCallback(e.data.blob)
            }
            else if (e.data.command == 'clear' && this.currCallback)
            {
                this.currCallback();
            }
            else if (this.currCallback)
            {
                this.currCallback(e.data.blob);
            }
        }.bind(this);

    };

    RecorderImpl.prototype = {
        pause: function() {
            this.paused = true;
            this.lastDataOnPause = Number(new Date());
        }
        ,
        getAudioContext: function() {
            return this.context;
        }
        ,
        getAnalyserNode: function() {
            var analyserNode = this.context.createAnalyser();
            analyserNode.fftSize = 2048;
            this.inputPoint.connect(analyserNode);
            return analyserNode;
        }
        ,
        isPaused: function() {
            return this.paused;
        }
        ,
        start: function(cb, format) {
            if (this.isPaused()) {
                this.paused = false;
                return;
            }

            this.outSampleRate = format.samplerate;
            this.inputPoint.frequency.value = this.outSampleRate;

            this.startCallback = cb;
            this.worker.postMessage({
                command: 'init',
                config: {
                    sampleRate: this.context.sampleRate,
                    format: format || webspeechkit.FORMAT.PCM44,
                    bufSize: this.bufferLen
                }
             });

             this.nullsArray = [];
             for (var i =0; i< this.bufferLen; i++)
                this.nullsArray.push(0);

            this.clear(function() {this.recording = true;}.bind(this));
        }
        ,
        stop: function(cb){
            this.recording = false;

            this.exportWAV(function(blob)
            {
                cb(blob);
            }
            );
        }
        ,
        isRecording: function(){
            return this.recording;
        }
        ,
        clear: function(cb){
            this.currCallback = cb;
            this.worker.postMessage({ command: 'clear' });
        }
        ,
        getBuffers: function(cb) {
            this.buffCallback = cb;
            this.worker.postMessage({ command: 'getBuffers' })
        }
        ,
        exportWAV: function(cb, type){
            this.currCallback = cb;
            type = type || 'audio/wav';

            if (!this.currCallback) throw new Error('Callback not set');

            this.worker.postMessage({
                command: "export"+(this.channelCount!=2 && "Mono" || "")+"WAV",
                type: type
            });
        }        
    };

    return RecorderImpl;
} 
 
 window.webspeechkit.initRecorder = function(initSuccess, initFail)
 {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    
     navigator.getUserMedia = (navigator.getUserMedia ||
         navigator.mozGetUserMedia ||
         navigator.msGetUserMedia ||
         navigator.webkitGetUserMedia);
    
     window.webspeechkit.Recorder = null;
    
     var badInitialization = function(err) {
        window.webspeechkit.recorderInited = false;
        window.webspeechkit.Recorder = function()
        {
            return null;
        }
        initFail("Could not init AudioContext: " + err);
     }
    
     if (navigator.getUserMedia)
     {
      navigator.getUserMedia(
        {audio: true}
        , 
        function(stream) {
            window.webspeechkit.Recorder = Recorder(stream);
            window.webspeechkit.recorderInited = true;
            initSuccess();
        }
        ,
        function(err) {
            badInitialization(err);
        }
        );
     }
    else
    {
        badInitialization("Your browser doesn't support WebRTC. Please, use Firefox or Yandex.Browser");
    }
 };
}(window));
