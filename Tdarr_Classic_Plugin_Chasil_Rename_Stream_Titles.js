/* eslint-disable */
const details = () => {
	return {
		id: "Tdarr_Classic_Plugin_Chasil_Rename_Stream_Titles",
		Stage: "Pre-processing",
		Name: "[Chasil] Renames audio and subtitle stream titles",
		Operation: "Transcode",
		Description: "[Contains built-in filter] Renames audio and subtitle stream titles based on language and codec.",
		Version: "2.0",
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
			},
            {
                name: "rename_language",
                type: 'string',
                defaultValue: 'english',
                inputUI: {
                    type: 'dropdown',
                    options: ['english', 'german'],
                },
                tooltip: 'Choose the language for renaming streams.\\n(default: english)',
             }
		],
	};
};

const languageMap = {
    //Croatian
    hr: { english: "Croatian", german: "Kroatisch" },
    hrv: { english: "Croatian", german: "Kroatisch" },
    //Czech
    cs: { english: "Czech", german: "Tschechisch" },
    cze: { english: "Czech", german: "Tschechisch" },
    //Danish
    da: { english: "Danish", german: "Dänisch" },
    dan: { english: "Danish", german: "Dänisch" },
    //Dutch
    nl: { english: "Dutch", german: "Niederländisch" },
    dut: { english: "Dutch", german: "Niederländisch" },
    //English
    en: { english: "English", german: "Englisch" },
    eng: { english: "English", german: "Englisch" },
    //Finnish
    fi: { english: "Finnish", german: "Finnisch" },
    fin: { english: "Finnish", german: "Finnisch" },
    //French
    fr: { english: "French", german: "Französisch" },
    fre: { english: "French", german: "Französisch" },
    //German
    de: { english: "German", german: "Deutsch" },
    ger: { english: "German", german: "Deutsch" },
    deu: { english: "German", german: "Deutsch" },
    //Greek
    el: { english: "Greek", german: "Griechisch" },
    gre: { english: "Greek", german: "Griechisch" },
    //Hungarian
    hu: { english: "Hungarian", german: "Ungarisch" },
    hun: { english: "Hungarian", german: "Ungarisch" },
    //Indonesian
    id: { english: "Indonesian", german: "Indonesisch" },
    ind: { english: "Indonesian", german: "Indonesisch" },
    //Italian
    it: { english: "Italian", german: "Italienisch" },
    ita: { english: "Italian", german: "Italienisch" },
    //Japanese
    ja: { english: "Japanese", german: "Japanisch" },
    jpn: { english: "Japanese", german: "Japanisch" },
    //Malayalam
    ml: { english: "Malayalam", german: "Malayalam" },
    mal: { english: "Malayalam", german: "Malayalam" },
    //Norwegian
    no: { english: "Norwegian", german: "Norwegisch" },
    nor: { english: "Norwegian", german: "Norwegisch" },
    //Polish
    pl: { english: "Polish", german: "Polnisch" },
    pol: { english: "Polish", german: "Polnisch" },
    //Portuguese
    pt: { english: "Portuguese", german: "Portugiesisch" },
    por: { english: "Portuguese", german: "Portugiesisch" },
    //Russian
    ru: { english: "Russian", german: "Russisch" },
    rus: { english: "Russian", german: "Russisch" },
    //Spanish
    es: { english: "Spanish", german: "Spanisch" },
    spa: { english: "Spanish", german: "Spanisch" },
    //Swedish
    sv: { english: "Swedish", german: "Schwedisch" },
    swe: { english: "Swedish", german: "Schwedisch" },
    //Turkish
    tr: { english: "Turkish", german: "Türkisch" },
    tur: { english: "Turkish", german: "Türkisch" },
    //Ukrainian
    uk: { english: "Ukrainian", german: "Ukrainisch" },
    ukr: { english: "Ukrainian", german: "Ukrainisch" },
};

const additionMap = {
    english: {
        visual_impaired: "Visually Impaired",
        comment: "Commentary",
        hearing_impaired: "SDH",
        forced: "Forced"
    },
    german: {
        visual_impaired: "Sehgeschädigt",
        comment: "Kommentare",
        hearing_impaired: "Hörgeschädigt",
        forced: "Erzwungen"
    }
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
		container: `.${file.container}`,
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

	if (!file.ffProbeData || !file.ffProbeData.streams) {
        response.infoLog += "⚠ No ffProbeData nor streams found.\n";
        return response;
    }

	const selectedLanguage = inputs.rename_language || "english";

	let titleLang = "???";
	let titleAddition = "";
	let titleSpacer =" | ";
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
		    titleLang = languageMap[stream.tags.language]?.[selectedLanguage] || "???";
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
				if (existingAudioTracks[audioIndex] && existingAudioTracks[audioIndex].Format_Commercial_IfAny) {
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
			const additionLanguage = additionMap[selectedLanguage] || additionMap.english;  // Fallback to english

            if (stream.disposition.visual_impaired) {
                titleAddition = additionLanguage.visual_impaired;
            }
            if (stream.disposition.comment) {
                titleAddition = additionLanguage.comment;
            }
            if (stream.disposition.hearing_impaired) {
                titleAddition = additionLanguage.hearing_impaired;
            }
            if (stream.disposition.forced) {
                titleAddition = additionLanguage.forced;
            }
		}
		
		// ==================== Check current title ====================
		correctTitle = titleLang + (titleAddition ? " (" + titleAddition + ")" : "") + titleSpacer + titleCodec;

		if (stream.codec_type.toLowerCase() === 'audio' && inputs.rename_audio_streams) {
			if (stream.tags && stream.tags.title !== correctTitle) {
				ffmpegCommandInsert += `-metadata:s:a:${audioIndex} "title=${correctTitle}" `;
				convert = true;
			}
			audioIndex += 1;
		}
		if (stream.codec_type.toLowerCase() === 'subtitle' && inputs.rename_subtitle_streams) {
			if (stream.tags && stream.tags.title !== correctTitle) {
				ffmpegCommandInsert += `-metadata:s:s:${subtitleIndex} "title=${correctTitle}" `;
				convert = true;
			}
			subtitleIndex += 1;
		}
		
		// reset to make sure to find undefined streams which have to be added to the plugin
		titleLang = "???";
		titleAddition = "";
		titleCodec = "???";
		correctTitle = "???"
	}
	
	
	const ffmpegCommand = `, ${ffmpegCommandInsert} -c copy -map 0 -max_muxing_queue_size 9999`;
	
	if(convert) {
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
