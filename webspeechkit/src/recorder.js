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
    return function(bufferSize, channelCount, onError, workerPath, outSampleRate)
    {
        var backref = this;
        this.bufferLen = bufferSize || 4096;
        this.channelCount = Math.max(1, Math.min(channelCount || 2, 2)); // 1 or 2, defaults to 2
        this.context = new AudioContext();
        this.outSampleRate = outSampleRate || this.context.sampleRate

        if (this.outSampleRate == this.context.sampleRate)
            this.inputPoint = this.context.createGain();        
        else {
            this.inputPoint = this.context.createBiquadFilter();
            this.inputPoint.type = "lowpass";
            this.inputPoint.frequency.value = this.outSampleRate;
            this.inputPoint.Q.value = 1;
            this.inputPoint.gain.value = 5;
        }

        this.audioInput = this.context.createMediaStreamSource(stream);
        this.audioInput.connect(this.inputPoint);

        if(!this.context.createScriptProcessor){
            this.node = this.context.createJavaScriptNode(this.bufferLen, 2, this.channelCount);
        } else {
            this.node = this.context.createScriptProcessor(this.bufferLen, 2, this.channelCount);
        }

        var worker = new Worker(workerPath || WORKER_PATH);
        /*worker.postMessage({
            command: 'init',
            config: {
                sampleRate: this.context.sampleRate,
                outSampleRate: this.outSampleRate,
                bufSize: this.bufferLen
            }
        });*/

        var recording = false;
        var currCallback;
        var buffCallback;
        var startCallback;

        this.node.onaudioprocess = function(e){

            if (!recording) return;
            
            worker.postMessage({
                command: 'record',
                buffer: [
                    e.inputBuffer.getChannelData(0),
                    e.inputBuffer.getChannelData(1)
                ]
            });
        }

        
        this.getAudioContext = function() {
            return this.context;
        }

        this.getAnalyserNode = function() {
            var analyserNode = this.context.createAnalyser();
            analyserNode.fftSize = 2048;
            this.inputPoint.connect(analyserNode);
            return analyserNode;
        }


        this.start = function(cb, format) {
            startCallback = cb;
            worker.postMessage({
                command: 'init',
                config: {
                    sampleRate: this.context.sampleRate,
                    format: format,
                    bufSize: this.bufferLen
                }
             });

            this.clear(function() {recording = true;});
        }

        this.stop = function(cb){
            recording = false;
            this.exportWAV(function(blob)
            {
                cb(blob);
            }
            );
        }

        this.isRecording = function(){
            return recording;
        }

        this.clear = function(cb){
            currCallback = cb;
            worker.postMessage({ command: 'clear' });
        }

        this.getBuffers = function(cb) {
            buffCallback = cb;
            worker.postMessage({ command: 'getBuffers' })
        }

        this.exportWAV = function(cb, type){
            currCallback = cb;
            type = type || 'audio/wav';
            if (!currCallback) throw new Error('Callback not set');
            worker.postMessage({
                command: "export"+(this.channelCount!=2 && "Mono" || "")+"WAV",
                type: type
            });
        }

        worker.onmessage = function(e){
            if (e.data.command == 'int16stream')
            {
                var data = e.data.buffer;
                if (startCallback) {
                    startCallback(data);
                }
            }
            else  if (e.data.command == 'getBuffers' && buffCallback)
            {
                buffCallback(e.data.blob)
            }
            else if (e.data.command == 'clear' && currCallback)
            {
                currCallback();
            }
            else if (currCallback)
            {
                currCallback(e.data.blob);
            }
        }

        this.inputPoint.connect(this.node);
        this.node.connect(this.context.destination);
    }
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
        initFail(err);
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
})(window);
