/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Sort_Streams",
        Stage: "Pre-processing",
        Name: "[Chasil] Sort Streams by Type, Title and Language",
        Operation: "Transcode",
        Description: "Sorts streams by type (video, audio, subtitle) and title. Video streams by language. Keeps other streams and maps attachments last. Forces chapters to be copied.",
        Version: "1.4",
        Link: "",
        Tags: "pre-processing,sorting,ffmpeg,attachments,chapters",
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

    const streams = (file.ffProbeData && file.ffProbeData.streams) ? file.ffProbeData.streams : [];

    if (!streams || streams.length === 0) {
        response.infoLog += "⚠️ No streams found in the file.\n";
        return response;
    }

    const sortedStreams = {
        video: [],
        audio: [],
        subtitle: [],
        other: [],
        attachment: []
    };

    streams.forEach((stream, index) => {
        const codecType = (stream.codec_type || "").toLowerCase();

        if (codecType === 'video') {
            sortedStreams.video.push({ stream, index });
        } else if (codecType === 'audio') {
            sortedStreams.audio.push({ stream, index });
        } else if (codecType === 'subtitle') {
            sortedStreams.subtitle.push({ stream, index });
        } else if (codecType === 'attachment') {
            sortedStreams.attachment.push({ stream, index });
        } else {
            sortedStreams.other.push({ stream, index });
        }
    });

    const getStreamLanguage = (stream) =>
        (stream.tags && stream.tags.language) ? String(stream.tags.language).toLowerCase() : "unknown";

    const getStreamTitle = (stream) =>
        (stream.tags && stream.tags.title) ? String(stream.tags.title).toLowerCase() : "";

    const normalizeTitle = (title) => String(title).replace(/[()]/g, "").toLowerCase();

    sortedStreams.video.sort((a, b) => getStreamLanguage(a.stream).localeCompare(getStreamLanguage(b.stream)));

    sortedStreams.audio.sort((a, b) =>
        normalizeTitle(getStreamTitle(a.stream)).localeCompare(normalizeTitle(getStreamTitle(b.stream)))
    );

    sortedStreams.subtitle.sort((a, b) =>
        normalizeTitle(getStreamTitle(a.stream)).localeCompare(normalizeTitle(getStreamTitle(b.stream)))
    );

    const finalEntries = [
        ...sortedStreams.video,
        ...sortedStreams.audio,
        ...sortedStreams.subtitle,
        ...sortedStreams.other,
        ...sortedStreams.attachment // attachments LAST (important for MKV muxing stability)
    ];

    const originalOrder = streams.map((_, idx) => idx);
    const newOrder = finalEntries.map(e => e.index);

    let convert = JSON.stringify(originalOrder) !== JSON.stringify(newOrder);

    finalEntries.forEach((entry) => {
        ffmpegCommandInsert += `-map 0:${entry.index} `;
    });

    if (sortedStreams.attachment.length > 0) {
        sortedStreams.attachment.forEach((e) => {
            const t = e.stream.tags || {};
            response.infoLog += `🧩 Keeping attachment #${e.index}: ${(t.filename || t.mimetype || e.stream.codec_name || "unknown")}\n`;
        });
        response.infoLog += `🧩 Attachments mapped last.\n`;
    }

    // ✅ Force chapters to be copied from input 0
    const ffmpegCommand = `, -fflags +bitexact -flags:v +bitexact -flags:a +bitexact -map_chapters 0 ${ffmpegCommandInsert}-c copy -max_muxing_queue_size 9999`;
    response.infoLog += `ffmpeg command: ${ffmpegCommand}\n`;

    if (convert) {
        response.processFile = true;
        response.preset = ffmpegCommand;
        response.container = "." + file.container;
        response.handBrakeMode = false;
        response.FFmpegMode = true;
        response.reQueueAfter = true;
        response.infoLog += `☒ Streams were sorted successfully (chapters forced, attachments preserved).\n`;
    } else {
        response.infoLog += `✔️ Streams already in correct order.\n`;
    }

    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;