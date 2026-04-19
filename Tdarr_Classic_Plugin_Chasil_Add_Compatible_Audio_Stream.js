/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Add_Compatible_Audio_Stream",
        Stage: "Pre-processing",
        Name: "[Chasil] Add compatible audio fallback stream per language (exclude attachments except fonts, fonts mapped last)",
        Operation: "Transcode",
        Description:
            "[Contains built-in filter] For each language found in the file, checks if a compatible audio stream (AAC, AC3 or EAC3) exists. " +
            "If only 'premium' codecs (TrueHD, DTS-HD MA, DTS:X, DTS, etc.) are present, a fallback stream is created in the configured codec while " +
            "preserving the original channel layout (capped by codec limits). Original streams are never removed. " +
            "Attachments are excluded except font attachments (ttf/otf). Font attachments are mapped LAST to avoid Matroska mux errors.",
        Version: "1.3",
        Link: "",
        Tags: "pre-processing,audio,ffmpeg,configurable,attachments",
        Inputs: [
            {
                name: "target_codec",
                type: 'string',
                defaultValue: 'eac3',
                inputUI: {
                    type: 'dropdown',
                    options: ['eac3', 'ac3', 'aac'],
                },
                tooltip: 'Target codec for the fallback audio stream.\n'
                    + 'EAC3 supports up to 5.1 (native ffmpeg encoder limitation).\n'
                    + 'AC3 is limited to 5.1 max.\n'
                    + 'AAC works everywhere but surround support varies by player.\n'
                    + '(default: eac3)',
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
    const targetCodec = (inputs.target_codec || 'eac3').toLowerCase().trim();
    const bitrateMono = parseInt(inputs.bitrate_mono, 10) || 128;
    const bitrateStereo = parseInt(inputs.bitrate_stereo, 10) || 256;
    const bitrate51 = parseInt(inputs.bitrate_5_1, 10) || 640;
    const bitrate71 = parseInt(inputs.bitrate_7_1, 10) || 768;
    const bitratePerChannel = parseInt(inputs.bitrate_per_channel, 10) || 96;
    const premiumCodecs = (inputs.premium_codecs || '')
        .split(',')
        .map(function (c) { return c.trim().toLowerCase(); })
        .filter(Boolean);

    const compatibleCodecs = ['aac', 'ac3', 'eac3'];

    // Native ffmpeg encoder channel limits
    // EAC3 native encoder: max 5.1 (6 channels)
    // AC3 native encoder:  max 5.1 (6 channels)
    // AAC native encoder:  up to 7.1 (8 channels)
    const codecMaxChannels = {
        eac3: 6,
        ac3: 6,
        aac: 8,
    };
    var codecMaxCh = codecMaxChannels[targetCodec] || 6;

    // ──────────────────────────────────────────────
    // Channel layout helpers
    // ──────────────────────────────────────────────
    var channelLayoutLabels = {
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
    // Attachment filtering helpers (keep fonts only)
    // ──────────────────────────────────────────────
    function isFontAttachment(s) {
        if (!s) return false;
        if (s.codec_type !== 'attachment') return false;

        var codec = (s.codec_name || '').toLowerCase().trim();
        var tags = s.tags || {};
        var filename = (tags.filename || '').toLowerCase().trim();
        var mimetype = (tags.mimetype || '').toLowerCase().trim();

        // Common indicators for font attachments
        if (codec === 'ttf' || codec === 'otf') return true;
        if (filename.endsWith('.ttf') || filename.endsWith('.otf')) return true;

        // Mimetype variants
        if (mimetype.includes('font')) return true;
        if (mimetype.includes('truetype')) return true;
        if (mimetype.includes('opentype')) return true;

        return false;
    }

    // ──────────────────────────────────────────────
    // 1. Discover all languages from audio streams
    // ──────────────────────────────────────────────
    var streams = (file.ffProbeData && file.ffProbeData.streams) ? file.ffProbeData.streams : [];
    var audioStreams = streams.filter(function (s) { return s.codec_type === 'audio'; });

    if (audioStreams.length === 0) {
        response.infoLog += "☒ No audio streams found. Skipping.\n";
        return response;
    }

    // Build per-language info dynamically from what's in the file
    var langMap = {};

    for (var i = 0; i < streams.length; i++) {
        var s = streams[i];
        if (s.codec_type !== 'audio') continue;

        // Skip audio descriptions and commentary tracks
        var dispo = s.disposition || {};
        if (dispo.visual_impaired === 1 || dispo.comment === 1) {
            response.infoLog += '[Stream #' + i + '] Skipping (visual_impaired or comment).\n';
            continue;
        }

        var lang = (s.tags && s.tags.language) ? s.tags.language.toLowerCase().trim() : 'und';
        var codec = (s.codec_name || '').toLowerCase().trim();
        var channels = s.channels || 2;

        if (!langMap[lang]) {
            langMap[lang] = { compatible: [], premium: [] };
        }

        var entry = { index: i, codec: codec, channels: channels };

        if (compatibleCodecs.includes(codec)) {
            langMap[lang].compatible.push(entry);
        } else if (premiumCodecs.includes(codec)) {
            langMap[lang].premium.push(entry);
        }
    }

    // ──────────────────────────────────────────────
    // 2. Determine which languages need a fallback
    // ──────────────────────────────────────────────
    var transcodesNeeded = [];

    var langKeys = Object.keys(langMap);
    for (var li = 0; li < langKeys.length; li++) {
        var lang2 = langKeys[li];
        var info = langMap[lang2];

        if (info.compatible.length > 0) {
            response.infoLog += '[' + lang2 + '] Already has compatible stream(s): '
                + info.compatible.map(function (s2) { return s2.codec + ' ' + s2.channels + 'ch'; }).join(', ') + '\n';
            continue;
        }

        if (info.premium.length === 0) {
            response.infoLog += '[' + lang2 + '] No premium or compatible audio streams. Skipping.\n';
            continue;
        }

        // Pick the best premium stream (highest channel count, first wins on tie)
        var best = info.premium.reduce(function (a, b) { return b.channels > a.channels ? b : a; });

        // Target channels: source capped by codec max
        var targetChannels = Math.min(best.channels, codecMaxCh);
        var targetBitrate = getBitrate(targetChannels);
        var layoutLabel = getLayoutLabel(targetChannels);

        var downmixNote = '';
        if (best.channels > codecMaxCh) {
            downmixNote = ' (downmix from ' + getLayoutLabel(best.channels) + ')';
        }

        response.infoLog += '[' + lang2 + '] No compatible stream found. Will transcode stream #' + best.index
            + ' (' + best.codec + ', ' + best.channels + 'ch) -> ' + targetCodec + ' ' + layoutLabel
            + ' @ ' + targetBitrate + 'kbps' + downmixNote + '\n';

        transcodesNeeded.push({
            sourceIndex: best.index,
            sourceChannels: best.channels,
            sourceCodec: best.codec,
            lang: lang2,
            targetChannels: targetChannels,
            targetBitrate: targetBitrate,
            layoutLabel: layoutLabel,
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
    // Key rule: map font attachments LAST to avoid Matroska mux errors.
    // ──────────────────────────────────────────────
    var mapArgs = [];
    var codecArgs = [];
    var metadataArgs = [];

    var keptFontAttachmentIndexes = [];
    var excludedAttachmentIndexes = [];

    // 4a) Map ALL non-attachment streams first (video/audio/subtitles/etc.)
    for (var mi = 0; mi < streams.length; mi++) {
        var st = streams[mi];
        if (st && st.codec_type === 'attachment') {
            if (isFontAttachment(st)) {
                keptFontAttachmentIndexes.push(mi);
            } else {
                excludedAttachmentIndexes.push(mi);
            }
            continue; // do not map attachments here
        }
        mapArgs.push('-map 0:' + mi);
    }

    // Logging for attachment handling
    for (var ei = 0; ei < excludedAttachmentIndexes.length; ei++) {
        response.infoLog += '[Stream #' + excludedAttachmentIndexes[ei] + '] Excluding attachment (non-font).\n';
    }

    codecArgs.push('-c copy');

    // 4b) Add new transcoded streams next (time-based streams must come before attachments)
    // outIdx must be the next OUTPUT stream index; start from count of already mapped streams
    var outIdx = mapArgs.length;

    for (var ti = 0; ti < transcodesNeeded.length; ti++) {
        var tc = transcodesNeeded[ti];

        // Map the source audio stream again to create the new encoded track
        mapArgs.push('-map 0:' + tc.sourceIndex);

        codecArgs.push('-c:' + outIdx + ' ' + targetCodec);
        codecArgs.push('-b:' + outIdx + ' ' + tc.targetBitrate + 'k');
        codecArgs.push('-ac:' + outIdx + ' ' + tc.targetChannels);

        metadataArgs.push('-metadata:s:' + outIdx + ' language=' + tc.lang);

        // Title without spaces or special characters to avoid CLI parsing issues
        var title = targetCodec.toUpperCase() + '_' + tc.layoutLabel + '_fallback';
        metadataArgs.push('-metadata:s:' + outIdx + ' title=' + title);

        // Copy disposition flags from source, except 'default'
        var srcDispo = (streams[tc.sourceIndex] && streams[tc.sourceIndex].disposition) ? streams[tc.sourceIndex].disposition : {};
        var flags = Object.keys(srcDispo)
            .filter(function (key) { return srcDispo[key] === 1 && key !== 'default'; })
            .join('+');
        metadataArgs.push('-disposition:' + outIdx + ' ' + (flags || '0'));

        outIdx++;
    }

    // 4c) Map kept font attachments LAST
    for (var fi = 0; fi < keptFontAttachmentIndexes.length; fi++) {
        var fIdx = keptFontAttachmentIndexes[fi];
        mapArgs.push('-map 0:' + fIdx);

        var t = (streams[fIdx] && streams[fIdx].tags) ? streams[fIdx].tags : {};
        response.infoLog += '[Stream #' + fIdx + '] Keeping font attachment (mapped last): ' + (t.filename || 'unknown') + '\n';
    }

    var allArgs = [
        mapArgs.join(' '),
        codecArgs.join(' '),
        metadataArgs.join(' '),
        '-max_muxing_queue_size 9999',
    ].join(' ');

    var ffmpegCommand = ', ' + allArgs;

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