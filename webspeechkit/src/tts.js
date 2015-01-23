(function(webspeechkit){
webspeechkit.play = function(url, cb) {
    var audio = new Audio(url);
    audio.onended = cb
    audio.play();
};

webspeechkit.Tts = function(params) {
    this.key = params.key || '';
    this.ttsurl = params.url || 'https://tts.voicetech.yandex.net';
    this.emo = params.emotion || 'neutral';
    this.speaker = params.speaker || 'jane';
    this.speed = params.speed || 1.0;
    this.pitch = params.pitch || 0;
}

webspeechkit.Tts.prototype = {
    say: function(text, cb, args) {
        var emo = (args && args.emotion) || this.emo;
        var key = (args && args.key) || this.key;
        var ttsurl = (args && args.url) || this.ttsurl;
        var speaker = (args && args.speaker) || this.speaker;
        var speed = (args && args.speed) || this.speed;
        var pitch = (args && args.pitch) || this.pitch;
        
        webspeechkit.play(ttsurl + '/crafted?key=' + key
                        + '&speaker=' + speaker 
                        + '&emotion=' + emo                         
                        + '&pitch_shift=' + pitch
                        + '&speed=' + speed
                        + '&text=' + text
                        , cb); 
    }
};
}(window.webspeechkit));
