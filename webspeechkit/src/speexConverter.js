function SpeexConverter(samplerate) {
        this.samplerate = samplerate;
        this.first_package = true;
        
        if (samplerate == 8000) 
            this.speex_codec = new Speex({ mode: 0, quality: 8});
        else if (samplerate == 16000) 
            this.speex_codec = new Speex({ mode: 1, quality: 8, bits_size: 70});
        else if (samplerate == 32000) 
            this.speex_codec = new Speex({ mode: 2, quality: 8, bits_size: 240});

        this.oggdata = new Ogg(null, {file: false});
}

SpeexConverter.prototype = {
    clear: function() {
            this.first_package = true;
    }
    ,
    convert: function(inputBuffer) {
        var samplerate = this.samplerate;
        var mode = samplerate==32000?2:(samplerate==16000?1:0);
        var frame_size = this.speex_codec.frame_size;
        var buf_size = 1024;
        var res_buf = "";

        for (var k=0; k < inputBuffer.length/buf_size; k++) {
            var samples = inputBuffer.subarray(k*buf_size, (k+1)*buf_size);
            var res = this.speex_codec.encode(samples);

            if (!res) {
                //FIXME
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
                rate: samplerate,
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

            if (this.first_package)
                r = this.oggdata.mux([spxhdr.raw, spxcmt.raw, res]);
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

                    p = this.oggdata.createPage(p);
                    r += hdrup(p, stream.substring(a, b));

                    a = b;
                }                                                      
            }

            this.first_package = false;
            res_buf += r;
        }
        var buf = new ArrayBuffer(res_buf.length); 
        var bufView = new Uint8Array(buf);
        for (var i=0, strLen=res_buf.length; i<strLen; i++)
            bufView[i] = res_buf.charCodeAt(i);
        return buf;
    }
};
