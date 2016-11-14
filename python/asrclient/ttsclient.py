#!/usr/bin/python
# -*- coding: utf-8 -*-

import sys, os
import requests
from datetime import datetime
import time
import random
import logging

from transport import Transport

from basic_pb2 import ConnectionResponse
from ttsbackend_pb2 import Generate, GenerateResponse
from tts_pb2 import GenerateRequest, ConnectionRequest, ParamsRequest, ParamsResponse 

from uuid import uuid4 as randomUuid

DEFAULT_KEY_VALUE = 'paste-your-own-key'
DEFAULT_SERVER_VALUE = 'tts.voicetech.yandex.net'
DEFAULT_PORT_VALUE = 80

DEFAULT_LANG_VALUE = 'ru-RU'

DEFAULT_UUID_VALUE = randomUuid().hex

DEFAULT_FORMAT_VALUE = 'wav'
DEFAULT_QUALITY_VALUE = 'high'

def generateWavHeader(sample_rate, mono=True, data_size=0):
    gWavHeader = "RIFF\xff\xff\xff\xffWAVEfmt \x10\x00\x00\x00\x01\x00" + ("\x01" if mono else "\x02") + "\x00"
    wav_rate = ""
    wav_rate_align = ""
    sample_rate_align = sample_rate * 2
    for i in xrange(0, 4):
        wav_rate += chr(sample_rate % (256 if mono else 512))  # sample_rate * block_align (2 for mono) as int32
        wav_rate_align += chr(sample_rate_align % 256)  # sample_rate as int32
        sample_rate /= 256
        sample_rate_align /= 256
    gWavHeader += wav_rate
    gWavHeader += wav_rate_align
    gWavHeader += "\x02" if mono else "\x04"
    gWavHeader += "\x00\x10\x00data\xff\xff\xff\xff"

    if data_size > 0:
        size_of_wav = data_size + 36
        hexWavSize = ""
        hexDataSize = ""
        for i in xrange(0,4):
            hexWavSize += chr(size_of_wav % 256)
            size_of_wav /= 256
            hexDataSize += chr(data_size % 256)
            data_size /= 256
        gWavHeader = gWavHeader[:4] + hexWavSize + gWavHeader[8:40] + hexDataSize

    return gWavHeader

def upgradeToProtobuf(transport, server, port):
        transport.verbose = False
        transport.send("GET /ytcp2 HTTP/1.1\r\n" +
                "User-Agent:KeepAliveClient\r\n" +
                "Host: %s:%s\r\n" % (server, port) +
                "Upgrade: websocket\r\n\r\n");
        check = "HTTP/1.1 101"
        checkRecv = ""
        while True:
            checkRecv += transport.recv(1)
            if checkRecv.startswith(check) and checkRecv.endswith("\r\n\r\n"):
                break
            if len(checkRecv) > 300:
                return False
        return True

def list_speakers(server=DEFAULT_SERVER_VALUE, port=DEFAULT_PORT_VALUE, key=DEFAULT_KEY_VALUE, uuid=DEFAULT_UUID_VALUE, ipv4=False, **kwars):
    logger = logging.getLogger('asrclient')
    with Transport(server, port, timeout=None, verbose=False, enable_ssl=(port==443), ipv4=ipv4) as t:
        if not upgradeToProtobuf(t, server, port):
            logger.info("Wrong response on upgrade request. Exiting.")
            sys.exit(1)
        logger.info("Upgraded to protobuf, sending connect request.")
        
        t.sendProtobuf(ConnectionRequest(
            serviceName="tts",
            speechkitVersion="ttsclient",
            uuid=uuid,
            apiKey=key
        ))

        connectionResponse = t.recvProtobuf(ConnectionResponse)
        
        if connectionResponse.responseCode != 200:
            logger.info("Bad response code %s: %s" % (connectionResponse.responseCode, connectionResponse.message))
            sys.exit(1)

        logger.info("Connected, getting speakers list.")

        t.sendProtobuf(ParamsRequest(
            listVoices=True
        ))

        res = t.recvProtobuf(ParamsResponse)

        print(", ".join([v.name for v in res.voiceList if v.coreVoice]))

def generate(file, text, speaker, server=DEFAULT_SERVER_VALUE, port=DEFAULT_PORT_VALUE, key=DEFAULT_KEY_VALUE, uuid=DEFAULT_UUID_VALUE, lang=DEFAULT_LANG_VALUE, emotion=None, gender=None, ipv4=False, format=DEFAULT_FORMAT_VALUE, quality=DEFAULT_QUALITY_VALUE):
    logger = logging.getLogger('asrclient')
    with Transport(server, port, timeout=None, verbose=False, enable_ssl=(port==443), ipv4=ipv4) as t:
        if not upgradeToProtobuf(t, server, port):
            logger.info("Wrong response on upgrade request. Exiting.")
            sys.exit(1)
        logger.info("Upgraded to protobuf, sending connect request")
        
        t.sendProtobuf(ConnectionRequest(
            serviceName="tts",
            speechkitVersion="ttsclient",
            uuid=uuid,
            apiKey=key
        ))

        connectionResponse = t.recvProtobuf(ConnectionResponse)
        
        if connectionResponse.responseCode != 200:
            logger.info("Bad response code %s: %s" % (connectionResponse.responseCode, connectionResponse.message))
            sys.exit(1)

        t.sendProtobuf(ParamsRequest(
            listVoices=True
        ))

        res = t.recvProtobuf(ParamsResponse)

        request = GenerateRequest(
            lang=lang,
            text=text,
            application="ttsclient",
            platform="local",
            voice=speaker,
            requireMetainfo=False,
            format={'wav': GenerateRequest.Pcm, 'pcm': GenerateRequest.Pcm, 'speex': GenerateRequest.Spx, 'opus': GenerateRequest.Opus}.get(format, GenerateRequest.Pcm),
            quality=({'low': GenerateRequest.Low, 'high': GenerateRequest.High, 'ultra': GenerateRequest.UltraHigh}[quality]),
            chunked=True
        )

        if emotion or gender:
            request.lowLevelGenerateRequest.CopyFrom(Generate(
                voices=[Generate.WeightedParam(name=speaker, weight=1.0)],
                emotions=[Generate.WeightedParam(name=emotion, weight=1.0)] if emotion else [],
                genders=[Generate.WeightedParam(name=gender, weight=1.0)] if gender else [],
                lang=lang[:2],
                text=text,
                fast=False,
                requireMetainfo=False
            ))
        
        t.sendProtobuf(request)
        if format == 'wav':
            file.write(generateWavHeader({'ultra': 48000,
                                            'high': 16000,
                                            'low': 8000}[quality]))
        while True:
            ttsResponse = t.recvProtobuf(GenerateResponse)
            if ttsResponse.message:
                logger.info("Error on synthesis: %s" % (ttsResponse.message,))
                sys.exit(2)
            
            if not ttsResponse.completed:
                file.write(ttsResponse.audioData)
            else:
                file.close()
                break
    logger.info("Request complete")
