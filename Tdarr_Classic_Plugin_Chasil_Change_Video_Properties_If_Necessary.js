/* eslint-disable */
const details = () => {
	return {
		id: "Tdarr_Classic_Plugin_Chasil_Change_Video_Properties",
		Stage: "Pre-processing",
		Name: "[Chasil] Change video properties if necessary",
		Type: "Video",
		Operation: "Modify",
		Description: "The plugin removes video title, language, and forced switch if necessary.",
		Version: "1.0",
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

	if (!inputs.remove_title && !inputs.remove_video_title && !inputs.remove_video_language && !inputs.remove_video_forced_flag) {
		response.processFile = false;
		response.infoLog += "☑ No modifications necessary. Nothing to do.\n";
		return response;
	}

	let ffmpegCommandInsert = "";
	let convert = false;

	// Check if file is a video. If it isn't then exit plugin.
	if (file.fileMedium !== 'video') {
		// eslint-disable-next-line no-console
		console.log('File is not video');
		response.infoLog += '☒ File is not video \n';
		response.processFile = false;
		return response;
	}

	// Check if overall file metadata title is not empty, if it's not empty set to "".
	if (inputs.remove_title && !(typeof file.meta.Title === 'undefined' || file.meta.Title === '""' || file.meta.Title === '')) {
		try {
			response.infoLog += `☒ File title is not empty. Removing title from file \n`;
			ffmpegCommandInsert += '-metadata title= ';
			convert = true;
		} catch (err) {
			// Error
		}
	}


	// Collect information of video streams
	const existingVideoStreams = file.ffProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "video");
	// Check if there already is a stream in target format for each language in the wrong format
	existingVideoStreams.forEach((stream, index) => {
		try {
			// Check if stream title is not empty, if it's not empty set to "".
			if (inputs.remove_video_title && !(typeof stream.tags.title === 'undefined' || stream.tags.title === '""' || stream.tags.title === '')) {
				response.infoLog += `☒ Video stream title is not empty. Removing title from video stream ${index} \n`;
				ffmpegCommandInsert += `-metadata:s:v:${index} title= `;
				convert = true;
			}

			if (inputs.remove_video_language && !(typeof stream.tags.language === 'undefined' || stream.tags.language === '""' || stream.tags.language === '')) {
				response.infoLog += `☒ Video stream language is set. Removing language from video stream ${index} \n`;
				ffmpegCommandInsert += `-metadata:s:v:${index} language= `;
				convert = true;
			}

			if (inputs.remove_video_forced_flag && stream.disposition.forced) {
				response.infoLog += `☒ Video stream forced flag is set. Removing forced flag from video stream ${index} \n`;
				ffmpegCommandInsert += `-disposition:v:${index} -forced `;
				convert = true;
			}
		} catch (err) {
			// Error
		}
	});

	const ffmpegCommand = `, -fflags +bitexact -flags:v +bitexact -flags:a +bitexact ${ffmpegCommandInsert} -c copy -map 0 -max_muxing_queue_size 9999`;

	if (convert === true) {
		response.processFile = true;
		response.preset = ffmpegCommand;
		response.container = "." + file.container;
		response.handBrakeMode = false;
		response.FFmpegMode = true;
		response.reQueueAfter = true;
		response.infoLog += "☒ Video properties modified if necessary.\n";
	} else {
		response.infoLog += '☑File has no title metadata \n';
	}
	return response;
};

module.exports.details = details;
module.exports.plugin = plugin;