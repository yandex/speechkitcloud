#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Yandex ASR streaming library."""

import os
import logging
import sys
import time

from uuid import uuid4 as randomUuid
from socket import error as SocketError
from google.protobuf.message import DecodeError as DecodeProtobufError
from basic_pb2 import ConnectionResponse
from voiceproxy_pb2 import ConnectionRequest, AddData, AddDataResponse, AdvancedASROptions
from transport import Transport, TransportError
from threading import Thread

DEFAULT_KEY_VALUE = 'paste-your-own-key'
DEFAULT_SERVER_VALUE = 'asr.yandex.net'
DEFAULT_PORT_VALUE = 80

DEFAULT_FORMAT_VALUE = 'audio/x-pcm;bit=16;rate=16000'
# 'audio/x-pcm;bit=16;rate=8000' # use this format for 8k bitrate wav and pcm

DEFAULT_MODEL_VALUE = 'freeform'
DEFAULT_LANG_VALUE = 'ru-RU'

DEFAULT_UUID_VALUE = randomUuid().hex

DEFAULT_CHUNK_SIZE_VALUE = 1024*32*2
DEFAULT_RECONNECT_DELAY = 0.5
DEFAULT_RECONNECT_RETRY_COUNT = 5
DEFAULT_PENDING_LIMIT = 50

DEFAULT_INTER_UTT_SILENCE = 120
DEFAULT_CMN_LATENCY = 50

def bytes_in_sec(format):
    if "8000" in format:
        return 16000
    else:
        return 32000


def read_chunks_from_pyaudio(chunk_size = DEFAULT_CHUNK_SIZE_VALUE):
    import pyaudio
    p = pyaudio.PyAudio()
    stream = p.open(format=pyaudio.paInt16,
                    channels=1,
                    rate=16000,
                    input=True,
                    frames_per_buffer=1024)
    while True:
        yield stream.read(chunk_size)


def read_chunks_from_files(files, chunksize, start_from = 0, max_count = None):
    count = 0
    for f in files:
        chunk = f.read(chunksize)
        while chunk:
            if  start_from <= count:
                if max_count is None or count < start_from + max_count:
                    yield chunk
            count += 1
            chunk = f.read(chunksize)
        f.close()


class ServerError(RuntimeError):
    def __init__(self, message):
        RuntimeError.__init__(self, message)


class ServerConnection(object):

    def __init__(self, host, port, key, app, service, topic, lang, format, uuid, inter_utt_silence, cmn_latency, logger=None, punctuation=True, ipv4=False):
        self.host = host
        self.port = port
        self.key = key
        self.app = app
        self.topic = topic
        self.service = service
        self.lang = lang
        self.format = format
        self.uuid = uuid
        self.logger = logger
        self.punctuation = punctuation
        self.inter_utt_silence = inter_utt_silence
        self.cmn_latency = cmn_latency
        self.ipv4 = ipv4

        self.log("uuid={0}".format(self.uuid))

        self.session_id = ""
        self.connect()


    def log(self, message):
        if self.logger is not None:
            self.logger.info(message)

    def connect(self):
        self.t = Transport(self.host, self.port, timeout=None, verbose=False, enable_ssl=(self.port==443), ipv4=self.ipv4)
        if not self.upgrade_connection():
            raise ServerError('Unable to upgrade connection')
        self.log("Connected to {0}:{1}.".format(self.host, self.port))

        response = self.send_init_request()
        if response.responseCode != 200:
            error_text = 'Wrong response from server, status_code={0}'.format(
                response.responseCode)
            if response.HasField("message"):
                error_text += ', message is "{0}"'.format(response.message)
            raise ServerError(error_text)

        self.session_id = response.sessionId
        self.log("session_id={0}".format(self.session_id))

        return self.session_id

    def send_init_request(self):
        request = ConnectionRequest(
            speechkitVersion='Not Speechkit',
            serviceName=self.service,
            uuid=self.uuid,
            apiKey=self.key,
            applicationName=self.app,
            device='desktop',
            coords='0, 0',
            topic=self.topic,
            lang=self.lang,
            format=self.format,
            punctuation=self.punctuation,
            advancedASROptions=AdvancedASROptions(
                                  utterance_silence=int(self.inter_utt_silence),
                                  cmn_latency=self.cmn_latency
                               )
            )

        self.t.sendProtobuf(request)
        return self.t.recvProtobuf(ConnectionResponse)

    def upgrade_connection(self):
        logger = logging.getLogger('arslib')
        request = ('GET /asr_partial_checked HTTP/1.1\r\n'
                   'User-Agent: {user_agent}\r\n'
                   'Host: {host}:{port}\r\n'
                   'Upgrade: {service}\r\n\r\n').format(
                       user_agent=self.app,
                       host=self.host,
                       port=self.port,
                       service=self.service)

        self.t.send(request)
        check = 'HTTP/1.1 101 Switching Protocols'
        buffer = ''

        # possible infinite loop here?
        while True:
            buffer += self.t.recv(1)
            if buffer.startswith(check) and buffer.endswith('\r\n\r\n'):
                return True
            if len(buffer) > 300:
                logger.warning(buffer)
                return False

    def close(self):
        self.session_id = ""
        self.t.close()

    def reconnect(self, delay=None):
        self.log('Reconnecting!')
        self.close()
        if delay is not None:
            self.log('Going to sleep for {0} seconds'.format(delay))
            time.sleep(delay)
        self.connect()

    def add_data(self, chunk):
        if chunk is None:
            self.t.sendProtobuf(AddData(lastChunk=True))
        else:
            self.t.sendProtobuf(AddData(lastChunk=False, audioData=chunk))


    def get_utterance_if_ready(self):
        response = self.t.recvProtobufIfAny(AddDataResponse)

        if response is not None:
            if response.responseCode != 200:
                error_text = 'Wrong response from server, status_code={0}'.format(
                    response.responseCode)
                if response.HasField("message"):
                    error_text += ', message is "{0}"'.format(response.message)
                raise ServerError(error_text)

            self.log("got response: endOfUtt={0}; len(recognition)={1}".format(response.endOfUtt, len(response.recognition)))

            if len(response.recognition) == 0:
                return "", 0.0, 0.0, response.messagesCount

            text =  response.recognition[0].normalized.encode('utf-8')
            merged = response.messagesCount
            self.log("partial result: {0}; merged={1}".format(text, merged))

            if response.endOfUtt:
                start_time = response.recognition[0].align_info.start_time
                end_time = response.recognition[0].align_info.end_time
                self.log("start time: {0}; end_time={1}".format(start_time, end_time))
                return text, start_time, end_time, merged
            else:
                return "", 0.0, 0.0, response.messagesCount

        return None, 0.0, 0.0, 0


def recognize(chunks,
              callback=None,
              format=DEFAULT_FORMAT_VALUE,
              server=DEFAULT_SERVER_VALUE,
              port=DEFAULT_PORT_VALUE,
              key=DEFAULT_KEY_VALUE,
              app='local',
              service='dictation',
              model=DEFAULT_MODEL_VALUE,
              lang=DEFAULT_LANG_VALUE,
              inter_utt_silence=DEFAULT_INTER_UTT_SILENCE,
              cmn_latency=DEFAULT_CMN_LATENCY,
              uuid=DEFAULT_UUID_VALUE,
              reconnect_delay=DEFAULT_RECONNECT_DELAY,
              reconnect_retry_count=DEFAULT_RECONNECT_RETRY_COUNT,
              pending_limit=DEFAULT_PENDING_LIMIT,
              ipv4=False,
              nopunctuation=False,
              realtime=False):

    class PendingRecognition(object):
        def __init__(self):
            self.logger = logging.getLogger('asrclient')
            self.server = ServerConnection(server, port, key, app, service, model, lang, format, uuid, inter_utt_silence, cmn_latency, self.logger, not nopunctuation, ipv4)
            self.unrecognized_chunks = []
            self.retry_count = 0
            self.pending_answers = 0
            self.chunks_answered = 0
            self.utterance_start_index = 0
            self.thread = Thread(target=self.check_result)

        def check_result(self):
            while True:
                try:
                    self.gotresult(*self.server.get_utterance_if_ready())
                    time.sleep(0.01)
                except Exception as e:
                    if self.pending_answers > 0:
                        print e
                    return

        def gotresult(self, utterance, start_time, end_time, messagesCount):
            self.chunks_answered += messagesCount
            self.pending_answers -= messagesCount

            self.retry_count = 0
            if utterance is not None:
                self.logger.info('Utterance is not None')
                if utterance != "":
                    self.logger.info('Chunks from {0} to {1}:'.format(self.utterance_start_index, self.utterance_start_index + self.chunks_answered))
                    if callback is not None:
                        callback(utterance, start_time, end_time)
                    del self.unrecognized_chunks[:self.chunks_answered]
                    self.utterance_start_index += self.chunks_answered
                    self.chunks_answered = 0
                    self.logger.info("got utterance: start index {0}, pending answers {1}, chunks answered {2}".format(self.utterance_start_index, self.pending_answers, self.chunks_answered))
                else:
                    self.logger.info("utterance incomplete, hiding partial result")

        def send(self, chunk):
            self.logger.info("entering send() :start index {0}, pending answers {1}, chunks answered {2}".format(self.utterance_start_index, self.pending_answers, self.chunks_answered))
            try:
                self.server.add_data(chunk)
                self.pending_answers += 1

            except (DecodeProtobufError, ServerError, TransportError, SocketError) as e:
                global retry_count
                self.logger.info('Connection lost! ({0})'.format(type(e)))
                self.logger.info(e.message)
                if self.retry_count < reconnect_retry_count:
                    self.retry_count += 1
                    self.server.reconnect(reconnect_delay)
                    self.logger.info('Resending current utterance (chunks {0}-{1})...'.format(self.utterance_start_index, self.utterance_start_index + len(self.unrecognized_chunks)))
                    self.pending_answers = 0
                    self.chunks_answered = 0
                    for i, chunk in enumerate(self.unrecognized_chunks):
                        if chunk is not None:
                            self.logger.info('About to send chunk {0} ({1} bytes)'.format(self.utterance_start_index + i, len(chunk)))
                        else:
                            self.logger.info('No more chunks. Finalizing recognition.')
                        self.send(chunk)
                else:
                    raise RuntimeError("Gave up!")


    start_at = time.time()

    state = PendingRecognition()

    state.logger.info('Recognition was started.')
    chunks_count = 0

    state.thread.start()

    sent_length = 0
    for index, chunk in enumerate(chunks):
        while realtime and (sent_length / bytes_in_sec(format) > time.time() - start_at):
            time.sleep(0.01)

        while state.pending_answers > pending_limit:
            time.sleep(0.01)

        state.logger.info('About to send chunk {0} ({1} bytes)'.format(index, len(chunk)))
        state.unrecognized_chunks.append(chunk)
        state.send(chunk)
        chunks_count = index + 1
        sent_length += len(chunk)

    state.logger.info('No more chunks. Finalizing recognition.')
    state.unrecognized_chunks.append(None)
    state.send(None)

    state.thread.join()

    state.logger.info('Recognition is done.')

    fin_at = time.time()
    seconds_elapsed = fin_at - start_at

    state.logger.info("Start at {0}, finish at {1}, took {2} seconds".format(time.strftime("[%d.%m.%Y %H:%M:%S]", time.localtime(start_at)),
                                                                          time.strftime("[%d.%m.%Y %H:%M:%S]", time.localtime(fin_at)),
                                                                          seconds_elapsed))
    chunks_per_second = chunks_count / seconds_elapsed
    state.logger.info("Avg. {0} chunks per second".format(chunks_per_second))
