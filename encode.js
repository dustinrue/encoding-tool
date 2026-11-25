#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const { spawn } = require('child_process');

// h264_videotoolbox only exists in macOS builds of ffmpeg; elsewhere use the software encoder (override with ENCODER=...)
const encoder = process.env.ENCODER || (process.platform === 'darwin' ? 'h264_videotoolbox' : 'libx264');
const encoderArgs = encoder === 'libx264' ? ['-preset', process.env.X264_PRESET || 'medium', '-profile:v', 'high', '-pix_fmt', 'yuv420p'] : [];

if (args.length == 0) {
  console.log("Give me the path");
  process.exit();
}

/**
 * Reads the json file created by Elgato Game Capture HD to get the 
 * start and end time of the main video segment. Only supports trimming 
 * the start and end of the clip and only one segment
 * 
 * @param {string} sourcePath 
 */
function readFile(sourcePath) {
  var pathWorker = path.normalize(sourcePath);
  const originalPath = pathWorker;

  if (pathWorker.slice(-1) == "/") {
    pathWorker = pathWorker.substring(0, pathWorker.length - 1);
  }

  pathWorker = pathWorker.split(path.sep);

  const projectName = pathWorker[pathWorker.length - 1];

  return new Promise((resolve, reject) => {
    fs.readFile(`${originalPath}${path.sep}${projectName}.json`, 'utf8', async (err, contents) => {
      const json = JSON.parse(contents);
      const timeBase = json.items[0]['video segments'][0].TimeBase;
      const metadata = {
        'itemId': json.items[0]['item title'],
        'title': json.items[0]['game title'],
        'description': json.items[0].description,
        'mediaFileName': `${originalPath}${path.sep}${json.items[0]['video segments'][0].MediaFileName}`,
        'timeBase': timeBase,
        'startTime': json.items[0]['video segments'][0].StartTime,
        'offsetTime': json.items[0]['video segments'][0].OffsetTime  / timeBase,
        'endTime': json.items[0]['video segments'][0].EndTime / timeBase,
      }
      resolve(metadata);
    });
  });
}

/**
 * Encodes the file while also correcting the stretched aspect ratio.
 * @param {object} metadata 
 * @param {int} volume - how much to bump up the volume in dB if needed. Use detecthvolume.sh to get value
 */
function encodeFile(metadata, volume) {
  return new Promise((resolve, reject) => {

    const ffmpeg = spawn('ffmpeg', [
      '-i', `${metadata.mediaFileName}`,
      '-vf', 'scale=720:540',
      '-aspect', '720:540',
      '-ss', `${Math.floor(metadata.offsetTime)}`,
      '-t', `${Math.floor(metadata.endTime)}`,
      '-c:v', encoder,
      ...encoderArgs,
      '-filter:a', `volume=${volume}dB, highpass=f=100`,
      '-b:v', '1650k',
      `${metadata.itemId}.mp4`
    ]);

    ffmpeg.stdout.on('data', (data) => {
      process.stdout.write(data.toString('utf-8'));
    });
  
    ffmpeg.stderr.on('data', (data) => {
      process.stdout.write(data.toString('utf-8'));
    })
  
    ffmpeg.on('error', (error) => {
      console.log(`error: ${error}`);
    });
  
    ffmpeg.on('close', (code) => {
      resolve(code);
    })
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
      '-f', `concat`,
      '-i', 'files.txt',
      '-c', 'copy', 
      `${metadata.itemId}-final.mp4`
    ]);

    ffmpeg.stdout.on('data', (data) => {
      process.stdout.write(data.toString('utf-8'));
    });
  
    ffmpeg.stderr.on('data', (data) => {
      process.stdout.write(data.toString('utf-8'));
    })
  
    ffmpeg.on('error', (error) => {
      console.log(`error: ${error}`);
    });
  
    ffmpeg.on('close', (code) => {
      resolve(code);
    })
  });
}


function cleanup(metadata) {
  if (fs.existsSync(`${metadata.itemId}.mp4`)) fs.unlinkSync(`${metadata.itemId}.mp4`);
}

async function run() {
  const metadata = await readFile(args[0]);
  if (await encodeFile(metadata, args[1]) !== 0) {
    console.error(`\nEncoding with ${encoder} failed; nothing was combined.`);
    process.exit(1);
  }
  if (await combineFiles(metadata) !== 0) {
    console.error(`\nCombining with the intro failed; ${metadata.itemId}.mp4 was kept.`);
    process.exit(1);
  }
  await cleanup(metadata);
}

run();
