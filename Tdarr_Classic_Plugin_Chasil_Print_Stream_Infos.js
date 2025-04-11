/* eslint-disable */
const details = () => {
	return {
		id: "Tdarr_Classic_Plugin_Chasil_Print_Stream_Infos",
		Stage: "Pre-processing",
		Name: "[Chasil] Print Stream Infos",
		Operation: "Transcode",
		Description: "[Contains built-in filter] Prints all stream infos.",
		Version: "1.4",
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

	//get audio tracks for additional information because not every audio stream has all information inside the stream[] e.g. DTS-ES encoded streams
	const existingAudioTracks = file.mediaInfo.track.filter(track => track['@type'].toLowerCase() === "audio");
	let audioIndex = 0;

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
		if (stream.channels) {
		    let channels = stream.channels || existingAudioTracks[audioIndex]?.Channels;
            let channelLayout = stream.channel_layout || existingAudioTracks[audioIndex]?.ChannelLayout;
            let formattedChannels = (channelLayout || `${channels}`).replace(/\(.*\)/g, "").trim(); // cuts additions like "(side)"

            response.infoLog += "Channel layout: " +
                (formattedChannels.toLowerCase() === "stereo" ? "2.0" : formattedChannels) + "\n";
		}

        if (stream.codec_type.toLowerCase() === 'audio') {
            let bitrate = stream.bit_rate || existingAudioTracks[audioIndex]?.BitRate;
            if(bitrate) {
                response.infoLog += "Audio bitrate: " + `${Math.round(bitrate / 1000)} kbps` + "\n";
            } else if (stream.tags?.quality_value || existingAudioTracks[audioIndex]?.Quality_Value) {
                // fallback to quality value
                let qualityValue = stream.tags?.quality_value || existingAudioTracks[audioIndex]?.Quality_Value || "unknown QV";
                response.infoLog += "Audio Quality: " + qualityValue + "\n";
            }
		    audioIndex += 1;
		}
	}
	response.infoLog += "-------------------------\n";
	
	return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
