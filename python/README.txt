Description:

This is a streaming client for Yandex speech recognition service (aka Yandex ASR).
Comparing to http-api it provides much more info about a recognized text and the recognition process itself.
Also it has no limit for an input file length.

Install:

You need to provide some python dependencies. Suggest something like this...

sudo apt-get install python2.7 python-setuptools python-pip git protobuf-compiler
git clone https://github.com/yandex/speechkitcloud
cd speechkitcloud/python
protoc -I=asrclient --python_out=asrclient asrclient/*.proto
python ./setup.py sdist

cd dist
sudo pip install <generated-file-name>

...or you can provide the dependencies manually and run ./asrclient-cli.py directly (without install).

1. asrclient-cli.py

Usage:

asrclient-cli.py [OPTIONS] [FILES]...

Options:
  -k, --key TEXT                  You could get it at
                                  https://developer.tech.yandex.ru/. Default
                                  is "paste-your-own-key". 
                                  Use "internal" with Speechkit Box.
  -s, --server TEXT               Default is asr.yandex.net.
  -p, --port INTEGER              Default is 80.
  --format TEXT                   Input file format. Default is
                                  audio/x-pcm;bit=16;rate=16000.
  --model TEXT                    Recognition model: freeform, maps, general, etc.
                                  Use the last one if your sound comes from a
                                  phone call. It's just a model name, sound
                                  format may be different. Default is
                                  freeform.
  --lang TEXT                     Recognition language. ru-RU | en-EN | tr-TR
                                  | uk-UA. Default is ru-RU.
  --chunk-size INTEGER            Default value 65536 bytes roughly equals to
                                  one second of audio in default format.
  --start-with-chunk INTEGER      Use it to send only some part of the input
                                  file. Default is 0.
  --max-chunks-count INTEGER      Use it to send only some part of the input
                                  file. Default means no limit is set.
  --reconnect-delay FLOAT         Take a pause in case of network problems.
                                  Default value is 0.5 seconds.
  --inter-utt-silence FLOAT       A pause between phrases finalization.
                                  Default value is 1.2 seconds.
  --cmn-latency INTEGER           CMN latency parameter. Default value is 50.
  --reconnect-retry-count INTEGER
                                  Sequentional reconnects before giving up.
                                  Default is 5.
  --silent                        Don't print debug messages, only recognized
                                  text.
  --record                        Grab audio from system audio input instead
                                  of files.
  --nopunctuation                 Disable punctuation.
  --uuid TEXT                     UUID of your request. It can be helpful for
                                  further logs analysis. Default is random.
  --ipv4                          Use ipv4 only connection.
  --realtime                      Emulate realtime record recognition.
  --callback-module TEXT          Python module name which should implement
                                  advanced_callback(AddDataResponse).
                                  It takes
                                  corresponding protobuf message as a
                                  parameter. See advanced_callback_example.py
                                  for details.
  --help                          Show this message and exit.


Examples:

asrclient-cli.py --help

asrclient-cli.py --key=active-key-from-your-account sound.wav

asrclient-cli.py --key=active-key-from-your-account --silent sound.wav

asrclient-cli.py --key=active-key-from-your-account --silent --callback-module advanced_callback_example sound.wav

More:

We expect incoming sound in specific format audio/x-pcm;bit=16;rate=16000 (single channel).
To convert some random sound file to this, suggest

sox sound.mp3 -t wav -c 1 --rate 16000 -b 16 -e signed-integer sound.wav

2. ttsclient-cli.py

Usage: ttsclient-cli.py [OPTIONS] [FILE] [TEXTS]...

Options:
  -k, --key TEXT       You could get it at https://developer.tech.yandex.ru/.
                       Default is "paste-your-own-key".
  -s, --server TEXT    Default is tts.voicetech.yandex.net.
  -p, --port INTEGER   Default is 80.
  --lang TEXT          Synthesis language. ru-RU | en-EN | tr-TR | uk-UA.
                       Default is ru-RU.
  --speaker TEXT       Speaker for speech synthesis. Call this script with
                       --list-speakers flag to get speakers list.
  --emotion TEXT       Emotion for speech synthesis. Available values: good,
                       neutral, evil. Default value depends on speaker's
                       original emotion.
  --gender TEXT        Speaker's gender for speech synthesis. Available
                       values: male, female. Default value depends on
                       speaker's original gender.
  --textfile FILENAME  Read text from this file instead of command line
                       arguments.
  --uuid TEXT          UUID of your request. It can be helpful for further
                       logs analysis. Default is random.
  --ipv4               Use ipv4 only connection.
  --list-speakers      Only list available speakers, don't try to generate
                       anything.
  --silent             Don't print debug messages.
  --help               Show this message and exit.

Examples:

ttsclient-cli.py --help

ttsclient-cli.py --key=active-key-from-your-account --list-speakers

ttsclient-cli.py --key=active-key-from-your-account --speaker jane --lang en-EN out.wav "Hello!"

ttsclient-cli.py --key=active-key-from-your-account --speaker jane --textfile request.txt out.wav

More:

We generate sound in format audio/x-wav, single channel, 16000Hz, 16-bit signed integer PCM encoding.

Useful links:

http://sox.sourceforge.net/ - sound conversion library and utility.
https://pypi.python.org/pypi/pip - python package manager.
https://developer.tech.yandex.ru - obtain your key.
https://tech.yandex.ru/speechkit/cloud/ - more about Yandex ASR.
