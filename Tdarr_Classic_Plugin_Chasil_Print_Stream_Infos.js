/* eslint-disable */
const details = () => {
	return {
		id: "Tdarr_Classic_Plugin_Chasil_Print_Stream_Infos",
		Stage: "Pre-processing",
		Name: "[Chasil] Print Stream Infos",
		Operation: "Transcode",
		Description: "[Contains built-in filter] Prints all stream infos.",
		Version: "1.3",
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
		processFile: false,  // No processing needed since this is for logging only
		preset: "",
		container: ".mp4",  // Default to .mp4, unless changed by stream's container
		handBrakeMode: false,
		FFmpegMode: false,
		reQueueAfter: false,
		infoLog: "",
	};
	
	// Go through each stream in the file.
	for (let i = 0; i < file.ffProbeData.streams.length; i += 1) {
		const stream = file.ffProbeData.streams[i];
		response.infoLog += "\n-------------------------\n";
		response.infoLog += "Codec Type: " + stream.codec_type + "\n";
		response.infoLog += "Codec: " + stream.codec_name + "\n";
		response.infoLog += "Codec Long Name: " + stream.codec_long_name + "\n";
		
		// Only log if the field exists
		if (stream.video_codec_name) {
			response.infoLog += "Video Codec Name: " + stream.video_codec_name + "\n";
		}
		if (stream.audio_codec_name) {
			response.infoLog += "Audio Codec Name: " + stream.audio_codec_name + "\n";
		}
		if (stream.profile) {
			response.infoLog += "Profile: " + stream.profile + "\n";
		}
		if (stream.tags) {
			if (stream.tags.language){
				response.infoLog += "Language: " + stream.tags.language + "\n";
			}
			if (stream.tags.title){
				response.infoLog += "Title: " + stream.tags.title + "\n"
			}
			if (stream.tags.codec_id){
				response.infoLog += "Codec ID: " + stream.tags.codec_id + "\n"
			}
		}
		if (file.mediaInfo && file.mediaInfo.track && file.mediaInfo.track[i+1] && file.mediaInfo.track[(i+1)].Format_Commercial_IfAny) {
			response.infoLog += "Media Info: " + file.mediaInfo.track[(i+1)].Format_Commercial_IfAny + "\n";
		}
	}
	response.infoLog += "-------------------------\n";
	
	return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
