#!/bin/bash

# detect volume level and output how much gain is needed to get it to -10

DIR=$1

ffmpeg -i ${DIR}/Segment_0001.mp4 -c:v null audio.wav > /dev/null 2>&1
VOLUME=$(ffmpeg -i audio.wav -filter:a volumedetect -f null /dev/null 2>&1 | grep mean_volume | awk '{print $5}')
ROUNDED=$(printf "%.0f\n" ${VOLUME})

if [ ${ROUNDED} -lt -15 ]; then
  expr -10 - ${ROUNDED}
else
  echo 0
fi
rm -f audio.wav
