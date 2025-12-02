/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Sort_Streams",
        Stage: "Pre-processing",
        Name: "[Chasil] Sort Streams by Type, Title and Language",
        Operation: "Transcode",
        Description: "Sorts streams by type (video, audio, subtitle, chapter) and title. Video streams by language.",
        Version: "1.3",
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
	sortedStreams.video.sort((a, b) => getStreamLanguage(a.stream).localeCompare(getStreamLanguage(b.stream)));

    // Sort audio streams by title (normalized)
	sortedStreams.audio.sort((a, b) =>
	    normalizeTitle(getStreamTitle(a.stream)).localeCompare(normalizeTitle(getStreamTitle(b.stream)))
	);

    // Sort subtitles by title (normalized)
	sortedStreams.subtitle.sort((a, b) =>
        normalizeTitle(getStreamTitle(a.stream)).localeCompare(normalizeTitle(getStreamTitle(b.stream)))
    );

    // Vergleiche ursprüngliche mit neuer Reihenfolge
    const originalOrder = streams.map((_, idx) => idx);
    const newOrder = [...sortedStreams.video, ...sortedStreams.audio, ...sortedStreams.subtitle, ...sortedStreams.chapter].map(e => e.index);

    let convert = JSON.stringify(originalOrder) !== JSON.stringify(newOrder);

    // Generate FFmpeg map command based on sorted streams
    [...sortedStreams.video, ...sortedStreams.audio, ...sortedStreams.subtitle, ...sortedStreams.chapter]
        .forEach((entry) => {
            ffmpegCommandInsert += `-map 0:${entry.index} `;
        });

    // Generate FFmpeg preset command
    const ffmpegCommand = `, -fflags +bitexact -flags:v +bitexact -flags:a +bitexact ${ffmpegCommandInsert}-c copy -max_muxing_queue_size 9999`;
	response.infoLog += `ffmpeg command: ` + ffmpegCommand + "\n";

    // Set response for Tdarr
	if(convert) {
	    response.processFile = true;
	    response.preset = ffmpegCommand;
	    response.container = "." + file.container;
	    response.handBrakeMode = false;
	    response.FFmpegMode = true;
	    response.reQueueAfter = true;
	    response.infoLog += `☒ Streams were sorted successfully.\n`;
	} else {
        response.infoLog += `✔️ Streams already in correct order.\n`;
    }

    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
