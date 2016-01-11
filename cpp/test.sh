#!/bin/sh

#demo key is 6372dda5-9674-4413-85ff-e9d0eb2f99a7

./build.sh
./build/tts-curl-sample 123 6372dda5-9674-4413-85ff-e9d0eb2f99a7 > build/123.wav
./build/asr-curl-sample build/123.wav 6372dda5-9674-4413-85ff-e9d0eb2f99a7
