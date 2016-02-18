from asrclient.voiceproxy_pb2 import AddDataResponse as AsrResponse

"""
use it like
./asrclient-cli.py -k <your-key> --callback-module advanced_callback_example --silent <path-to-your-sound.wav>
"""

def advanced_callback(asr_response):
    print "Got responce:"
    print "end-of-utterance = {}".format(asr_response.endOfUtt)
    r_count = 0
    for r in asr_response.recognition:
        print "recognition[{}] = {}; confidence = {}".format(r_count, r.normalized.encode("utf-8"), r.confidence)
        print "utterance timings: from {} to {}".format(r.align_info.start_time,r.align_info.end_time)
        w_count = 0
        for w in r.words:
            print "word[{}] = {}; confidence = {}".format(w_count, w.value.encode("utf-8"), w.confidence)
            print "word timings: from {} to {}".format(w.align_info.start_time,w.align_info.end_time)
            w_count += 1
        r_count += 1
