importScripts("./speex.min.js"); 
var speex_codec=null, oggdata=null;
var first_package = true;

var recLength = 0,
  recBuffersL = [],
  recBuffersR = [],
  sampleRate,
  outSampleRate;
var tmp_buf = 0;
var need_buf_size = 4096;

this.onmessage = function(e){
  switch(e.data.command){
    case 'init':
      init(e.data.config);
      break;
    case 'record':
            // continue to record
      record(e.data.buffer);
      break;
    case 'exportWAV':
      exportWAV(e.data.type);
      break;
    case 'exportMonoWAV':
      exportMonoWAV(e.data.type);
      break;
    case 'getBuffers':
      getBuffers();
      break;
    case 'clear':
      clear();
      break;
  }
};

function init(config){
  sampleRate = config.sampleRate;
  outSampleRate = config.outSampleRate || sampleRate;
  need_buf_size = config.bufSize || 4096;
  if (config.format == "speex") {
    if (outSampleRate < 16000) {
        outSampleRate = 8000;
        speex_codec = new Speex({ mode: 0, quality: 8});
        need_buf_size /= 16;
    }
    else if (outSampleRate < 32000) {
        outSampleRate = 16000;
        speex_codec = new Speex({ mode: 1, quality: 8, bits_size: 70});
        need_buf_size /= 16;
    }
    else if (outSampleRate >= 32000) {
        outSampleRate = 32000;
        speex_codec = new Speex({ mode: 2, quality: 8, bits_size: 240});
        need_buf_size /= 8;
    }
    oggdata = new Ogg(null, {file: false});
  }
}

function record(inputBuffer){
    if (outSampleRate == sampleRate) {
        recBuffersL.push(inputBuffer[0]);
        recBuffersR.push(inputBuffer[1]);
        recLength += inputBuffer[0].length;

        var samples = inputBuffer[0];
        var buffer = new ArrayBuffer(samples.length * 2);
        var view = new DataView(buffer);
        floatTo16BitPCM(view, 0, samples);
        this.postMessage({command: 'int16stream', buffer: buffer});
    }
    else
    {
        function resample(inbuf) {
            var result = new Float32Array(Math.floor(inbuf.length*outSampleRate/sampleRate));
            var bin = 0,
            num = 0,
            indexIn = 0,
            indexOut = 0;
            while (indexIn < result.length) {
                bin = 0;
                num = 0;
                while (indexOut < Math.min(inbuf.length, (indexIn + 1) * sampleRate/outSampleRate)) {
                    bin += inbuf[indexOut];
                    num += 1;
                    indexOut++;
                }
                result[indexIn] = bin / num;
                indexIn++;
            }
            return result;
        }
        
        var resin0 = resample(inputBuffer[0]);
        var resin1 = resample(inputBuffer[1]);

        recBuffersL.push(resin0);
        recBuffersR.push(resin1);
        recLength += resin0.length;

        var result = new Int16Array(resin0.length);

        for (var i = 0 ; i < resin0.length ; i++) {
            result[i] = Math.ceil((resin0[i] + resin1[i]) * 16383);
        }
        result = result;

        if (speex_codec)
            result = convert2Speex(result);
        else
            result = result.buffer;
      
        if (!tmp_buf) {
            tmp_buf = result;
        }
        else {
            var tmp = new DataView(new ArrayBuffer(tmp_buf.byteLength + result.byteLength));
            tmp_buf = new DataView(tmp_buf);
            result = new DataView(result);

            for (var i=0; i<tmp_buf.byteLength; i++)
                tmp.setUint8(i, tmp_buf.getUint8(i));
        
            for (var i=0; i<result.byteLength; i++)
                tmp.setUint8(i+tmp_buf.byteLength, result.getUint8(i));

            tmp_buf = tmp.buffer;
        }
        

        if (tmp_buf.byteLength >= need_buf_size) {
            this.postMessage({command: 'int16stream', buffer: tmp_buf});
            tmp_buf = false;
        }
    }
}

function convert2Speex(inputBuffer) {
            var mode = outSampleRate==32000?2:(outSampleRate==16000?1:0);
            var frame_size = speex_codec.frame_size;
            var buf_size = 1024;
            var res_buf = "";

            for (var k=0; k < inputBuffer.length/buf_size; k++) {
            var samples = inputBuffer.subarray(k*buf_size, (k+1)*buf_size);
            var res = speex_codec.encode(samples);
            if (!res) {
                continue;
            }
            
                spxhdr = new SpeexHeader({
                    bitrate: -1,
                    extra_headers: 0,
                    frame_size: frame_size,
                    frames_per_packet: 1,
                    header_size: 80,
                    mode: mode,
                    mode_bitstream_version: 4,
                    nb_channels: 1,
                    rate: outSampleRate,
                    reserved1: 0,
                    reserved2: 0,
                    speex_string: "Speex    ",
                    speex_version_id: 1,
                    speex_version_string:
                    "1.2rc1\0\0\0\0\0\0\0\0\0\0\0\0\0\0",
                    vbr: 0
                });

                spxcmt = "Encoded with speex.js";
                spxcmt = new SpeexComment({
                    vendor_string: spxcmt
                    , vendor_length: spxcmt.length
                });

                if (first_package)
                    r = oggdata.mux([spxhdr.raw, spxcmt.raw, res]);
                else {
                    r = "";
                    var data = res;
                    var segments = data[1].chunk(100)
                        , stream = String.fromCharCode.apply(null,
                                new Uint8Array(data[0].buffer))
                        , a = 0
                        , b = 0
                        , len = segments.length;

                    function chksum(str, c) {
                        var buf = new ArrayBuffer(str.length);
                        var bufView = new Uint8Array(buf);
                        for (var i=0, len=str.length; i<len; i++) {
                            bufView[i] = str.charCodeAt(i);
                        }
                        dv = new DataView(buf);
                        dv.setUint32(22, c, true);

                        return String.fromCharCode.apply(null, new Uint8Array(buf));
                    }

                    function hdrup(hdr, content) {
                        var csum, str;
                        csum = crc32(hdr + content);
                        str = chksum(hdr, csum) + content;
                        return str;
                    }
                    function frames(segments) {
                        var sum = 0;
                        for (var i=0; i<segments.length; ++i) {
                            sum += segments[i];
                        }
                        return sum;
                    }
                    for (var i = 0; i < len; ++i) {
                        var segchunk = segments[i];
                        b += frames(segchunk);

                        var p = {
                                capturePattern: [0x4f, 0x67, 0x67, 0x53]
                                , version: 0
                                , headerType: 0
                                , granulePos: 0 // TODO
                                , serial: 406
                                , sequence: 0
                                , checksum:  0
                                , pageSegments: segchunk.length
                                , segments: segchunk
                                , frames: 1//segchunk.length
                        };                                

                        p = oggdata.createPage(p);
                        r += hdrup(p, stream.substring(a, b));

                        a = b;
                    }                                                      
                }

                first_package = false;
                res_buf += r;
            }
            var buf = new ArrayBuffer(res_buf.length); 
            var bufView = new Uint8Array(buf);
            for (var i=0, strLen=res_buf.length; i<strLen; i++)
                bufView[i] = res_buf.charCodeAt(i);
            return buf;
        }

function exportWAV(type){
  var bufferL = mergeBuffers(recBuffersL, recLength);
  var bufferR = mergeBuffers(recBuffersR, recLength);
  var interleaved = interleave(bufferL, bufferR);
  var dataview = encodeWAV(interleaved);
  var audioBlob = new Blob([dataview], { type: type });

  this.postMessage({command: 'exportWAV', blob: audioBlob});
}

function exportMonoWAV(type){
  var bufferL = mergeBuffers(recBuffersL, recLength);
  var dataview = encodeWAV(bufferL, true);
  var audioBlob = new Blob([dataview], { type: type });

  this.postMessage({command: 'exportMonoWAV', blob: audioBlob});
}

function getBuffers() {
  var buffers = [];
  buffers.push( mergeBuffers(recBuffersL, recLength) );
  buffers.push( mergeBuffers(recBuffersR, recLength) );
  this.postMessage({command: 'getBuffers', blob: buffers});
}

function clear(){
  recLength = 0;
  recBuffersL = [];
  recBuffersR = [];
  first_package = true;
  this.postMessage({command: 'clear'});
}

function mergeBuffers(recBuffers, recLength){
  var result = new Float32Array(recLength);
  var offset = 0;
  for (var i = 0; i < recBuffers.length; i++){
    result.set(recBuffers[i], offset);
    offset += recBuffers[i].length;
  }
  return result;
}

function interleave(inputL, inputR){
  var length = inputL.length + inputR.length;
  var result = new Float32Array(length);

  var index = 0,
    inputIndex = 0;

  while (index < length){
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output, offset, input){
  for (var i = 0; i < input.length; i++, offset+=2){
    var s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view, offset, string){
  for (var i = 0; i < string.length; i++){
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWAV(samples, mono){
  var buffer = new ArrayBuffer(44 + samples.length * 2);
  var view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 32 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, mono?1:2, true);
  /* sample rate */
  view.setUint32(24, outSampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, outSampleRate * 4, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, mono?2:4, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return view;
}
