#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Yandex ASR streaming client."""

import logging
import click

import asrclient.client as client


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
@click.option('--chunk-size',
              default=client.DEFAULT_CHUNK_SIZE_VALUE,
              help='Default value {0} bytes roughly equals to one second of audio in default format.'.format(client.DEFAULT_CHUNK_SIZE_VALUE))
@click.option('--reconnect-delay',
              default=client.DEFAULT_RECONNECT_DELAY,
              help='Take a pause in case of network problems. Default value is {0} seconds.'.format(client.DEFAULT_RECONNECT_DELAY))
@click.option('--reconnect-retry-count',
              default=client.DEFAULT_RECONNECT_RETRY_COUNT,
              help='Sequentional reconnects before giving up. Default is {0}.'.format(client.DEFAULT_RECONNECT_RETRY_COUNT))
@click.option('--silent',
              is_flag=True,
              help='Don\'t print debug messages, only recognized text.')
@click.argument('files',
                nargs=-1,
                type=click.File('rb'))
def main(key, server, port, format, chunk_size, silent, reconnect_delay, reconnect_retry_count, files):
    if not silent:
        logging.basicConfig(level=logging.INFO)

    if not files:
        click.echo('Please, specify one or more input filename.')
    else:
        chunks = client.read_chunks_from_files(files, chunk_size)
        client.recognize(chunks,
                         callback=click.echo,
                         host=server,
                         port=port,
                         key=key,
                         format=format,
                         reconnect_delay=reconnect_delay,
                         reconnect_retry_count=reconnect_retry_count)


if __name__ == "__main__":
        main()
