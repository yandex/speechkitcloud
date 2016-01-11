#!/bin/sh
# building with cmake

mkdir -p build && cd build && cmake ../ && make -j
