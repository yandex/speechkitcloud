(function ( $ ) {

$.widget(
"webspeechkit.equalizer", 
{
options: {
    recorder: null,
},
_create: function() {
    this.element.addClass("webspeechkit-equalizer")
    .css("text-align", "center")
    .html("");
    this.element.append('<canvas class="graf" style="width: 100%" width="1000" height="200"></canvas>');

    if (!navigator.cancelAnimationFrame)
        navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
    if (!navigator.requestAnimationFrame)
        navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;
    
    this.graf = this.element.find('canvas').get(0);
    this.refID = null;

    if (this.options.recorder)
    {
        this.analyserNode = this.options.recorder.getAnalyserNode();
        this.context = this.options.recorder.context;
    }
    else
    {
        this.element.find('canvas').hide();
        this.element.append("<div>No recorder!</div>");
    }
    
    var backref = this;
    this.startDrawRealtime();
}
,
_destroy: function() {
    this.element.empty();
    this.element.removeClass("webspeechkit-equalizer");
}
,
stopDrawRealtime: function() {
    window.cancelAnimationFrame(this.rafID);
    this.rafID=null;
}
,
startDrawRealtime: function() {                   
        var backref = this;
        function updateAnalysers(time) {
            var canvasWidth = backref.graf.width;
            var canvasHeight = backref.graf.height;
            var analyserContext = backref.graf.getContext('2d');

            var SPACING = 2;
            var BAR_WIDTH = 1;
            var numBars = Math.round(canvasWidth / SPACING);
            var freqByteData = new Uint8Array(backref.analyserNode.frequencyBinCount);

            backref.analyserNode.getByteFrequencyData(freqByteData); 

            analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
            analyserContext.fillStyle = '#F6D565';
            analyserContext.lineCap = 'round';
            var multiplier = backref.analyserNode.frequencyBinCount / numBars;

            for (var i = 0; i < numBars; ++i) {
                var magnitude = 0;
                var offset = Math.floor( i * multiplier );
                for (var j = 0; j< multiplier; j++)
                    magnitude += freqByteData[offset + j];
                magnitude = magnitude / multiplier / 2;
                analyserContext.fillStyle = "hsl( " + Math.round(i*60/numBars) + ", 100%, 50%)";
                analyserContext.fillRect(i * SPACING, canvasHeight, BAR_WIDTH, -magnitude);
            }
            backref.rafID = window.requestAnimationFrame( updateAnalysers );
        }
        
        this.rafID = window.requestAnimationFrame( updateAnalysers );
}
}
)
}(jQuery));
