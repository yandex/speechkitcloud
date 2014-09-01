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
from voiceproxy_pb2 import ConnectionRequest, AddData, AddDataResponse
from transport import Transport, TransportError


DEFAULT_KEY_VALUE = 'paste-your-own-key'
DEFAULT_SERVER_VALUE = 'asr.yandex.net'
DEFAULT_PORT_VALUE = 80
DEFAULT_FORMAT_VALUE = 'audio/x-pcm;bit=16;rate=16000'
DEFAULT_CHUNK_SIZE_VALUE = 1024*32
DEFAULT_RECONNECT_DELAY = 0.5
DEFAULT_RECONNECT_RETRY_COUNT = 5


def read_chunks_from_files(files, chunksize):
    for f in files:
        chunk = f.read(chunksize)
        while chunk:
            yield chunk
            chunk = f.read(chunksize)
        f.close()


class ServerError(RuntimeError):
    def __init__(self, message):
        RuntimeError.__init__(self, message)


class ServerConnection(object):

    def __init__(self, host, port, key, app, service, topic, lang, format, logger=None):
        self.host = host
        self.port = port
        self.key = key
        self.app = app
        self.topic = topic
        self.service = service
        self.lang = lang
        self.format = format
        self.uuid = randomUuid().hex
        self.logger = logger

        self.log("uuid={0}".format(self.uuid))

        self.session_id = ""
        self.connect()

    def log(self, message):
        if self.logger is not None:
            self.logger.info(message)

    def connect(self):
        self.t = Transport(self.host, self.port, verbose=False)
        if not self.upgrade_connection():
            raise ServerError('Unable to upgrade connection')
        self.log("Connected!")

        response = self.send_init_request()
        if response.responseCode != 200:
            raise ServerError('Wrong response from server, status_code={0}'.format(
                response.responseCode))

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
            format=self.format)

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
        result = self.t.recvProtobuf(AddDataResponse)

        if result.responseCode != 200:
            raise ServerError('Wrong response from server, status_code={0}'.format(
                result.responseCode))

        if result.endOfUtt and len(result.recognition) > 0:
            return result.recognition[0].normalized.encode('utf-8')


def recognize(chunks,
              callback=None,
              format=DEFAULT_FORMAT_VALUE,
              host=DEFAULT_SERVER_VALUE,
              port=DEFAULT_PORT_VALUE,
              key=DEFAULT_KEY_VALUE,
              app='local',
              service='dictation',
              topic='freeform',
              lang='ru-RU',
              reconnect_delay=DEFAULT_RECONNECT_DELAY,
              reconnect_retry_count=DEFAULT_RECONNECT_RETRY_COUNT):
    
    class State(object):
        pass

    state = State()
    state.logger = logging.getLogger('asrclient')
    state.server = ServerConnection(host, port, key, app, service, topic, lang, format, state.logger)
    state.utterance_chunks = []
    state.retry_count = 0

    def send(chunk, start_index, current_index):
        try:
            state.server.add_data(chunk)
            utterance = state.server.get_utterance_if_ready()
            
            if utterance:
                state.logger.info('Chunks from {0} to {1}:'.format(start_index, current_index))
                if callback is not None:
                    callback(utterance)
                del state.utterance_chunks[:]
                state.retry_count = 0
                return current_index
            else:
                state.retry_count = 0
                return start_index

        except (DecodeProtobufError, ServerError, TransportError, SocketError) as e:
            global retry_count
            state.logger.info('Connection lost! ({0})'.format(type(e)))
            state.logger.info(e.message)
            utterance_bytes = "".join(state.utterance_chunks)
            if state.retry_count < reconnect_retry_count:
                state.retry_count += 1
                state.server.reconnect(reconnect_delay)
                state.logger.info('Resending current utterance (chunks {0}-{1}, {2} bytes)...'.format(start_index, current_index - 1, len(utterance_bytes)))
                return send(utterance_bytes, start_index, current_index)
            else:
                with open("{0}.crash.utterance".format(time.time()), "wb") as f:
                    state.logger.info("Saving crash utterance as {0}".format(f.name))
                    f.write(utterance_bytes)
                raise RuntimeError("Gave up!")

    state.logger.info('Recognition was started.')
    start_index = 0
    for index, chunk in enumerate(chunks):
        state.logger.info('About to send chunk {0} ({1} bytes)'.format(index, len(chunk)))
        state.utterance_chunks.append(chunk)
        start_index = send(chunk, start_index, index)

    state.logger.info('No more chunks. Finalizing recognition.')
    send(None, start_index, index)
    state.logger.info('Recognition is done.')
