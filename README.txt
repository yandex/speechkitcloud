Usage: asrclient-cli.py [OPTIONS] [FILES]...

Options:
  -k, --key TEXT                  You could get it at
                                  https://developer.tech.yandex.ru/. Default
                                  is "paste-your-own-key".
  -s, --server TEXT               Default is asr.yandex.net.
  -p, --port INTEGER              Default is 80.
  --format TEXT                   Input file format. Default is
                                  audio/x-pcm;bit=16;rate=16000.
  --chunk-size INTEGER            Default value 32768 bytes roughly equals to
                                  one second of audio in default format.
  --reconnect-delay FLOAT         Take a pause in case of network problems.
                                  Default value is 0.5 seconds.
  --reconnect-retry-count INTEGER
                                  Sequentional reconnects before giving up.
                                  Default is 5.
  --silent                        Don't print debug messages, only recognized
                                  text.
  --help                          Show this message and exit.
