/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Change_Video_Properties",
        Stage: "Pre-processing",
        Name: "[Chasil] Change video properties if necessary",
        Type: "Video",
        Operation: "Modify",
        Description: "The plugin removes file title, video title, video language, and video forced flag if necessary.",
        Version: "1.1",
        Link: "",
        Tags: "pre-processing,video,ffmpeg,configurable",
        Inputs: [
            {
                name: "remove_title",
                type: "boolean",
                defaultValue: true,
                inputUI: {
                    type: 'dropdown',
                    options: [
                        'false',
                        'true',
                    ],
                },
                tooltip: "Remove the files title if necessary.",
            },
            {
                name: "remove_video_title",
                type: "boolean",
                defaultValue: true,
                inputUI: {
                    type: 'dropdown',
                    options: [
                        'false',
                        'true',
                    ],
                },
                tooltip: "Remove the video title if necessary.",
            },
            {
                name: "remove_video_language",
                type: "boolean",
                defaultValue: true,
                inputUI: {
                    type: 'dropdown',
                    options: [
                        'false',
                        'true',
                    ],
                },
                tooltip: "Remove the video language if necessary.",
            },
            {
                name: "remove_video_forced_flag",
                type: "boolean",
                defaultValue: true,
                inputUI: {
                    type: 'dropdown',
                    options: [
                        'false',
                        'true',
                    ],
                },
                tooltip: "Remove the video forced flag if necessary.",
            },
        ],
    };
};

const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require("../methods/lib")();

    inputs = lib.loadDefaultValues(inputs, details);
    const response = {
        processFile: false,
        preset: "",
        container: ".mkv",
        handBrakeMode: false,
        FFmpegMode: false,
        reQueueAfter: false,
        infoLog: "",
    };

    // Normalize inputs to booleans (dropdowns deliver strings)
    const removeTitle = String(inputs.remove_title) === 'true';
    const removeVideoTitle = String(inputs.remove_video_title) === 'true';
    const removeVideoLanguage = String(inputs.remove_video_language) === 'true';
    const removeVideoForcedFlag = String(inputs.remove_video_forced_flag) === 'true';

    if (!removeTitle && !removeVideoTitle && !removeVideoLanguage && !removeVideoForcedFlag) {
        response.processFile = false;
        response.infoLog += "☑ All options disabled. Nothing to do.\n";
        return response;
    }

    // Check if file is a video. If it isn't then exit plugin.
    if (file.fileMedium !== 'video') {
        console.log('File is not video');
        response.infoLog += '☒ File is not video.\n';
        response.processFile = false;
        return response;
    }

    let ffmpegCommandInsert = "";
    let convert = false;

    // Check if overall file metadata title is not empty, if it's not empty set to "".
    if (removeTitle) {
        try {
            if (typeof file.meta.Title !== 'undefined' && file.meta.Title !== '""' && file.meta.Title !== '') {
                response.infoLog += `☒ File title is not empty. Removing title from file.\n`;
                ffmpegCommandInsert += '-metadata title= ';
                convert = true;
            } else {
                response.infoLog += `☑ File title is already empty.\n`;
            }
        } catch (err) {
            response.infoLog += `☑ File title is already empty.\n`;
        }
    }

    // Collect information of video streams
    const existingVideoStreams = file.ffProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "video");

    existingVideoStreams.forEach((stream, index) => {
        try {
            if (removeVideoTitle) {
                if (typeof stream.tags !== 'undefined' && typeof stream.tags.title !== 'undefined' && stream.tags.title !== '""' && stream.tags.title !== '') {
                    response.infoLog += `☒ Video stream ${index}: Title is not empty. Removing title.\n`;
                    ffmpegCommandInsert += `-metadata:s:v:${index} title= `;
                    convert = true;
                } else {
                    response.infoLog += `☑ Video stream ${index}: Title is already empty.\n`;
                }
            }

            if (removeVideoLanguage) {
                if (typeof stream.tags !== 'undefined' && typeof stream.tags.language !== 'undefined' && stream.tags.language !== '""' && stream.tags.language !== '') {
                    response.infoLog += `☒ Video stream ${index}: Language is set. Removing language.\n`;
                    ffmpegCommandInsert += `-metadata:s:v:${index} language= `;
                    convert = true;
                } else {
                    response.infoLog += `☑ Video stream ${index}: Language is already empty.\n`;
                }
            }

            if (removeVideoForcedFlag) {
                if (stream.disposition && stream.disposition.forced) {
                    response.infoLog += `☒ Video stream ${index}: Forced flag is set. Removing forced flag.\n`;
                    ffmpegCommandInsert += `-disposition:v:${index} -forced `;
                    convert = true;
                } else {
                    response.infoLog += `☑ Video stream ${index}: Forced flag is already unset.\n`;
                }
            }
        } catch (err) {
            response.infoLog += `⚠ Video stream ${index}: Error reading stream properties, skipping.\n`;
        }
    });

    if (convert) {
        const ffmpegCommand = `, -fflags +bitexact -flags:v +bitexact -flags:a +bitexact ${ffmpegCommandInsert} -c copy -map 0 -max_muxing_queue_size 9999`;
        response.processFile = true;
        response.preset = ffmpegCommand;
        response.container = "." + file.container;
        response.handBrakeMode = false;
        response.FFmpegMode = true;
        response.reQueueAfter = true;
        response.infoLog += "☒ File will be processed to apply changes.\n";
    } else {
        response.infoLog += '☑ No modifications necessary.\n';
    }
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
