cmake_minimum_required(VERSION 2.6)

project(asr-curl-sample)

add_executable(asr-curl-sample asr.cpp )
target_link_libraries(asr-curl-sample curl)

add_executable(tts-curl-sample tts.cpp)
target_link_libraries(tts-curl-sample curl)
