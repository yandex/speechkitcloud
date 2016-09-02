#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Yandex TTS streaming client."""

import logging
import click
import exceptions
import sys

import asrclient.ttsclient as client


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
@click.option('--lang',
              help='Synthesis language. ru-RU | en-EN | tr-TR | uk-UA. Default is {0}.'.format(client.DEFAULT_LANG_VALUE),
              default=client.DEFAULT_LANG_VALUE)
@click.option('--speaker',
              help='Speaker for speech synthesis. Call this script with --list-speakers flag to get speakers list.',
              default='')
@click.option('--emotion',
              help='Emotion for speech synthesis. Available values: good, neutral, evil. Default value depends on speaker\'s original emotion.',
              default=None)
@click.option('--gender',
              help='Speaker\'s gender for speech synthesis. Available values: male, female. Default value depends on speaker\'s original gender.',
              default=None)
@click.option('--textfile',
              help='Read text from this file instead of command line arguments.',
              type=click.File('r'),
              default=None)
@click.option('--uuid',
              default=client.DEFAULT_UUID_VALUE,
              help='UUID of your request. It can be helpful for further logs analysis. Default is random.')
@click.option('--ipv4',
              is_flag=True,
              help='Use ipv4 only connection.')
@click.option('--list-speakers',
              is_flag=True,
              default=False,
              help='Only list available speakers, don\'t try to generate anything.')
@click.option('--silent',
              is_flag=True,
              help='Don\'t print debug messages.')
@click.option('--format',
              default=client.DEFAULT_FORMAT_VALUE,
              help='Format of output audio file. wav | pcm | speex | opus. Default is {0}.'.format(client.DEFAULT_FORMAT_VALUE))
@click.option('--quality',
              default=client.DEFAULT_QUALITY_VALUE,
              help='Quality output audio file. ultra | high | low. Default is {0}.'.format(client.DEFAULT_QUALITY_VALUE))
@click.argument('file',
              required=False,
              type=click.File('wb'))
@click.argument('texts',
                nargs=-1)

def main(silent, speaker, texts, textfile=None, list_speakers=False, **kwars):
    if not silent:
        logging.basicConfig(level=logging.INFO)
    if list_speakers:
        client.list_speakers(**kwars)
        sys.exit(0)
    if not speaker:
        print "Speaker is required. Please, call this script with --list-speakers flag to get speakers list."
        sys.exit(1)
    if textfile:
        texts = map(str.strip, textfile.readlines())
    client.generate(text=" ".join(texts).decode('utf8'), speaker=speaker, **kwars)

if __name__ == "__main__":
        main()
