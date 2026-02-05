/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Rename_Stream_Titles",
        Stage: "Pre-processing",
        Name: "[Chasil] Renames audio and subtitle stream titles",
        Operation: "Transcode",
        Description: "[Contains built-in filter] Renames audio and subtitle stream titles based on language and codec.",
        Version: "3.7",
        Link: "",
        Tags: "pre-processing,audio,subtitle,ffmpeg,configurable",
        Inputs: [
            {
                name: "rename_audio_streams",
                type: 'boolean',
                defaultValue: true,
                inputUI: {
                    type: 'dropdown',
                    options: ['false', 'true',],
                },
                tooltip: 'Choose if you want to rename audio streams.\\n(default: true)',
            },
            {
                name: "rename_subtitle_streams",
                type: 'boolean',
                defaultValue: true,
                inputUI: {
                    type: 'dropdown',
                    options: ['false', 'true',],
                },
                tooltip: 'Choose if you want to rename subtitle streams.\\n(default: true)',
            },
            {
                name: "use_audio_channels",
                type: 'boolean',
                defaultValue: true,
                inputUI: {
                    type: 'dropdown',
                    options: ['false', 'true',],
                },
                tooltip: 'Choose if you want to add channel layout information to audio stream names.\\n(default: true)',
            },
            {
                name: "use_audio_bitrate",
                type: 'boolean',
                defaultValue: true,
                inputUI: {
                    type: 'dropdown',
                    options: ['false', 'true',],
                },
                tooltip: 'Choose if you want to add bitrate information to audio stream names.\\n(default: true)',
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
    //Arabic
    ar: { english: "Arabic", german: "Arabisch" },
    ara: { english: "Arabic", german: "Arabisch" },
    //Basque
    eu:  { english: "Basque", german: "Baskisch" },
    baq: { english: "Basque", german: "Baskisch" },
    eus: { english: "Basque", german: "Baskisch" },
    //Bengali
    bn: { english: "Bengali", german: "Bengalisch" },
    ben: { english: "Bengali", german: "Bengalisch" },
    //Bulgarian
    bg: { english: "Bulgarian", german: "Bulgarisch" },
    bul: { english: "Bulgarian", german: "Bulgarisch" },
    //Catalan
    ca:  { english: "Catalan", german: "Katalanisch" },
    cat: { english: "Catalan", german: "Katalanisch" },
    //Chinese
    zh: { english: "Chinese", german: "Chinesisch" },
    chi: { english: "Chinese", german: "Chinesisch" },
    zho: { english: "Chinese", german: "Chinesisch" },
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
    // Filipino / Tagalog
    fil: { english: "Filipino", german: "Filipino" },
    tgl: { english: "Tagalog", german: "Tagalog" },
    //Finnish
    fi: { english: "Finnish", german: "Finnisch" },
    fin: { english: "Finnish", german: "Finnisch" },
    //French
    fr: { english: "French", german: "Französisch" },
    fre: { english: "French", german: "Französisch" },
    //Galician
    gl:  { english: "Galician", german: "Galicisch" },
    glg: { english: "Galician", german: "Galicisch" },
    //German
    de: { english: "German", german: "Deutsch" },
    ger: { english: "German", german: "Deutsch" },
    deu: { english: "German", german: "Deutsch" },
    //Greek
    el: { english: "Greek", german: "Griechisch" },
    gre: { english: "Greek", german: "Griechisch" },
    //Hebrew
    he: { english: "Hebrew", german: "Hebräisch" },
    heb: { english: "Hebrew", german: "Hebräisch" },
    //Hindi
    hi: { english: "Hindi", german: "Hindi" },
    hin: { english: "Hindi", german: "Hindi" },
    //Hungarian
    hu: { english: "Hungarian", german: "Ungarisch" },
    hun: { english: "Hungarian", german: "Ungarisch" },
    //Icelandic
    is: { english: "Icelandic", german: "Isländisch" },
    isl: { english: "Icelandic", german: "Isländisch" },
    ice: { english: "Icelandic", german: "Isländisch" },
    //Indonesian
    id: { english: "Indonesian", german: "Indonesisch" },
    ind: { english: "Indonesian", german: "Indonesisch" },
    //Italian
    it: { english: "Italian", german: "Italienisch" },
    ita: { english: "Italian", german: "Italienisch" },
    //Japanese
    ja: { english: "Japanese", german: "Japanisch" },
    jpn: { english: "Japanese", german: "Japanisch" },
    //Kannada
    kn:  { english: "Kannada", german: "Kannada" },
    kan: { english: "Kannada", german: "Kannada" },
    //Korean
    ko: { english: "Korean", german: "Koreanisch" },
    kor: { english: "Korean", german: "Koreanisch" },
    //Malay
    ms: { english: "Malay", german: "Malaiisch" },
    may: { english: "Malay", german: "Malaiisch" },
    //Malayalam
    ml: { english: "Malayalam", german: "Malayalam" },
    mal: { english: "Malayalam", german: "Malayalam" },
    //Marathi
    mr: { english: "Marathi", german: "Marathi" },
    mar: { english: "Marathi", german: "Marathi" },
    //Norwegian
    no: { english: "Norwegian", german: "Norwegisch" },
    nor: { english: "Norwegian", german: "Norwegisch" },
    //Norwegian Bokmål
    nb: { english: "Norwegian Bokmål", german: "Norwegisch (Bokmål)" },
    nob: { english: "Norwegian Bokmål", german: "Norwegisch (Bokmål)" },
    //Polish
    pl: { english: "Polish", german: "Polnisch" },
    pol: { english: "Polish", german: "Polnisch" },
    //Portuguese
    pt: { english: "Portuguese", german: "Portugiesisch" },
    por: { english: "Portuguese", german: "Portugiesisch" },
    //Romanian
    ro: { english: "Romanian", german: "Rumänisch" },
    rum: { english: "Romanian", german: "Rumänisch" },
    ron: { english: "Romanian", german: "Rumänisch" },
    //Russian
    ru: { english: "Russian", german: "Russisch" },
    rus: { english: "Russian", german: "Russisch" },
    //Serbian
    sr: { english: "Serbian", german: "Serbisch" },
    srp: { english: "Serbian", german: "Serbisch" },
    //Slovak
    sk: { english: "Slovak", german: "Slowakisch" },
    slo: { english: "Slovak", german: "Slowakisch" },
    slk: { english: "Slovak", german: "Slowakisch" },
    //Slovenian
    sl: { english: "Slovenian", german: "Slowenisch" },
    slv: { english: "Slovenian", german: "Slowenisch" },
    //Spanish
    es: { english: "Spanish", german: "Spanisch" },
    spa: { english: "Spanish", german: "Spanisch" },
    //Swedish
    sv: { english: "Swedish", german: "Schwedisch" },
    swe: { english: "Swedish", german: "Schwedisch" },
    //Tamil
    ta:  { english: "Tamil", german: "Tamil" },
    tam: { english: "Tamil", german: "Tamil" },
    //Telugu
    te: { english: "Telugu", german: "Telugu" },
    tel: { english: "Telugu", german: "Telugu" },
    //Thai
    th: { english: "Thai", german: "Thailändisch" },
    tha: { english: "Thai", german: "Thailändisch" },
    //Turkish
    tr: { english: "Turkish", german: "Türkisch" },
    tur: { english: "Turkish", german: "Türkisch" },
    //Ukrainian
    uk: { english: "Ukrainian", german: "Ukrainisch" },
    ukr: { english: "Ukrainian", german: "Ukrainisch" },
    //Vietnamese
    vi: { english: "Vietnamese", german: "Vietnamesisch" },
    vie: { english: "Vietnamese", german: "Vietnamesisch" },
};

const additionMap = {
    english: {
        visual_impaired: "Visually Impaired",
        comment: "Commentary",
        hearing_impaired: "SDH",
        forced: "Forced"
    },
    german: {
        visual_impaired: "Sehbehindert",
        comment: "Kommentare",
        hearing_impaired: "Schwerhörig",
        forced: "Erzwungen"
    }
};

function calculateChannelLayout(channelList) {
    // already correct formatted
    if (channelList.match(/^\d+\.\d+$/)) {
        return channelList;
    }
    if (channelList.toLowerCase() === "stereo") {
        return "2.0";
    }

    if (channelList.toLowerCase() === "mono") {
        return "1.0";
    }

    const channels = channelList.split(" ");
    const hasLFE = channels.includes("LFE");
    const channelCount = hasLFE ? channels.length - 1 : channels.length;

    return `${channelCount}${hasLFE ? ".1" : ".0"}`;
}

function isVbrAudioStream(stream, audioTrack) {
    const lowerIncludes = (val, substr) =>
        typeof val === "string" && val.toLowerCase().includes(substr);

    const modeCandidates = [
        stream?.tags?.bit_rate_mode,
        stream?.tags?.Bit_rate_mode,
        stream?.tags?.BitRate_Mode,
        stream?.tags?.BPS_Mode,
        audioTrack?.BitRate_Mode,
        audioTrack?.BitRate_Mode_Original,
        audioTrack?.BitRate_Mode_String,
    ];

    for (const val of modeCandidates) {
        if (
            lowerIncludes(val, "vbr") ||
            lowerIncludes(val, "variable") ||
            lowerIncludes(val, "abr")
        ) {
            return true;
        }
    }

    const encoderCandidates = [
        stream?.tags?.encoder,
        stream?.tags?.encoding_settings,
        audioTrack?.Encoding_Settings,
        audioTrack?.Encoded_Library_Settings,
    ];

    for (const val of encoderCandidates) {
        if (!val) continue;
        const s = val.toLowerCase();
        if (
            s.includes("vbr") ||
            /-v\s*\d/.test(s) ||
            /-q\s*\d/.test(s)
        ) {
            return true;
        }
    }

    const codec = (stream?.codec_name || "").toLowerCase();
    if (["opus", "vorbis"].includes(codec)) {
        return true;
    }

    return false;
}

function getAudioBitrateKbps(stream, audioTrack) {
    const raw =
        stream?.bit_rate ||
        audioTrack?.BitRate ||
        audioTrack?.BitRate_Nominal;

    if (!raw) return null;

    const numeric = Number(String(raw).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return null;
    }

    return Math.round(numeric / 1000);
}

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
				if (stream.profile) {
                    titleCodec = stream.profile;
                } else if (existingAudioTracks[audioIndex] && existingAudioTracks[audioIndex].Format_Commercial_IfAny) {
					titleCodec = existingAudioTracks[audioIndex].Format_Commercial_IfAny;
				}
			}
			// E-AC3
			if (stream.codec_name === "eac3") {
				titleCodec = "E-AC3";
			}
			// FLAC
            if (stream.codec_name === "flac") {
                titleCodec = "FLAC";
            }
			// MP3
			if (stream.codec_name === "mp3") {
                titleCodec = "MP3";
            }
			// Opus
			if (stream.codec_name === "opus") {
				titleCodec = "Opus";
			}
			// TrueHD
			if (stream.codec_name === "truehd") {
				titleCodec = "TrueHD";
				// Check for Atmos in profile or additional streams
				if (existingAudioTracks[audioIndex]?.Format_Commercial_IfAny?.includes("Atmos") ||
                    existingAudioTracks[audioIndex]?.Format_AdditionalFeatures?.includes("JOC")) {
                    titleCodec = "TrueHD Atmos";
                }
			}

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

            // add channels and bitrade for audio streams
            if (existingAudioTracks[audioIndex] && stream.codec_type.toLowerCase() === 'audio') {
                const audioTrack = existingAudioTracks[audioIndex];
                if(inputs.use_audio_channels) {
                    const channels = stream.channels || audioTrack?.Channels || "??";
                    const channelLayout = stream.channel_layout || audioTrack?.ChannelLayout || "";
                    const formattedChannels = calculateChannelLayout((channelLayout || `${channels}`).replace(/\(.*\)/g, "").trim()); // cuts additions like "(side)"

                    titleCodec += ` ${formattedChannels}`;
                }

                if(inputs.use_audio_bitrate) {
                    // print bitrate if it is not a lossless codec
                    const compressionMode = (audioTrack?.Compression_Mode || stream.tags?.Compression_Mode || "").toLowerCase();

                    const isLosslessCodec =
                        titleCodec.includes("DTS-HD MA") ||
                        titleCodec.includes("TrueHD") ||
                        titleCodec.includes("FLAC") ||
                        titleCodec.includes("PCM");

                    if (compressionMode !== "lossless" && !isLosslessCodec) {

                        // 1. VBR?
                        if (isVbrAudioStream(stream, audioTrack)) {
                            titleCodec += " (VBR)";
                        } else {
                            // 2. use bitrate if known
                            const kbps = getAudioBitrateKbps(stream, audioTrack);
                            if (kbps) {
                                titleCodec += ` (${kbps} kbps)`;
                            }
                            // 3. don't know if VBR or the bitrate
                        }
                    }
                }
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


	const ffmpegCommand = `, -fflags +bitexact -flags:v +bitexact -flags:a +bitexact ${ffmpegCommandInsert} -c copy -map 0 -max_muxing_queue_size 9999`;

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
