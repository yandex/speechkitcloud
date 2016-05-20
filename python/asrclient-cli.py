#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Yandex ASR streaming client."""

import logging
import click
import exceptions
import sys

import asrclient.client as client

try:
    import pyaudio
    is_pyaudio = True
except exceptions.ImportError:
    is_pyaudio = False


@click.command()
@click.option('-k', '--key',
              help='You could get it at https://developer.tech.yandex.ru/. Default is "{0}".'.format(client.DEFAULT_KEY_VALUE),
              default=client.DEFAULT_KEY_VALUE)
@click.option('-s', '--server',
              help='Default is {0}.'.format(client.DEFAULT_SERVER_VALUE),
              default=client.DEFAULT_SERVER_VALUE)
@click.option('-p', '--port',
              help='Default is {0}.'.format(client.DEFAULT_PORT_VALUE),
              default=client.DEFAULT_PORT_VALUE)
@click.option('--format',
              help='Input file format. Default is {0}.'.format(client.DEFAULT_FORMAT_VALUE),
              default=client.DEFAULT_FORMAT_VALUE)
@click.option('--model',
              help='Recognition model. freeform | freeform8alaw. Use the last one if your sound comes from a phone call. It\'s just a model name, sound format may be different. Default is {0}.'.format(client.DEFAULT_MODEL_VALUE),
              default=client.DEFAULT_MODEL_VALUE)
@click.option('--lang',
              help='Recognition language. ru-RU | en-EN | tr-TR | uk-UA. Default is {0}.'.format(client.DEFAULT_LANG_VALUE),
              default=client.DEFAULT_LANG_VALUE)
@click.option('--app',
              help='Application. Default is local.',
              default="local")
@click.option('--chunk-size',
              default=client.DEFAULT_CHUNK_SIZE_VALUE,
              help='Default value {0} bytes roughly equals to one second of audio in default format.'.format(client.DEFAULT_CHUNK_SIZE_VALUE))
@click.option('--start-with-chunk',
              default=0,
              help='Use it to send only some part of the input file. Default is 0.')
@click.option('--max-chunks-count',
              default=None,
              type=int,
              help='Use it to send only some part of the input file. Default means no limit is set.')
@click.option('--reconnect-delay',
              default=client.DEFAULT_RECONNECT_DELAY,
              help='Take a pause in case of network problems. Default value is {0} seconds.'.format(client.DEFAULT_RECONNECT_DELAY))
@click.option('--inter-utt-silence',
              default=client.DEFAULT_INTER_UTT_SILENCE,
              type=float,
              help='A pause between phrases finalization. Default value is {0} seconds.'.format(client.DEFAULT_INTER_UTT_SILENCE/100.0))
@click.option('--cmn-latency',
              default=client.DEFAULT_CMN_LATENCY,
              help='CMN latecny parameter. Default value is {0}.'.format(client.DEFAULT_CMN_LATENCY))
@click.option('--reconnect-retry-count',
              default=client.DEFAULT_RECONNECT_RETRY_COUNT,
              help='Sequentional reconnects before giving up. Default is {0}.'.format(client.DEFAULT_RECONNECT_RETRY_COUNT))
@click.option('--silent',
              is_flag=True,
              help='Don\'t print debug messages, only recognized text.')
@click.option('--record',
              is_flag=True,
              help='Grab audio from system audio input instead of files.')
@click.option('--nopunctuation',
              is_flag=True,
              help='Disable punctuation.')
@click.option('--uuid',
              default=client.DEFAULT_UUID_VALUE,
              help='UUID of your request. It can be helpful for further logs analysis. Default is random.')
@click.option('--ipv4',
              is_flag=True,
              help='Use ipv4 only connection.')
@click.option('--realtime',
              is_flag=True,
              help='Emulate realtime record recognition.')
@click.option('--callback-module',
              help='Python module name which should implement advanced_callback(AddDataResponse).\nIt takes corresponding protobuf message as a parameter. See advanced_callback_example.py for details.',
              default=None)
@click.argument('files',
                nargs=-1,
                type=click.File('rb'))
@click.option('--capitalize',
              is_flag=True,
              help='Should each utterance start with a capital letter?')
@click.option('--expected-num-count',
              default=0,
              type=int,
              help='How many digits should be in the answer? Special option, you don\'t need it!')

def main(chunk_size, start_with_chunk, max_chunks_count, record, files, silent, **kwars):
    if not silent:
        logging.basicConfig(level=logging.INFO)

    chunks = []
    if files:
        chunks = client.read_chunks_from_files(files,
                                               chunk_size,
                                               start_with_chunk,
                                               max_chunks_count)
    else:
        if record:
            if is_pyaudio:
                chunks = client.read_chunks_from_pyaudio(chunk_size)
            else:
                click.echo('Please install pyaudio module for system audio recording.')
                sys.exit(-2)

    def default_callback(utterance, start_time = 0.0, end_time = 0.0, data = None):
        click.echo(utterance)
        if (end_time > start_time):
            click.echo("from {0} to {1}".format(start_time, end_time))

    if not chunks:
        click.echo('Please, specify one or more input filename.')
    else:
        client.recognize(chunks,
                         callback=default_callback,
                         **kwars)

if __name__ == "__main__":
        main()
