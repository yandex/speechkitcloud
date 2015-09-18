Install:

You need to provide some python dependencies. Suggest something like this...

sudo apt-get install python2.7 python-setuptools python-pip git
git clone https://github.com/yandex/speechkitcloud
cd speechkitcloud/python
python ./setup.py sdist
cd dist
sudo pip install <generated-file-name>


Usage:

asrclient-cli.py [OPTIONS] [FILES]...


Options:
  -k, --key TEXT                  You could get it at
                                  https://developer.tech.yandex.ru/. Default
                                  is "paste-your-own-key".
  -s, --server TEXT               Default is asr.yandex.net.
  -p, --port INTEGER              Default is 80.
  --ipv4                          Connect only over IPv4.
  --format TEXT                   Input file format. Default is
                                  audio/x-pcm;bit=16;rate=16000.
  --model TEXT                    Recognition model. freeform | freeform8alaw.
                                  Use the last one if your sound comes from a
                                  phone call. It's just a model name, sound
                                  format may be different. Default is
                                  freeform.
  --lang TEXT                     Language of speech. ru-RU | en-EN | tr-TR | uk-UA.
                                  Default is ru-RU.
  --uuid TEXT                     Identifier of your query. Default is random.
  --chunk-size INTEGER            Default value 32768 bytes roughly equals to
                                  one second of audio in default format.
  --start-with-chunk INTEGER      Use it to send only some part of the input
                                  file. Default is 0.
  --max-chunks-count INTEGER      Use it to send only some part of the input
                                  file. Default means no limit is set.
  --reconnect-delay FLOAT         Take a pause in case of network problems.
                                  Default value is 0.5 seconds.
  --reconnect-retry-count INTEGER
                                  Sequentional reconnects before giving up.
                                  Default is 5.
  --silent                        Don't print debug messages, only recognized
                                  text.
  --help                          Show this message and exit.

There is also optional support for pyaudio+portaudio. If you manage to install it see:

  --record                        Grab audio from system audio input instead of files.


Examples:

asrclient-cli.py --help

asrclient-cli.py --key=active-key-from-your-account sound.wav


More:

We expect incoming sound in specific format audio/x-pcm;bit=16;rate=16000 (single channel).
To convert some random sound file to this, suggest

sox sound.mp3 -t wav -c 1 --rate 16000 -b 16 -e signed-integer sound.wav


Useful links:

http://sox.sourceforge.net/ - sound conversion library and utility.
https://pypi.python.org/pypi/pip - python package manager.
https://developer.tech.yandex.ru - obtain your key.
