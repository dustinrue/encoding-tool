#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const { spawn } = require('child_process');

if (args.length < 2 || isNaN(parseFloat(args[1]))) {
  console.log("Usage: node encode-m1.js <project-path> <volume-db>");
  process.exit(1);
}

/**
 * Reads the json file created by Elgato Game Capture HD to get the
 * start and end time of the main video segment. Only supports trimming
 * the start and end of the clip and only one segment
 *
 * @param {string} sourcePath
 */
function readFile(sourcePath) {
  const normalizedPath = path.normalize(sourcePath).replace(/\/+$/, '');
  const parts = normalizedPath.split(path.sep);
  const projectName = parts[parts.length - 1];

  return new Promise((resolve, reject) => {
    fs.readFile(path.join(normalizedPath, `${projectName}.json`), 'utf8', (err, contents) => {
      if (err) return reject(err);

      let json;
      try {
        json = JSON.parse(contents);
      } catch (e) {
        return reject(new Error(`Failed to parse project JSON: ${e.message}`));
      }

      const timeBase = json.items[0]['video segments'][0].TimeBase;
      const metadata = {
        'itemId': json.items[0]['item title'],
        'title': json.items[0]['game title'],
        'description': json.items[0].description,
        'mediaFileName': path.join(normalizedPath, json.items[0]['video segments'][0].MediaFileName),
        'timeBase': timeBase,
        'startTime': json.items[0]['video segments'][0].StartTime,
        'offsetTime': json.items[0]['video segments'][0].OffsetTime / timeBase,
        'endTime': json.items[0]['video segments'][0].EndTime / timeBase,
      };
      resolve(metadata);
    });
  });
}

/**
 * Encodes the file while also correcting the stretched aspect ratio.
 * Uses h264_videotoolbox with allow_sw=0 to force the M1 Media Engine.
 * @param {object} metadata
 * @param {number} volume - how much to bump up the volume in dB. Use detectvolume.sh to get value
 */
function encodeFile(metadata, volume) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', metadata.mediaFileName,
      '-vf', 'scale=720:540',
      '-aspect', '720:540',
      '-ss', `${Math.floor(metadata.offsetTime)}`,
      '-t', `${Math.floor(metadata.endTime)}`,
      '-c:v', 'h264_videotoolbox',
      '-allow_sw', '0',        // force hardware encoder — no software fallback
      '-realtime', '1',        // hint encoder to favour speed over compression ratio
      '-filter:a', `volume=${volume}dB, highpass=f=100`,
      '-b:v', '1650k',
      `${metadata.itemId}.mp4`
    ]);

    ffmpeg.stdout.on('data', (data) => {
      process.stdout.write(data.toString());
    });

    ffmpeg.stderr.on('data', (data) => {
      process.stdout.write(data.toString('utf-8'));
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg (encode) exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Combines the captured video with a short intro file
 * @param {object} metadata
 */
function combineFiles(metadata) {
  const files = `file 'intro60.mp4'\nfile '${metadata.itemId}.mp4'\n`;

  fs.writeFileSync('files.txt', files);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'concat',
      '-i', 'files.txt',
      '-c', 'copy',
      `${metadata.itemId}-final.mp4`
    ]);

    ffmpeg.stdout.on('data', (data) => {
      process.stdout.write(data.toString());
    });

    ffmpeg.stderr.on('data', (data) => {
      process.stdout.write(data.toString('utf-8'));
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg (combine) exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

function cleanup(metadata) {
  fs.unlinkSync(`${metadata.itemId}.mp4`);
  try { fs.unlinkSync('files.txt'); } catch (_) {}
}

async function run() {
  const metadata = await readFile(args[0]);
  await encodeFile(metadata, parseFloat(args[1]));
  await combineFiles(metadata);
  cleanup(metadata);
}

run().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
