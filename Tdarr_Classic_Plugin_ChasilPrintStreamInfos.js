/* eslint-disable */
const details = () => {
	return {
		id: "Tdarr_Classic_Plugin_ChasilPrintStreamInfos",
		Stage: "Pre-processing",
		Name: "[Chasil] Print Stream Infos",
		Operation: "Transcode",
		Description: "[Contains built-in filter] Prints all stream infos.",
		Version: "1.2",
		Link: "",
		Tags: "pre-processing,audio,subtitle,ffmpeg,configurable",
		Inputs: [],
	};
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const plugin = (file, librarySettings, inputs, otherArguments) => {

	const lib = require('../methods/lib')();
	// eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
	inputs = lib.loadDefaultValues(inputs, details);
	
	//Must return this object
	var response = {
		processFile: false,
		preset: "",
		container: ".mp4",
		handBrakeMode: false,
		FFmpegMode: false,
		reQueueAfter: false,
		infoLog: "",
	};
	
	let ffmpegCommandInsert = "";
	let convert = false;
	
	// Go through each stream in the file.
	for (let i = 0; i < file.ffProbeData.streams.length; i += 1) {
		response.infoLog += "\n-------------------------\n";
		response.infoLog += "Codec Type: " + file.ffProbeData.streams[i].codec_type + "\n";
		response.infoLog += "Codec: " + file.ffProbeData.streams[i].codec_name + "\n";
		response.infoLog += "Codec Long Name: " + file.ffProbeData.streams[i].codec_long_name + "\n";
		response.infoLog += "Video Codec Name: " + file.ffProbeData.streams[i].video_codec_name + "\n";
		response.infoLog += "Audio Codec Name: " + file.ffProbeData.streams[i].audio_codec_name + "\n";
		response.infoLog += "Profile: " + file.ffProbeData.streams[i].profile + "\n";
		if (file.ffProbeData.streams[i].tags) {
			if (file.ffProbeData.streams[i].tags.language){
				response.infoLog += "Language: " + file.ffProbeData.streams[i].tags.language + "\n";
			}
			if (file.ffProbeData.streams[i].tags.title){
				response.infoLog += "Title: " + file.ffProbeData.streams[i].tags.title + "\n"
			}
			if (file.ffProbeData.streams[i].tags.codec_id){
				response.infoLog += "Codec ID: " + file.ffProbeData.streams[i].tags.codec_id + "\n"
			}
		}
		response.infoLog += "Media Info: " + file.mediaInfo.track[(i+1)].Format_Commercial_IfAny + "\n";
	}
	response.infoLog += "-------------------------\n";
	
	const ffmpegCommand = `, ${ffmpegCommandInsert} -c copy -map 0 -map_metadata:g -1:g -max_muxing_queue_size 9999`;
	
	if(convert){
		response.processFile = true;
		response.preset = ffmpegCommand;
		response.container = "." + file.container;
		response.handBrakeMode = false;
		response.FFmpegMode = true;
		response.reQueueAfter = true;
		response.infoLog += `☒ File has streams which had to be renamed! \n`;
	}
	return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
