import os
import datetime
from asrclient.voiceproxy_pb2 import AddDataResponse as AsrResponse

"""
use it like
./asrclient-cli.py -k <your-key> --callback-module advanced_callback_example --silent <path-to-your-sound.wav>
"""

session_id = "not-set"
start_timestamp = datetime.datetime.now().strftime("%d-%m-%Y_%H:%M:%S")

def mkdir_p(path):
    try:
        os.makedirs(path)
    except OSError as exc:  # Python >2.5
        if exc.errno == errno.EEXIST and os.path.isdir(path):
            pass
        else:
            raise

dirname = "./{0}/".format(start_timestamp)
mkdir_p(start_timestamp)

utterance_count = 0

def advanced_callback(asr_response):
    print "Got response:"
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


def advanced_utterance_callback(asr_response, data_chunks):
    global utterance_count
    print "Got complete utterance, for {0} data_chunks, session_id = {1}".format(len(data_chunks), session_id)

    with open("{0}/{1}_{2}.sound".format(dirname, session_id, utterance_count), "wb") as sound_file:
        for chunk in data_chunks:
            sound_file.write(chunk)

    with open("{0}/{1}_{2}.txt".format(dirname, session_id, utterance_count), "w") as txt_file:
        txt_file.write(asr_response.recognition[0].normalized.encode("utf-8"))

    utterance_count += 1
