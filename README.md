# Encoding Tool

This repo contains the code for a tool I used while importing VHS tapes to mp4 format for uploading to YouTube. It serves as a reference for anyone who might need to do the same. For it to work you need:

* NodeJS installed
* ffmpeg installed
* Probably a Mac. I didn't test this anywhere else. ffmpeg is definitely using a macOS specific flag for encoding.

For the importing process I used Elgato's Game Capture HD software (version 2.11.11) on macOS and paired it with an Elgato HD60 USB capture device. I used an onn. Composite HD to HDMI Converter from Walmart (https://www.walmart.com/ip/onn-Composite-AV-to-HDMI-Converter/575028877) to convert the VCR output to HDMI for the capture card. The converter does not support HDCP which worked perfectly.

The process I followed as to import the video straight from the VHS tape into Game Capture HD. Before importing I listened to a portion of the tape to set the audio level. For my project, each tape was numbered with a three digit ID. I entered this ID as the Video Title into the app. The output directory would then contain just this ID making it easy to find. I then imported the tape. Once done, trimmed the beginning and end of the video using the Edit function. This creates a .json file in the output directory. 

Once edited, I exited the app forcing it to output or update the file and then, if required, ran the `detectvolume.sh` script to see how much more boost the audio needed during the encoding process. The number output from the script is what you give to `encode.js` during the encoding process. 

The `detectvolume.sh` is called as `detectvolume.sh <path to file>`. Using your own discretion, decide what volume level is too low. If the number you see falls within your range then feed that value to `encode.js` as `encode.js <path to project file> 0`. Where 0 is either the value you got or 0 if you don't want to adjust it at all. Any other value is what it will take to get the average volume to about -10 dB. When the process is finished you will find a file called <video title>-final.mp4. 
