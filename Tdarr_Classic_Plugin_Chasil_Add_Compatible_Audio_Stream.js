/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Add_Compatible_Audio_Stream",
        Stage: "Pre-processing",
        Name: "[Chasil] Add compatible audio fallback stream per language",
        Operation: "Transcode",
        Description: "[Contains built-in filter] For each language found in the file, checks if a compatible audio stream (AAC, AC3 or EAC3) exists. If only 'premium' codecs (TrueHD, DTS-HD MA, DTS:X, DTS, etc.) are present, a fallback stream is created in the configured codec while preserving the original channel layout (capped by codec limits). Original streams are never removed.",
        Version: "1.1",
        Link: "",
        Tags: "pre-processing,audio,ffmpeg,configurable",
        Inputs: [
            {
                name: "target_codec",
                type: 'string',
                defaultValue: 'eac3',
                inputUI: {
                    type: 'dropdown',
                    options: ['eac3', 'ac3', 'aac'],
                },
                tooltip: 'Target codec for the fallback audio stream.\\n'
                    + 'EAC3 supports up to 7.1 and offers the best quality/compatibility balance.\\n'
                    + 'AC3 is limited to 5.1 max.\\n'
                    + 'AAC works everywhere but surround support varies by player.\\n'
                    + '(default: eac3)',
            },
            {
                name: "bitrate_mono",
                type: 'string',
                defaultValue: '128',
                inputUI: {
                    type: 'text',
                },
                tooltip: 'Bitrate in kbps for mono (1.0) streams.\\n(default: 128)',
            },
            {
                name: "bitrate_stereo",
                type: 'string',
                defaultValue: '256',
                inputUI: {
                    type: 'text',
                },
                tooltip: 'Bitrate in kbps for stereo (2.0) streams.\\n(default: 256)',
            },
            {
                name: "bitrate_5_1",
                type: 'string',
                defaultValue: '640',
                inputUI: {
                    type: 'text',
                },
                tooltip: 'Bitrate in kbps for 5.1 (6 channel) streams.\\n(default: 640)',
            },
            {
                name: "bitrate_7_1",
                type: 'string',
                defaultValue: '768',
                inputUI: {
                    type: 'text',
                },
                tooltip: 'Bitrate in kbps for 7.1 (8 channel) streams.\\n(default: 768)',
            },
            {
                name: "bitrate_per_channel",
                type: 'string',
                defaultValue: '96',
                inputUI: {
                    type: 'text',
                },
                tooltip: 'Bitrate in kbps PER CHANNEL for any channel count not explicitly covered above '
                    + '(i.e. not 1, 2, 6 or 8 channels).\\n'
                    + 'Total bitrate = channels × this value.\\n'
                    + 'Examples at 96: 4.0→384k, 6.1→672k, 7.2→864k.\\n'
                    + '(default: 96)',
            },
            {
                name: "premium_codecs",
                type: 'string',
                defaultValue: 'truehd,dts,dca,dts-hd ma,dts-hd hra,mlp',
                inputUI: {
                    type: 'text',
                },
                tooltip: 'Comma-separated list of codec names considered "premium" (need a fallback).\\n'
                    + 'DTS variants (DTS-HD MA, DTS:X, DTS-HD HRA) all appear as "dts" or "dca" in ffmpeg.\\n'
                    + '(default: truehd,dts,dca,dts-hd ma,dts-hd hra,mlp)',
            },
        ],
    };
};

const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require('../methods/lib')();
    inputs = lib.loadDefaultValues(inputs, details);

    const response = {
        processFile: false,
        preset: '',
        container: '',
        handBrakeMode: false,
        FFmpegMode: true,
        reQueueAfter: false,
        infoLog: '',
    };

    // ──────────────────────────────────────────────
    // Parse inputs
    // ──────────────────────────────────────────────
    const targetCodec = inputs.target_codec.toLowerCase().trim();
    const bitrateMono = parseInt(inputs.bitrate_mono, 10) || 128;
    const bitrateStereo = parseInt(inputs.bitrate_stereo, 10) || 256;
    const bitrate51 = parseInt(inputs.bitrate_5_1, 10) || 640;
    const bitrate71 = parseInt(inputs.bitrate_7_1, 10) || 768;
    const bitratePerChannel = parseInt(inputs.bitrate_per_channel, 10) || 96;
    const premiumCodecs = inputs.premium_codecs.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);

    const compatibleCodecs = ['aac', 'ac3', 'eac3'];

    // Codec channel limits
    const codecMaxChannels = {
        eac3: 8,
        ac3: 6,
        aac: 8,
    };
    const codecMaxCh = codecMaxChannels[targetCodec] || 8;

    // ──────────────────────────────────────────────
    // Channel layout helpers
    // ──────────────────────────────────────────────
    const channelLayoutLabels = {
        1: '1.0',
        2: '2.0',
        3: '2.1',
        4: '4.0',
        5: '5.0',
        6: '5.1',
        7: '6.1',
        8: '7.1',
    };

    function getLayoutLabel(channels) {
        return channelLayoutLabels[channels] || (channels + 'ch');
    }

    function getBitrate(channels) {
        switch (channels) {
            case 1: return bitrateMono;
            case 2: return bitrateStereo;
            case 6: return bitrate51;
            case 8: return bitrate71;
            default: return channels * bitratePerChannel;
        }
    }

    // ──────────────────────────────────────────────
    // 1. Discover all languages from audio streams
    // ──────────────────────────────────────────────
    const streams = file.ffProbeData.streams || [];
    const audioStreams = streams.filter(s => s.codec_type === 'audio');

    if (audioStreams.length === 0) {
        response.infoLog += "☒ No audio streams found. Skipping.\n";
        return response;
    }

    // Build per-language info dynamically from what's in the file
    const langMap = {};

    for (let i = 0; i < streams.length; i++) {
        const s = streams[i];
        if (s.codec_type !== 'audio') continue;

        // Skip audio descriptions and commentary tracks
        const dispo = s.disposition || {};
        if (dispo.visual_impaired === 1 || dispo.comment === 1) {
            response.infoLog += '[Stream #' + i + '] Skipping (visual_impaired or comment).\n';
            continue;
        }

        const lang = (s.tags && s.tags.language) ? s.tags.language.toLowerCase().trim() : 'und';
        const codec = (s.codec_name || '').toLowerCase().trim();
        const channels = s.channels || 2;

        if (!langMap[lang]) {
            langMap[lang] = { compatible: [], premium: [] };
        }

        const entry = { index: i, codec, channels };

        if (compatibleCodecs.includes(codec)) {
            langMap[lang].compatible.push(entry);
        } else if (premiumCodecs.includes(codec)) {
            langMap[lang].premium.push(entry);
        }
    }

    // ──────────────────────────────────────────────
    // 2. Determine which languages need a fallback
    // ──────────────────────────────────────────────
    const transcodesNeeded = [];

    for (const lang of Object.keys(langMap)) {
        const info = langMap[lang];

        if (info.compatible.length > 0) {
            response.infoLog += '[' + lang + '] Already has compatible stream(s): '
                + info.compatible.map(s => s.codec + ' ' + s.channels + 'ch').join(', ') + '\n';
            continue;
        }

        if (info.premium.length === 0) {
            response.infoLog += '[' + lang + '] No premium or compatible audio streams. Skipping.\n';
            continue;
        }

        // Pick the best premium stream (highest channel count, first wins on tie)
        const best = info.premium.reduce((a, b) => (b.channels > a.channels ? b : a));

        // Target channels: source capped by codec max
        const targetChannels = Math.min(best.channels, codecMaxCh);
        const targetBitrate = getBitrate(targetChannels);
        const layoutLabel = getLayoutLabel(targetChannels);

        response.infoLog += '[' + lang + '] No compatible stream found. Will transcode stream #' + best.index
            + ' (' + best.codec + ', ' + best.channels + 'ch) → ' + targetCodec + ' ' + layoutLabel
            + ' @ ' + targetBitrate + 'kbps\n';

        transcodesNeeded.push({
            sourceIndex: best.index,
            sourceChannels: best.channels,
            sourceCodec: best.codec,
            lang,
            targetChannels,
            targetBitrate,
            layoutLabel,
        });
    }

    // ──────────────────────────────────────────────
    // 3. Nothing to do?
    // ──────────────────────────────────────────────
    if (transcodesNeeded.length === 0) {
        response.infoLog += "☑ All languages already have a compatible audio stream. Nothing to do.\n";
        return response;
    }

    // ──────────────────────────────────────────────
    // 4. Build ffmpeg command
    // ──────────────────────────────────────────────
    const mapArgs = [];
    const codecArgs = [];
    const metadataArgs = [];

    // Map all existing streams as copy
    for (let i = 0; i < streams.length; i++) {
        mapArgs.push('-map 0:' + i);
    }
    codecArgs.push('-c copy');

    // Add new transcoded streams
    let outIdx = streams.length;

    for (const tc of transcodesNeeded) {
        mapArgs.push('-map 0:' + tc.sourceIndex);

        codecArgs.push('-c:' + outIdx + ' ' + targetCodec);
        codecArgs.push('-b:' + outIdx + ' ' + tc.targetBitrate + 'k');
        codecArgs.push('-ac:' + outIdx + ' ' + tc.targetChannels);

        metadataArgs.push('-metadata:s:' + outIdx + ' language=' + tc.lang);

        // Title without spaces/special chars that could break CLI parsing
        const title = targetCodec.toUpperCase() + '_' + tc.layoutLabel + '_fallback';
        metadataArgs.push('-metadata:s:' + outIdx + ' title=' + title);

        // Copy disposition flags from source, except 'default'
        const dispo = streams[tc.sourceIndex].disposition || {};
        const flags = Object.entries(dispo)
            .filter(([key, val]) => val === 1 && key !== 'default')
            .map(([key]) => key)
            .join('+');
        metadataArgs.push('-disposition:' + outIdx + ' ' + (flags || '0'));

        outIdx++;
    }

    const allArgs = [
        mapArgs.join(' '),
        codecArgs.join(' '),
        metadataArgs.join(' '),
        '-max_muxing_queue_size 9999',
    ].join(' ');

    const ffmpegCommand = ', ' + allArgs;

    response.processFile = true;
    response.preset = ffmpegCommand;
    response.container = '.' + file.container;
    response.handBrakeMode = false;
    response.FFmpegMode = true;
    response.reQueueAfter = true;
    response.infoLog += '☒ Adding ' + transcodesNeeded.length + ' fallback audio stream(s).\n';

    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
