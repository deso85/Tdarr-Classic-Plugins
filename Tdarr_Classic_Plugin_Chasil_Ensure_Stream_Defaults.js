const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Ensure_Stream_Defaults",
        Stage: "Pre-processing",
        Name: "[Chasil] Ensure Stream Defaults",
        Type: "Video",
        Operation: "Transcode",
        Description: "Ensures exactly one video and audio stream is set as default, "
            + "and at most one subtitle stream. Applies language preferences, "
            + "forced subtitle logic, and format priority when selecting the best candidate.",
        Version: "1.0",
        Tags: "pre-processing,video,audio,subtitle,ffmpeg,configurable",
        Inputs: [
            {
                name: "preferred_audio_language",
                type: "string",
                defaultValue: "ger",
                inputUI: { type: "text" },
                tooltip: "Preferred language for the default audio stream (ISO 639-2, e.g. ger, eng, jpn).",
            },
            {
                name: "preferred_subtitle_language",
                type: "string",
                defaultValue: "ger",
                inputUI: { type: "text" },
                tooltip: "Preferred language for the default subtitle stream (ISO 639-2, e.g. ger, eng, jpn).",
            },
            {
                name: "fallback_audio_language",
                type: "string",
                defaultValue: "eng",
                inputUI: { type: "text" },
                tooltip: "Fallback language if preferred audio is unavailable (ISO 639-2, e.g. eng).",
            },
            {
                name: "subtitle_format_priority",
                type: "string",
                defaultValue: "ass,srt,hdmv,vobsub",
                inputUI: { type: "text" },
                tooltip: "Comma-separated subtitle format priority (best first). "
                    + "Recognised values: ass, srt, hdmv, vobsub. "
                    + "Formats not listed will be ranked worst. "
                    + "Example: ass,srt,hdmv,vobsub or srt,ass,hdmv,vobsub",
            },
            {
                name: "forced_sub_as_default_for_matching_audio",
                type: "boolean",
                defaultValue: "true",
                inputUI: {
                    type: "dropdown",
                    options: ["false", "true"],
                },
                tooltip: "When the default audio language matches the preferred subtitle language, "
                    + "set a forced subtitle of that language as default (if available).",
            },
        ],
    };
};

// ── Subtitle format codec mapping ──────────────────────────────────────────────

// Maps user-facing format names to possible FFmpeg codec names
const FORMAT_CODEC_MAP = {
    srt: ["subrip", "srt"],
    ass: ["ass", "ssa"],
    hdmv: ["hdmv_pgs_subtitle", "pgssub"],
    vobsub: ["dvd_subtitle", "dvdsub", "vobsub"],
};

const WORST_FORMAT_RANK = 99;

/**
 * Builds a codec-to-rank mapping from a comma-separated priority string.
 * E.g. "ass,srt,hdmv,vobsub" → { subrip: 0, srt: 0, ass: 1, ssa: 1, ... }
 */
const buildFormatPriority = (priorityString) => {
    const result = {};
    const formats = priorityString
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0);

    formats.forEach((format, rank) => {
        const codecs = FORMAT_CODEC_MAP[format];
        if (codecs) {
            codecs.forEach((codec) => {
                result[codec] = rank;
            });
        }
    });

    return result;
};

// ── Helper functions ───────────────────────────────────────────────────────────

/**
 * Returns the ISO 639-2 language tag of a stream, normalised to lowercase.
 */
const getLanguage = (stream) => {
    return ((stream.tags && stream.tags.language) || "und").toLowerCase();
};

/**
 * Returns true if the stream has a specific disposition flag set.
 */
const hasDisposition = (stream, flag) => {
    return stream.disposition && stream.disposition[flag] === 1;
};

/**
 * Returns the format priority rank for a subtitle stream.
 */
const getFormatRank = (stream, priorityMap) => {
    const codec = (stream.codec_name || "").toLowerCase();
    return (codec in priorityMap) ? priorityMap[codec] : WORST_FORMAT_RANK;
};

/**
 * Classifies a subtitle stream as 'forced', 'commentary', 'sdh', or 'normal'.
 */
const getSubtitleType = (stream) => {
    if (hasDisposition(stream, "forced")) return "forced";
    if (hasDisposition(stream, "comment")) return "commentary";
    if (hasDisposition(stream, "hearing_impaired")) return "sdh";
    return "normal";
};

/**
 * From an array of subtitle streams picks the best one according to format priority.
 * Returns the stream object or null.
 */
const pickBestFormat = (streams, priorityMap) => {
    if (streams.length === 0) return null;
    return streams.reduce((best, current) => {
        return getFormatRank(current, priorityMap) < getFormatRank(best, priorityMap)
            ? current
            : best;
    });
};

/**
 * Collects all disposition flags currently set on a stream as an array of strings.
 */
const collectFlags = (stream) => {
    if (!stream.disposition) return [];
    return Object.entries(stream.disposition)
        .filter(([, v]) => v === 1)
        .map(([k]) => k);
};

/**
 * Builds a disposition string for FFmpeg.
 * Takes the existing flags on a stream and ensures 'default' is added or removed.
 */
const buildDispositionString = (stream, shouldBeDefault) => {
    const existing = collectFlags(stream);
    const withoutDefault = existing.filter((f) => f !== "default");

    if (shouldBeDefault) {
        withoutDefault.push("default");
    }

    return withoutDefault.length > 0 ? withoutDefault.join("+") : "0";
};

// ── Main plugin ────────────────────────────────────────────────────────────────

const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require("../methods/lib")();
    inputs = lib.loadDefaultValues(inputs, details);

    const response = {
        processFile: false,
        preset: "",
        container: `.${file.container}`,
        handBrakeMode: false,
        FFmpegMode: true,
        reQueueAfter: false,
        infoLog: "",
    };

    const prefAudioLang = (inputs.preferred_audio_language || "ger").trim().toLowerCase();
    const prefSubLang = (inputs.preferred_subtitle_language || "ger").trim().toLowerCase();
    const fallbackAudioLang = (inputs.fallback_audio_language || "eng").trim().toLowerCase();
    const forcedSubForMatch = String(inputs.forced_sub_as_default_for_matching_audio) === "true";
    const formatPriority = buildFormatPriority(inputs.subtitle_format_priority || "srt,ass,hdmv,vobsub");

    // ── Categorise streams ─────────────────────────────────────────────────────

    const allStreams = file.ffProbeData.streams;
    const videoStreams = allStreams.filter((s) => (s.codec_type || "").toLowerCase() === "video");
    const audioStreams = allStreams.filter((s) => (s.codec_type || "").toLowerCase() === "audio");
    const subtitleStreams = allStreams.filter((s) => (s.codec_type || "").toLowerCase() === "subtitle");

    response.infoLog += "=== Settings ===\n";
    response.infoLog += `  Preferred audio language    : ${prefAudioLang}\n`;
    response.infoLog += `  Preferred subtitle language : ${prefSubLang}\n`;
    response.infoLog += `  Fallback audio language     : ${fallbackAudioLang}\n`;
    response.infoLog += `  Forced sub for matching     : ${forcedSubForMatch}\n`;
    response.infoLog += `  Subtitle format priority    : ${inputs.subtitle_format_priority}\n`;
    response.infoLog += "\n";

    response.infoLog += "=== Stream Overview ===\n";
    response.infoLog += `  Video: ${videoStreams.length}  |  Audio: ${audioStreams.length}  |  Subtitle: ${subtitleStreams.length}\n\n`;

    // ── 1. Video default ───────────────────────────────────────────────────────

    response.infoLog += "=== Video Default ===\n";

    let chosenVideoDefault = null;

    if (videoStreams.length > 0) {
        const currentDefaults = videoStreams.filter((s) => hasDisposition(s, "default"));

        if (currentDefaults.length === 1) {
            chosenVideoDefault = currentDefaults[0];
            response.infoLog += `  ☑ Stream ${chosenVideoDefault.index}: Already the only default.\n`;
        } else if (currentDefaults.length > 1) {
            chosenVideoDefault = currentDefaults[0];
            response.infoLog += `  ☒ Multiple defaults found (${currentDefaults.length}). Keeping stream ${chosenVideoDefault.index} only.\n`;
        } else {
            chosenVideoDefault = videoStreams[0];
            response.infoLog += `  ☒ No default set. Setting stream ${chosenVideoDefault.index}.\n`;
        }
    } else {
        response.infoLog += "  ⚠ No video streams found.\n";
    }

    response.infoLog += "\n";

    // ── 2. Audio default ───────────────────────────────────────────────────────

    response.infoLog += "=== Audio Default ===\n";

    let chosenAudioDefault = null;

    if (audioStreams.length > 0) {
        const prefAudioCandidates = audioStreams.filter(
            (s) => getLanguage(s) === prefAudioLang
                && !hasDisposition(s, "comment")
                && !hasDisposition(s, "visual_impaired")
        );

        const fallbackAudioCandidates = audioStreams.filter(
            (s) => getLanguage(s) === fallbackAudioLang
                && !hasDisposition(s, "comment")
                && !hasDisposition(s, "visual_impaired")
        );

        const currentAudioDefaults = audioStreams.filter((s) => hasDisposition(s, "default"));

        if (prefAudioCandidates.length > 0) {
            chosenAudioDefault = prefAudioCandidates[0];
            response.infoLog += `  ☒ Preferred language '${prefAudioLang}' found. Setting stream ${chosenAudioDefault.index} as default.\n`;
        } else if (fallbackAudioCandidates.length > 0) {
            chosenAudioDefault = fallbackAudioCandidates[0];
            response.infoLog += `  ☒ Preferred '${prefAudioLang}' not found. Fallback '${fallbackAudioLang}' found. Setting stream ${chosenAudioDefault.index}.\n`;
        } else if (currentAudioDefaults.length === 1) {
            chosenAudioDefault = currentAudioDefaults[0];
            response.infoLog += `  ☑ Neither preferred nor fallback found. Keeping existing default stream ${chosenAudioDefault.index}.\n`;
        } else {
            chosenAudioDefault = audioStreams[0];
            response.infoLog += `  ☒ No suitable language found. Setting first audio stream ${chosenAudioDefault.index}.\n`;
        }
    } else {
        response.infoLog += "  ⚠ No audio streams found.\n";
    }

    const defaultAudioLang = chosenAudioDefault ? getLanguage(chosenAudioDefault) : null;

    response.infoLog += "\n";

    // ── 3. Subtitle default ────────────────────────────────────────────────────

    response.infoLog += "=== Subtitle Default ===\n";

    let chosenSubDefault = null;

    if (subtitleStreams.length > 0 && defaultAudioLang) {
        const audioMatchesSub = defaultAudioLang === prefSubLang;

        const subsOfPrefLang = subtitleStreams.filter((s) => getLanguage(s) === prefSubLang);
        const subsOfAudioLang = subtitleStreams.filter((s) => getLanguage(s) === defaultAudioLang);

        const normalSubs = (arr) => arr.filter((s) => getSubtitleType(s) === "normal");
        const sdhSubs = (arr) => arr.filter((s) => getSubtitleType(s) === "sdh");
        const forcedSubs = (arr) => arr.filter((s) => getSubtitleType(s) === "forced");

        if (audioMatchesSub) {
            response.infoLog += `  Audio language matches subtitle language (${prefSubLang}).\n`;

            if (forcedSubForMatch) {
                const forcedCandidates = forcedSubs(subsOfPrefLang);
                const best = pickBestFormat(forcedCandidates, formatPriority);
                if (best) {
                    chosenSubDefault = best;
                    response.infoLog += `  ☒ Forced subtitle found. Setting stream ${best.index} as default.\n`;
                } else {
                    response.infoLog += `  ☑ No forced subtitle in '${prefSubLang}'. No subtitle default.\n`;
                }
            } else {
                response.infoLog += `  ☑ Forced sub for matching audio disabled. No subtitle default.\n`;
            }
        } else {
            response.infoLog += `  Audio (${defaultAudioLang}) differs from preferred subtitle (${prefSubLang}).\n`;

            const bestNormal = pickBestFormat(normalSubs(subsOfPrefLang), formatPriority);
            const bestSdh = pickBestFormat(sdhSubs(subsOfPrefLang), formatPriority);
            const bestForcedAudio = pickBestFormat(forcedSubs(subsOfAudioLang), formatPriority);

            if (bestNormal) {
                chosenSubDefault = bestNormal;
                response.infoLog += `  ☒ Normal subtitle in '${prefSubLang}' found. Setting stream ${bestNormal.index} as default.\n`;
            } else if (bestSdh) {
                chosenSubDefault = bestSdh;
                response.infoLog += `  ☒ SDH subtitle in '${prefSubLang}' found (no normal). Setting stream ${bestSdh.index} as default.\n`;
            } else if (bestForcedAudio) {
                chosenSubDefault = bestForcedAudio;
                response.infoLog += `  ☒ No subtitle in '${prefSubLang}'. Forced subtitle in audio language '${defaultAudioLang}' found. Setting stream ${bestForcedAudio.index} as default.\n`;
            } else {
                response.infoLog += `  ☑ No suitable subtitle found. No subtitle default.\n`;
            }
        }
    } else if (subtitleStreams.length === 0) {
        response.infoLog += "  ☑ No subtitle streams present.\n";
    } else {
        response.infoLog += "  ⚠ No audio default determined — cannot evaluate subtitle logic.\n";
    }

    response.infoLog += "\n";

    // ── 4. Build disposition changes ───────────────────────────────────────────

    response.infoLog += "=== Applying Changes ===\n";

    const dispositionArgs = [];
    let changesNeeded = false;

    const processGroup = (streams, chosen, label) => {
        streams.forEach((stream) => {
            const isDefault = hasDisposition(stream, "default");
            const shouldBeDefault = chosen !== null && stream.index === chosen.index;

            if (isDefault === shouldBeDefault) {
                const lang = getLanguage(stream);
                const status = isDefault ? "default ✓" : "not default";
                response.infoLog += `  ☑ ${label} stream ${stream.index} (${lang}): ${status} — no change.\n`;
                return;
            }

            changesNeeded = true;
            const dispString = buildDispositionString(stream, shouldBeDefault);
            dispositionArgs.push(`-disposition:${stream.index}`);
            dispositionArgs.push(dispString);

            const lang = getLanguage(stream);
            const action = shouldBeDefault ? "default ON" : "default OFF";
            response.infoLog += `  ☒ ${label} stream ${stream.index} (${lang}): ${action}\n`;
        });
    };

    processGroup(videoStreams, chosenVideoDefault, "Video");
    processGroup(audioStreams, chosenAudioDefault, "Audio");
    processGroup(subtitleStreams, chosenSubDefault, "Subtitle");

    response.infoLog += "\n";

    // ── 5. Final result ────────────────────────────────────────────────────────

    if (!changesNeeded) {
        response.infoLog += "=== Result: No disposition changes needed. ===\n";
        return response;
    }

    response.processFile = true;
    response.reQueueAfter = true;
    response.preset = `, -fflags +bitexact -flags:v +bitexact -flags:a +bitexact -map 0 -c copy ${dispositionArgs.join(" ")}`;

    response.infoLog += `=== Result: Updating ${dispositionArgs.length / 2} stream(s). ===\n`;
    response.infoLog += `FFmpeg args: -map 0 -c copy ${dispositionArgs.join(" ")}\n`;

    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
