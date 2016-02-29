(function (namespace) {
    'use strict';

    if (typeof namespace.ya === 'undefined') {
        namespace.ya = {};
    }
    if (typeof namespace.ya.speechkit === 'undefined') {
        namespace.ya.speechkit = {};
    }

    function _makeWorker(script) {
        var URL = window.URL || window.webkitURL;
        var Blob = window.Blob;
        var Worker = window.Worker;

        if (!URL || !Blob || !Worker || !script) {
            return null;
        }

        var blob = new Blob([script], {type: 'application/javascript'});
        var worker = new Worker(URL.createObjectURL(blob));
        return worker;
    }

    var inline_worker =
"function iirFilter (sampleRate, cutoff, resonance, type) {" +
"" +
"    var	self	= this," +
"            f	= [0.0, 0.0, 0.0, 0.0]," +
"            freq, damp," +
"            prevCut, prevReso," +
"" +
"            sin	= Math.sin," +
"            min	= Math.min," +
"            pow	= Math.pow;" +
"" +
"    self.cutoff = cutoff || 20000;" +
"    self.resonance = resonance || 0.1;" +
"    self.samplerate = sampleRate || 44100;" +
"    self.type = type || 0;" +
"" +
"    function calcCoeff () {" +
"            freq = 2 * sin(Math.PI * min(0.25, self.cutoff / (self.samplerate * 2)));" +
"            damp = min(2 * (1 - pow(self.resonance, 0.25)), min(2, 2 / freq - freq * 0.5));" +
"    }" +
"" +
"    self.pushSample = function (sample) {" +
"            if (prevCut !== self.cutoff || prevReso !== self.resonance){" +
"                    calcCoeff();" +
"                    prevCut = self.cutoff;" +
"                    prevReso = self.resonance;" +
"            }" +
"" +
"            f[3] = sample - damp * f[2];" +
"            f[0] = f[0] + freq * f[2];" +
"            f[1] = f[3] - f[0];" +
"            f[2] = freq * f[1] + f[2];" +
"" +
"            f[3] = sample - damp * f[2];" +
"            f[0] = f[0] + freq * f[2];" +
"            f[1] = f[3] - f[0];" +
"            f[2] = freq * f[1] + f[2];" +
"" +
"            return f[self.type];" +
"    };" +
"" +
"    self.getMix = function (type) {" +
"            return f[type || self.type];" +
"    };" +
"}" +
"" +
"var speex_loaded = false;" +
"var recLength = 0;" +
"var recBuffersL = [];" +
"var recBuffersR = [];" +
"var sampleRate;" +
"var outSampleRate;" +
"var tmp_buf = 0;" +
"var need_buf_size = 4096;" +
"var speex_converter = null;" +
"    " +
"this.onmessage = function (e) {" +
"    switch (e.data.command) {" +
"    case 'init':" +
"        init(e.data.config);" +
"        break;" +
"    case 'record':" +
"        record(e.data.buffer);" +
"        break;" +
"    case 'exportWAV':" +
"        exportWAV(e.data.type);" +
"        break;" +
"    case 'exportMonoWAV':" +
"        exportMonoWAV(e.data.type);" +
"        break;" +
"    case 'getBuffers':" +
"        getBuffers();" +
"        break;" +
"    case 'clear':" +
"        clear();" +
"        break;" +
"    }" +
"};" +
"    " +
"function init(config) {" +
"    sampleRate = config.sampleRate;" +
"    outSampleRate = config.format.sampleRate || sampleRate;" +
"    need_buf_size = config.format.bufferSize || 4096;" +
"    speex_converter = null;" +
"    /*if (config.format.format == \'speex\') {" +
"        if (!speex_loaded) {" +
"            importScripts(\'./speex.min.js\');" +
"            speex_loaded = true;" +
"        }" +
"        need_buf_size /= 16;" +
"        speex_converter = new SpeexConverter(outSampleRate);" +
"    }*/" +
"}" +
"" +
"var resample = function (inbuf) {" +
"    var speed = 1.0 * sampleRate / outSampleRate;" +
"    var l = Math.ceil(inbuf.length / speed);" +
"    var result = new Float32Array(l);" +
"    var bin = 0;" +
"    var num = 0;" +
"    var indexIn = 0;" +
"    var indexOut = 0;" +
"    for (indexOut = 1, indexIn = speed; indexOut < l - 1; indexIn += speed, indexOut++) {" +
"        var pos = Math.floor(indexIn);" +
"        var dt = indexIn - pos;" +
"        var second = (pos + 1 < inbuf.length) ? pos + 1 : inbuf.length - 1; " +
"        result[indexOut] = inbuf[pos] * (1 - dt) + inbuf[second] * dt;" +
"    }" +
"    result[0] = inbuf[0];" +
"    result[l - 1] = inbuf[inbuf.length - 1];" +
"    return result;" +
"};" +
"    " +
"function record(inputBuffer) {" +
"    if (outSampleRate == sampleRate) {" +
"        recBuffersL.push(inputBuffer[0]);" +
"        recBuffersR.push(inputBuffer[1]);" +
"        recLength += inputBuffer[0].length;" +
"    " +
"        var samples = inputBuffer[0];" +
"        var buffer = new ArrayBuffer(samples.length * 2);" +
"        var view = new DataView(buffer);" +
"        floatTo16BitPCM(view, 0, samples);" +
"        this.postMessage({command: 'int16stream', buffer: buffer});" +
"    } else {" +
"        var filter0 = new iirFilter(outSampleRate, outSampleRate * 0.125, 0.0); " +
"        var filter1 = new iirFilter(outSampleRate, outSampleRate * 0.125, 0.0); " +
"" +
"        for (var i =0; i < inputBuffer[0].length; i++) { " +
"            inputBuffer[0][i] = filter0.pushSample(inputBuffer[0][i]); " +
"            inputBuffer[1][i] = filter1.pushSample(inputBuffer[1][i]); " +
"        }" +
"" +
"        var resin0 = resample(inputBuffer[0], outSampleRate, sampleRate);" +
"        var resin1 = resample(inputBuffer[1], outSampleRate, sampleRate);" +
"    " +
"        recBuffersL.push(resin0);" +
"        recBuffersR.push(resin1);" +
"        recLength += resin0.length;" +
"    " +
"        var result = new Int16Array(resin0.length);" +
"    " +
"        for (var i = 0 ; i < resin0.length ; i++) {" +
"            result[i] = Math.floor(Math.min(Math.max((resin0[i] + resin1[i]) * 0.5, -1.0), 1.0) * 16383);" +
"        }" +
"    " +
"        if (speex_converter) {" +
"            result = speex_converter.convert(result);" +
"        } else {" +
"            result = result.buffer;" +
"        }" +
"    " +
"        if (!tmp_buf) {" +
"            tmp_buf = result;" +
"        } else {" +
"            var tmp = new DataView(new ArrayBuffer(tmp_buf.byteLength + result.byteLength));" +
"            tmp_buf = new DataView(tmp_buf);" +
"            result = new DataView(result);" +
"    " +
"            for (i = 0; i < tmp_buf.byteLength; i++) {" +
"                tmp.setUint8(i, tmp_buf.getUint8(i));" +
"            }" +
"    " +
"            for (i = 0; i < result.byteLength; i++) {" +
"                tmp.setUint8(i + tmp_buf.byteLength, result.getUint8(i));" +
"            }" +
"    " +
"            tmp_buf = tmp.buffer;" +
"        }" +
"    " +
"        if (tmp_buf.byteLength >= need_buf_size) {" +
"            this.postMessage({command: 'int16stream', buffer: tmp_buf});" +
"            tmp_buf = false;" +
"        }" +
"    }" +
"}" +
"    " +
"function exportWAV(type) {" +
"    var bufferL = mergeBuffers(recBuffersL, recLength);" +
"    var bufferR = mergeBuffers(recBuffersR, recLength);" +
"    var interleaved = interleave(bufferL, bufferR);" +
"    var dataview = encodeWAV(interleaved);" +
"    var audioBlob = new Blob([dataview], {type: type});" +
"    " +
"    this.postMessage({command: 'exportWAV', blob: audioBlob});" +
"}" +
"    " +
"function exportMonoWAV(type) {" +
"    var bufferL = mergeBuffers(recBuffersL, recLength);" +
"    var dataview = encodeWAV(bufferL, true);" +
"    var audioBlob = new Blob([dataview], {type: type});" +
"    " +
"    this.postMessage({command: 'exportMonoWAV', blob: audioBlob});" +
"}" +
"    " +
"function getBuffers() {" +
"    var buffers = [];" +
"    buffers.push(mergeBuffers(recBuffersL, recLength));" +
"    buffers.push(mergeBuffers(recBuffersR, recLength));" +
"    this.postMessage({command: 'getBuffers', blob: buffers});" +
"}" +
"    " +
"function clear() {" +
"    recLength = 0;" +
"    recBuffersL = [];" +
"    recBuffersR = [];" +
"    if (speex_converter) {" +
"        speex_converter.clear();" +
"    }" +
"    this.postMessage({command: 'clear'});" +
"}" +
"    " +
"function mergeBuffers(recBuffers, recLength) {" +
"    var result = new Float32Array(recLength);" +
"    var offset = 0;" +
"    for (var i = 0; i < recBuffers.length; i++){" +
"        result.set(recBuffers[i], offset);" +
"        offset += recBuffers[i].length;" +
"    }" +
"    return result;" +
"}" +
"    " +
"function interleave(inputL, inputR) {" +
"    var length = inputL.length + inputR.length;" +
"    var result = new Float32Array(length);" +
"    " +
"    var index = 0;" +
"    var inputIndex = 0;" +
"    " +
"    while (index < length){" +
"        result[index++] = inputL[inputIndex];" +
"        result[index++] = inputR[inputIndex];" +
"        inputIndex++;" +
"    }" +
"    return result;" +
"}" +
"    " +
"function floatTo16BitPCM(output, offset, input) {" +
"    for (var i = 0; i < input.length; i++, offset += 2){" +
"        var s = Math.max(-1, Math.min(1, input[i]));" +
"        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);" +
"    }" +
"}" +
"    " +
"function writeString(view, offset, string) {" +
"    for (var i = 0; i < string.length; i++){" +
"        view.setUint8(offset + i, string.charCodeAt(i));" +
"    }" +
"}" +
"    " +
"function encodeWAV(samples, mono) {" +
"    var buffer = new ArrayBuffer(44 + samples.length * 2);" +
"    var view = new DataView(buffer);" +
"    " +
"    /* RIFF identifier */" +
"    writeString(view, 0, 'RIFF');" +
"    /* file length */" +
"    view.setUint32(4, 32 + samples.length * 2, true);" +
"    /* RIFF type */" +
"    writeString(view, 8, 'WAVE');" +
"    /* format chunk identifier */" +
"    writeString(view, 12, 'fmt ');" +
"    /* format chunk length */" +
"    view.setUint32(16, 16, true);" +
"    /* sample format (raw) */" +
"    view.setUint16(20, 1, true);" +
"    /* channel count */" +
"    view.setUint16(22, mono ? 1 : 2, true);" +
"    /* sample rate */" +
"    view.setUint32(24, outSampleRate, true);" +
"    /* block align (channel count * bytes per sample) */" +
"    var block_align = mono ? 2 : 4;" +
"    /* byte rate (sample rate * block align) */" +
"    view.setUint32(28, outSampleRate * block_align, true);" +
"    /* block align (channel count * bytes per sample) */" +
"    view.setUint16(32, block_align, true);" +
"    /* bits per sample */" +
"    view.setUint16(34, 16, true);" +
"    /* data chunk identifier */" +
"    writeString(view, 36, 'data');" +
"    /* data chunk length */" +
"    view.setUint32(40, samples.length * 2, true);" +
"    " +
"    floatTo16BitPCM(view, 44, samples);" +
"    " +
"    return view;" +
"}" +
" ";

    namespace.ya.speechkit.newWorker = function () {
        return _makeWorker(inline_worker);
    };
}(this));

