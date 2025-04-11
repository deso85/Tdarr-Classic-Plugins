/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Sort_Streams",
        Stage: "Pre-processing",
        Name: "[Chasil] Sort Streams by Type, Title and Language",
        Operation: "Transcode",
        Description: "Sorts streams by type (video, audio, subtitle, chapter) and title. Video streams by language.",
        Version: "1.1",
        Link: "",
        Tags: "pre-processing,sorting,ffmpeg",
        Inputs: [],
    };
};

const plugin = (file, librarySettings, inputs, otherArguments) => {
	
    var response = {
        processFile: false,
        preset: "",
        container: `.${file.container}`,
        handBrakeMode: false,
        FFmpegMode: false,
        reQueueAfter: false,
        infoLog: "",
    };
	
	let ffmpegCommandInsert = "";
	let convert = false;
	
    const streams = file.ffProbeData.streams;
	
	// Check if there are streams present
    if (!streams || streams.length === 0) {
        response.infoLog += "⚠️ No streams found in the file.\n";
        return response; // Early exit if no streams are found
    }
	
    // Group streams into categories
    const sortedStreams = {
        video: [],
        audio: [],
        subtitle: [],
        chapter: []
    };

	streams.forEach((stream, index) => {
        const codecType = stream.codec_type.toLowerCase();
        if (codecType === 'video') {
            sortedStreams.video.push({ stream, index });
        } else if (codecType === 'audio') {
            sortedStreams.audio.push({ stream, index });
        } else if (codecType === 'subtitle') {
            sortedStreams.subtitle.push({ stream, index });
        } else if (codecType === 'chapter') {
            sortedStreams.chapter.push({ stream, index });
        }
    });

	const getStreamLanguage = (stream) => (stream.tags && stream.tags.language) ? stream.tags.language.toLowerCase() : "unknown";
	const getStreamTitle = (stream) => (stream.tags && stream.tags.title) ? stream.tags.title.toLowerCase() : "";

	const normalizeTitle = (title) => title.replace(/[()]/g, "").toLowerCase();
		
    // Sort video streams by language
	sortedStreams.video.sort((a, b) => {
	    const comparison = getStreamLanguage(a.stream).localeCompare(getStreamLanguage(b.stream));
	    if (comparison < 0) {
	        convert = true;
	    }
	    return comparison;
	});

    // Sort audio streams by title
	sortedStreams.audio.sort((a, b) => {
	    const comparison = getStreamTitle(a.stream).localeCompare(getStreamTitle(b.stream));
	    if (comparison < 0) {
	        convert = true;
	    }
	    return comparison;
	});

    // Sort subtitles by language and type
	sortedStreams.subtitle.sort((a, b) => {
	    const comparison = normalizeTitle(getStreamTitle(a.stream))
            .localeCompare(normalizeTitle(getStreamTitle(b.stream)));
	    //const comparison = getStreamTitle(a.stream).localeCompare(getStreamTitle(b.stream));
	    if (comparison < 0) {
	        convert = true;
	    }
	    return comparison;
	});

    // Generate FFmpeg map command based on sorted streams
    [...sortedStreams.video, ...sortedStreams.audio, ...sortedStreams.subtitle, ...sortedStreams.chapter]
        .forEach((entry) => {
            ffmpegCommandInsert += `-map 0:${entry.index} `;
        });

    // Generate FFmpeg preset command
    const ffmpegCommand = `, ${ffmpegCommandInsert}-c copy -max_muxing_queue_size 9999`;
	response.infoLog += `ffmpeg command: `+ffmpegCommand+`\n`;
	
    // Set response for Tdarr
	if(convert) {
	    response.processFile = true;
	    response.preset = ffmpegCommand;
	    response.container = "." + file.container;
	    response.handBrakeMode = false;
	    response.FFmpegMode = true;
	    response.reQueueAfter = true;
	    response.infoLog += `☒ Streams were sorted successfully.\n`;
	}
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
