/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Add_Compatible_Audio_Stream",
        Stage: "Pre-processing",
        Name: "[Chasil] Add compatible audio fallback stream per language",
        Operation: "Transcode",
        Description:
            "[Contains built-in filter] Ensures at least one compatible audio stream (AAC/AC3/EAC3) per language. " +
            "If only premium codecs are present, a fallback stream is created while preserving channel layout " +
            "(capped by codec limits). Original streams are never removed. " +
            "All existing attachments are always preserved; fonts are mapped LAST to avoid Matroska mux errors. " +
            "Attachment policy must be enforced by a separate plugin.",
        Version: "1.4",
        Link: "",
        Tags: "pre-processing,audio,ffmpeg,attachments",
        Inputs: [
            {
                name: "target_codec",
                type: "string",
                defaultValue: "eac3",
                inputUI: {
                    type: "dropdown",
                    options: ["eac3", "ac3", "aac"],
                },
                tooltip: "Target codec for the fallback audio stream.\n" +
                    "EAC3 supports up to 5.1.\n" +
                    "AC3 supports up to 5.1.\n" +
                    "AAC supports up to 7.1.\n" +
                    "(default: eac3)",
            },
            {
                name: "bitrate_mono",
                type: 'string',
                defaultValue: '128',
                inputUI: { type: 'text' },
                tooltip: 'Bitrate in kbps for mono (1.0) streams.\n(default: 128)',
            },
            {
                name: "bitrate_stereo",
                type: 'string',
                defaultValue: '256',
                inputUI: { type: 'text' },
                tooltip: 'Bitrate in kbps for stereo (2.0) streams.\n(default: 256)',
            },
            {
                name: "bitrate_5_1",
                type: 'string',
                defaultValue: '640',
                inputUI: { type: 'text' },
                tooltip: 'Bitrate in kbps for 5.1 (6 channel) streams.\n(default: 640)',
            },
            {
                name: "bitrate_7_1",
                type: 'string',
                defaultValue: '768',
                inputUI: { type: 'text' },
                tooltip: 'Bitrate in kbps for 7.1 (8 channel) streams. Only used if target codec supports 7.1 (e.g. AAC).\n(default: 768)',
            },
            {
                name: "bitrate_per_channel",
                type: 'string',
                defaultValue: '96',
                inputUI: { type: 'text' },
                tooltip:
                    'Bitrate in kbps PER CHANNEL for any channel count not explicitly covered above '
                    + '(i.e. not 1, 2, 6 or 8 channels).\n'
                    + 'Total bitrate = channels × this value.\n'
                    + 'Examples at 96: 4.0→384k, 6.1→672k.\n'
                    + '(default: 96)',
            },
            {
                name: "premium_codecs",
                type: 'string',
                defaultValue: 'truehd,dts,dca,dts-hd ma,dts-hd hra,mlp',
                inputUI: { type: 'text' },
                tooltip:
                    'Comma-separated list of codec names considered "premium" (need a fallback).\n'
                    + 'DTS variants (DTS-HD MA, DTS:X, DTS-HD HRA) all appear as "dts" or "dca" in ffmpeg.\n'
                    + '(default: truehd,dts,dca,dts-hd ma,dts-hd hra,mlp)',
            },
        ],
    };
};

const plugin = (file, librarySettings, inputs) => {
    const lib = require("../methods/lib")();
    inputs = lib.loadDefaultValues(inputs, details);

    const response = {
        processFile: false,
        preset: "",
        container: "",
        handBrakeMode: false,
        FFmpegMode: true,
        reQueueAfter: false,
        infoLog: "",
    };

    const targetCodec = inputs.target_codec.toLowerCase().trim();
    const bitrateMono = parseInt(inputs.bitrate_mono, 10) || 128;
    const bitrateStereo = parseInt(inputs.bitrate_stereo, 10) || 256;
    const bitrate51 = parseInt(inputs.bitrate_5_1, 10) || 640;
    const bitrate71 = parseInt(inputs.bitrate_7_1, 10) || 768;
    const bitratePerChannel = parseInt(inputs.bitrate_per_channel, 10) || 96;

    const premiumCodecs = inputs.premium_codecs
        .split(",")
        .map(c => c.trim().toLowerCase())
        .filter(Boolean);

    const compatibleCodecs = ["aac", "ac3", "eac3"];

    const codecMaxChannels = {
        eac3: 6,
        ac3: 6,
        aac: 8,
    };

    const channelLabel = {
        1: "1.0",
        2: "2.0",
        6: "5.1",
        8: "7.1",
    };

    function bitrateFor(ch) {
        if (ch === 1) return bitrateMono;
        if (ch === 2) return bitrateStereo;
        if (ch === 6) return bitrate51;
        if (ch === 8) return bitrate71;
        return ch * bitratePerChannel;
    }

    function isFontAttachment(s) {
        if (s.codec_type !== "attachment") return false;
        const name = ((s.tags && s.tags.filename) || "").toLowerCase();
        const mime = ((s.tags && s.tags.mimetype) || "").toLowerCase();

        return (
            name.endsWith(".ttf") ||
            name.endsWith(".otf") ||
            name.endsWith(".ttc") ||
            name.endsWith(".woff") ||
            name.endsWith(".woff2") ||
            mime.includes("font")
        );
    }

    const streams = file.ffProbeData?.streams || [];
    const audioStreams = streams.filter(s => s.codec_type === "audio");

    if (audioStreams.length === 0) {
        response.infoLog += "☒ No audio streams found.\n";
        return response;
    }

    const langMap = {};

    streams.forEach((s, i) => {
        if (s.codec_type !== "audio") return;

        const dispo = s.disposition || {};
        if (dispo.comment || dispo.visual_impaired) return;

        const lang = (s.tags?.language || "und").toLowerCase();
        const codec = (s.codec_name || "").toLowerCase();
        const ch = s.channels || 2;

        langMap[lang] = langMap[lang] || { compatible: [], premium: [] };

        const entry = { index: i, codec, channels: ch };

        if (compatibleCodecs.includes(codec)) langMap[lang].compatible.push(entry);
        else if (premiumCodecs.includes(codec)) langMap[lang].premium.push(entry);
    });

    const transcodes = [];

    Object.keys(langMap).forEach(lang => {
        const info = langMap[lang];
        if (info.compatible.length) return;
        if (!info.premium.length) return;

        const best = info.premium.reduce((a, b) =>
            b.channels > a.channels ? b : a
        );

        const maxCh = codecMaxChannels[targetCodec] || 6;
        const targetCh = Math.min(best.channels, maxCh);

        transcodes.push({
            source: best.index,
            channels: targetCh,
            bitrate: bitrateFor(targetCh),
            lang,
            label: channelLabel[targetCh] || `${targetCh}ch`,
        });
    });

    if (!transcodes.length) {
        response.infoLog += "☑ All languages already have compatible audio.\n";
        return response;
    }

    const mapArgs = [];
    const codecArgs = ["-c copy"];
    const metaArgs = [];

    const fontAttachments = [];
    const otherAttachments = [];

    streams.forEach((s, i) => {
        if (s.codec_type === "attachment") {
            (isFontAttachment(s) ? fontAttachments : otherAttachments).push(i);
        } else {
            mapArgs.push(`-map 0:${i}`);
        }
    });

    let outIdx = mapArgs.length;

    transcodes.forEach(tc => {
        mapArgs.push(`-map 0:${tc.source}`);
        codecArgs.push(`-c:${outIdx} ${targetCodec}`);
        codecArgs.push(`-b:${outIdx} ${tc.bitrate}k`);
        codecArgs.push(`-ac:${outIdx} ${tc.channels}`);
        metaArgs.push(`-metadata:s:${outIdx} language=${tc.lang}`);
        metaArgs.push(`-metadata:s:${outIdx} title=${targetCodec.toUpperCase()}_${tc.label}_fallback`);
        metaArgs.push(`-disposition:${outIdx} 0`);
        outIdx++;
    });

    otherAttachments.forEach(i => mapArgs.push(`-map 0:${i}`));
    fontAttachments.forEach(i => mapArgs.push(`-map 0:${i}`));

    response.processFile = true;
    response.preset =
        ", " +
        [
            mapArgs.join(" "),
            codecArgs.join(" "),
            metaArgs.join(" "),
            "-max_muxing_queue_size 9999",
        ].join(" ");

    response.container = "." + file.container;
    response.reQueueAfter = true;
    response.infoLog += `☒ Added ${transcodes.length} fallback audio stream(s). Attachments preserved.\n`;

    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;