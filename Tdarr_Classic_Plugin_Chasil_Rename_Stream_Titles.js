/* eslint-disable */
const details = () => {
	return {
		id: "Tdarr_Classic_Plugin_Chasil_Rename_Stream_Titles",
		Stage: "Pre-processing",
		Name: "[Chasil] Renames audio and subtitle stream titles",
		Operation: "Transcode",
		Description: "[Contains built-in filter] Renames audio and subtitle stream titles based on language and codec.",
		Version: "1.1",
		Link: "",
		Tags: "pre-processing,audio,subtitle,ffmpeg,configurable",
		Inputs: [
			{
				name: "rename_audio_streams",
				type: 'boolean',
				defaultValue: true,
				inputUI: {
					type: 'dropdown',
					options: [
						'false',
						'true',
					],
				},
				tooltip: 'Choose if you want to rename audio streams.\\n(default: true)',
			},
			{
				name: "rename_subtitle_streams",
				type: 'boolean',
				defaultValue: true,
				inputUI: {
					type: 'dropdown',
					options: [
						'false',
						'true',
					],
				},
				tooltip: 'Choose if you want to rename subtitle streams.\\n(default: true)',
			}
		],
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

	if (!inputs.rename_audio_streams && !inputs.rename_subtitle_streams) {
		response.processFile = false;
		response.infoLog += "☑ No modifications necessary. Nothing to do.\n";
		return response;
	}
	
	let titleLang = "??? ";
	let titleAddition = "";
	let titleSpacer ="| ";
	let titleCodec = "???";
	let correctTitle = "???";
	let audioIndex = 0;
	let subtitleIndex = 0;
	let ffmpegCommandInsert = "";
	let convert = false;
	
	//get audio tracks for additional information because not every audio stream has all information inside the stream[] e.g. DTS-ES encoded streams
	const existingAudioTracks = file.mediaInfo.track.filter(track => track['@type'].toLowerCase() === "audio");
	
	// Go through each stream in the file.
	for (let i = 0; i < file.ffProbeData.streams.length; i += 1) {
		const stream = file.ffProbeData.streams[i];
		// ==================== LANGUAGE ====================
		if (stream.tags && stream.tags.language) {
			// German
			if (stream.tags.language === "ger" || stream.tags.language === "deu") {
				titleLang = "Deutsch ";
			}
			// English
			if (stream.tags.language === "eng") {
				titleLang = "Englisch ";
			}
			// Japanese
			if (stream.tags.language === "jpn") {
				titleLang = "Japanisch ";
			}
		}
		
		// ==================== CODEC ====================
		if (stream.codec_name) {
			// AC3
			if (stream.codec_name === "ac3") {
				titleCodec = "AC3";
			}
			// AAC
			if (stream.codec_name === "aac") {
				titleCodec = "AAC";
			}
			// DTS
			if (stream.codec_name === "dts") {
				titleCodec = "DTS";
				if (existingAudioTracks[audioIndex].Format_Commercial_IfAny !== undefined) {
					titleCodec = existingAudioTracks[audioIndex].Format_Commercial_IfAny;
				}
			}
			// E-AC3
			if (stream.codec_name === "eac3") {
				titleCodec = "E-AC3";
			}
			// Opus
			if (stream.codec_name === "opus") {
				titleCodec = "Opus";
			}
			// TrueHD
			if (stream.codec_name === "truehd") {
				titleCodec = "TrueHD";
			}
			// TrueHD Atmos
			
			// Advanced SubStation Alpha
			if (stream.codec_name === "ass") {
				titleCodec = "ASS";
			}
			// SubStation Alpha
			if (stream.codec_name === "ssa") {
				titleCodec = "SSA";
			}
			// HDMV PGS
			if (stream.codec_name === "hdmv_pgs_subtitle") {
				titleCodec = "HDMV PGS";
			}
			// SubRip/SRT
			if (stream.codec_name === "subrip") {
				titleCodec = "SRT";
			}
			// VobSub
			if (stream.codec_name === "dvd_subtitle") {
				titleCodec = "VobSub";
			}
		}
		
		// ==================== DISPOSITION ====================
		if (stream.disposition) {
			// Visual Impaired
			if (stream.disposition.visual_impaired){
				titleAddition = "Sehgeschädigt ";
			}
			// Comment
			if (stream.disposition.comment){
				titleAddition = "Kommentare ";
			}
			// Hearing Impaired
			if (stream.disposition.hearing_impaired){
				titleAddition = "SDH ";
			}
			// Forced
			if (stream.disposition.forced){
				titleAddition = "Forced ";
			}
		}
		
		// ==================== Check current title ====================
		correctTitle = titleLang + titleAddition + titleSpacer + titleCodec;
		
		if (stream.codec_type.toLowerCase() === 'audio' && inputs.rename_audio_streams){
			if (stream.tags.title != correctTitle){
				ffmpegCommandInsert += `-metadata:s:a:${audioIndex} "title=${correctTitle}" `;
				convert = true;
			}
			audioIndex += 1;
		}
		if (stream.codec_type.toLowerCase() === 'subtitle' && inputs.rename_subtitle_streams){
			if (stream.tags.title != correctTitle){
				ffmpegCommandInsert += `-metadata:s:s:${subtitleIndex} "title=${correctTitle}" `;
				convert = true;
			}
			subtitleIndex += 1;
		}
		
		// reset to make sure to find undefined streams which have to be added to the plugin
		titleLang = "??? ";
		titleAddition = "";
		titleCodec = "???";
		correctTitle = "???"
	}
	
	
	const ffmpegCommand = `, ${ffmpegCommandInsert} -c copy -map 0 -max_muxing_queue_size 9999`;
	
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
