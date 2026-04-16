const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Ensure_Stream_Defaults",
        Stage: "Pre-processing",
        Name: "[Chasil] Ensure Stream Defaults",
        Type: "Video",
        Operation: "Transcode",
        Description:
            "Ensures exactly one video and audio stream is set as default, " +
            "and at most one subtitle stream. Applies language preferences, " +
            "forced subtitle logic, audio codec priority, and format priority when selecting the best candidate.",
        Version: "1.1",
        Tags: "pre-processing,video,audio,subtitle,ffmpeg,configurable",
        Inputs: [
            {
                name: "preferred_audio_language",
                type: "string",
                defaultValue: "ger",
                inputUI: { type: "text" },
                tooltip:
                    "Preferred audio language as a 3-letter ISO 639-2 code (e.g. ger, eng, jpn).",
            },
            {
                name: "fallback_audio_language",
                type: "string",
                defaultValue: "eng",
                inputUI: { type: "text" },
                tooltip:
                    "Fallback audio language if the preferred language is not found.",
            },
            {
                name: "audio_codec_priority",
                type: "string",
                defaultValue: "eac3,ac3,aac,truehd,dts,flac,opus,mp3",
                inputUI: { type: "text" },
                tooltip:
                    "Comma-separated audio codec priority (best first). " +
                    "Codecs not listed will be ranked worst. " +
                    "Example: eac3,ac3,aac,truehd,dts,flac,opus,mp3",
            },
            {
                name: "preferred_subtitle_language",
                type: "string",
                defaultValue: "ger",
                inputUI: { type: "text" },
                tooltip:
                    "Preferred subtitle language as a 3-letter ISO 639-2 code.",
            },
            {
                name: "forced_sub_as_default_for_matching_audio",
                type: "boolean",
                defaultValue: true,
                inputUI: { type: "dropdown", options: ["true", "false"] },
                tooltip:
                    "If the chosen audio language matches the preferred subtitle language, " +
                    "only set a forced subtitle as default (if one exists).",
            },
            {
                name: "subtitle_format_priority",
                type: "string",
                defaultValue: "srt,ass,hdmv,vobsub",
                inputUI: { type: "text" },
                tooltip:
                    "Comma-separated subtitle format priority (best first). " +
                    "Codecs not listed will be ranked worst. " +
                    "Example: srt,ass,hdmv,vobsub",
            },
        ],
    };
};

// ── Constants ──────────────────────────────────────────────────────────────────

// Maps user-facing format names to possible FFmpeg codec names
const FORMAT_CODEC_MAP = {
    srt: ["subrip", "srt"],
    ass: ["ass", "ssa"],
    hdmv: ["hdmv_pgs_subtitle", "pgssub"],
    vobsub: ["dvd_subtitle", "dvdsub", "vobsub"],
};

const WORST_FORMAT_RANK = 9999;

// ── Helper functions ───────────────────────────────────────────────────────────

const getLanguage = (stream) => {
    return (
        (stream.tags && (stream.tags.language || "").toLowerCase()) || "und"
    );
};

const hasDisposition = (stream, key) => {
    return (
        stream.disposition &&
        (stream.disposition[key] === 1 || stream.disposition[key] === true)
    );
};

const getSubtitleType = (stream) => {
    if (hasDisposition(stream, "forced")) return "forced";
    if (hasDisposition(stream, "hearing_impaired")) return "sdh";
    const title = (
        (stream.tags && (stream.tags.title || "")) ||
        ""
    ).toLowerCase();
    if (title.includes("forced") || title.includes("zwang")) return "forced";
    if (title.includes("sdh") || title.includes("hearing")) return "sdh";
    return "normal";
};

const buildFormatPriority = (csvString) => {
    const map = {};
    csvString
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .forEach((fmt, idx) => {
            const codecs = FORMAT_CODEC_MAP[fmt] || [fmt];
            codecs.forEach((c) => {
                map[c] = idx;
            });
        });
    return map;
};

const getFormatRank = (stream, priorityMap) => {
    const codec = (stream.codec_name || "").toLowerCase();
    return (codec in priorityMap) ? priorityMap[codec] : WORST_FORMAT_RANK;
};

const pickBestFormat = (candidates, priorityMap) => {
    if (candidates.length === 0) return null;
    let best = candidates[0];
    let bestRank = getFormatRank(best, priorityMap);
    for (let i = 1; i < candidates.length; i++) {
        const rank = getFormatRank(candidates[i], priorityMap);
        if (rank < bestRank) {
            best = candidates[i];
            bestRank = rank;
        }
    }
    return best;
};

const buildAudioCodecPriority = (csvString) => {
    const map = {};
    csvString
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .forEach((codec, idx) => {
            map[codec] = idx;
        });
    return map;
};

const getAudioCodecRank = (stream, priorityMap) => {
    const codec = (stream.codec_name || "").toLowerCase();
    if (codec in priorityMap) return priorityMap[codec];
    for (const key of Object.keys(priorityMap)) {
        if (codec.includes(key) || key.includes(codec)) return priorityMap[key];
    }
    return WORST_FORMAT_RANK;
};

const pickBestAudioCodec = (candidates, priorityMap) => {
    if (candidates.length === 0) return null;
    let best = candidates[0];
    let bestRank = getAudioCodecRank(best, priorityMap);
    for (let i = 1; i < candidates.length; i++) {
        const rank = getAudioCodecRank(candidates[i], priorityMap);
        if (rank < bestRank) {
            best = candidates[i];
            bestRank = rank;
        }
    }
    return best;
};

const buildDispositionString = (stream, shouldBeDefault) => {
    const keys = [
        "default",
        "dub",
        "original",
        "comment",
        "lyrics",
        "karaoke",
        "forced",
        "hearing_impaired",
        "visual_impaired",
        "clean_effects",
        "attached_pic",
        "timed_thumbnails",
    ];
    const parts = [];
    keys.forEach((key) => {
        const val =
            key === "default"
                ? shouldBeDefault
                : stream.disposition &&
                  (stream.disposition[key] === 1 ||
                      stream.disposition[key] === true);
        parts.push((val ? "+" : "-") + key);
    });
    return parts.join("");
};

// ── Main plugin ────────────────────────────────────────────────────────────────

const plugin = (file, librarySettings, inputs, otherArguments) => {
    const response = {
        processFile: false,
        preset: "",
        container: `.${file.container}`,
        handBrakeMode: false,
        FFmpegMode: true,
        reQueueAfter: false,
        infoLog: "",
    };

    if (!file.ffProbeData || !file.ffProbeData.streams) {
        response.infoLog += "⚠ No stream data found. Skipping.\n";
        return response;
    }

    const streams = file.ffProbeData.streams;

    const videoStreams = streams.filter((s) => s.codec_type === "video");
    const audioStreams = streams.filter((s) => s.codec_type === "audio");
    const subtitleStreams = streams.filter((s) => s.codec_type === "subtitle");

    const prefAudioLang = (inputs.preferred_audio_language || "ger")
        .trim()
        .toLowerCase();
    const prefSubLang = (inputs.preferred_subtitle_language || "ger")
        .trim()
        .toLowerCase();
    const fallbackAudioLang = (inputs.fallback_audio_language || "eng")
        .trim()
        .toLowerCase();
    const forcedSubForMatch =
        String(inputs.forced_sub_as_default_for_matching_audio) === "true";
    const formatPriority = buildFormatPriority(
        inputs.subtitle_format_priority || "srt,ass,hdmv,vobsub"
    );
    const audioCodecPriority = buildAudioCodecPriority(
        inputs.audio_codec_priority || "truehd,dts,flac,eac3,ac3,aac,opus,mp3"
    );

    // ── Categorise streams ─────────────────────────────────────────────────────
    response.infoLog += "=== Settings ===\n";
    response.infoLog += `  Preferred audio language    : ${prefAudioLang}\n`;
    response.infoLog += `  Preferred subtitle language : ${prefSubLang}\n`;
    response.infoLog += `  Fallback audio language     : ${fallbackAudioLang}\n`;
    response.infoLog += `  Forced sub for matching     : ${forcedSubForMatch}\n`;
    response.infoLog += `  Audio codec priority        : ${inputs.audio_codec_priority || "truehd,dts,flac,eac3,ac3,aac,opus,mp3"}\n`;
    response.infoLog += `  Subtitle format priority    : ${inputs.subtitle_format_priority || "srt,ass,hdmv,vobsub"}\n`;
    response.infoLog += "\n";

    // ── Stream overview ────────────────────────────────────────────────────────

    response.infoLog += "=== Stream Overview ===\n";
    streams.forEach((s) => {
        const lang = getLanguage(s);
        const codec = s.codec_name || "unknown";
        const def = hasDisposition(s, "default") ? "DEFAULT" : "";
        const forced = hasDisposition(s, "forced") ? "FORCED" : "";
        const hi = hasDisposition(s, "hearing_impaired") ? "SDH" : "";
        const title = (s.tags && s.tags.title) || "";
        const flags = [def, forced, hi].filter(Boolean).join(", ");
        response.infoLog += `  [${s.index}] ${s.codec_type} | ${codec} | ${lang} | ${title} ${flags ? "(" + flags + ")" : ""}\n`;
    });
    response.infoLog += "\n";

    // ── 1. Video default ───────────────────────────────────────────────────────

    response.infoLog += "=== Video Default ===\n";

    let chosenVideoDefault = null;

    if (videoStreams.length > 0) {
        const currentVideoDefaults = videoStreams.filter((s) =>
            hasDisposition(s, "default")
        );
        if (currentVideoDefaults.length === 1) {
            chosenVideoDefault = currentVideoDefaults[0];
            response.infoLog += `  ☑ Exactly one video default (stream ${chosenVideoDefault.index}). No change.\n`;
        } else {
            chosenVideoDefault = videoStreams[0];
            response.infoLog += `  ☒ ${currentVideoDefaults.length} video defaults found. Setting stream ${chosenVideoDefault.index} as default.\n`;
        }
    } else {
        response.infoLog += "  ⚠ No video streams found.\n";
    }

    response.infoLog += "\n";

    // ── 2. Audio default ───────────────────────────────────────────────────────

    response.infoLog += "=== Audio Default ===\n";

    let chosenAudioDefault = null;
    let defaultAudioLang = null;

    if (audioStreams.length > 0) {
        const currentAudioDefaults = audioStreams.filter((s) =>
            hasDisposition(s, "default")
        );
        const prefAudioCandidates = audioStreams.filter(
            (s) => getLanguage(s) === prefAudioLang
        );
        const fallbackAudioCandidates = audioStreams.filter(
            (s) => getLanguage(s) === fallbackAudioLang
        );

        if (prefAudioCandidates.length > 0) {
            chosenAudioDefault = pickBestAudioCodec(
                prefAudioCandidates,
                audioCodecPriority
            );
            response.infoLog += `  ☒ Preferred language '${prefAudioLang}' found. Best codec '${chosenAudioDefault.codec_name}'. Setting stream ${chosenAudioDefault.index} as default.\n`;
        } else if (fallbackAudioCandidates.length > 0) {
            chosenAudioDefault = pickBestAudioCodec(
                fallbackAudioCandidates,
                audioCodecPriority
            );
            response.infoLog += `  ☒ Preferred '${prefAudioLang}' not found. Fallback '${fallbackAudioLang}' found. Best codec '${chosenAudioDefault.codec_name}'. Setting stream ${chosenAudioDefault.index} as default.\n`;
        } else if (currentAudioDefaults.length === 1) {
            chosenAudioDefault = currentAudioDefaults[0];
            response.infoLog += `  ☑ Neither preferred nor fallback found. Keeping existing default stream ${chosenAudioDefault.index}.\n`;
        } else {
            chosenAudioDefault = audioStreams[0];
            response.infoLog += `  ☒ No suitable language found. Setting first audio stream ${chosenAudioDefault.index} as default.\n`;
        }

        defaultAudioLang = getLanguage(chosenAudioDefault);
    } else {
        response.infoLog += "  ⚠ No audio streams found.\n";
    }

    response.infoLog += "\n";

    // ── 3. Subtitle default ────────────────────────────────────────────────────

    response.infoLog += "=== Subtitle Default ===\n";

    let chosenSubDefault = null;

    if (subtitleStreams.length > 0 && defaultAudioLang) {
        const audioMatchesSub = defaultAudioLang === prefSubLang;

        const subsOfPrefLang = subtitleStreams.filter(
            (s) => getLanguage(s) === prefSubLang
        );
        const subsOfAudioLang = subtitleStreams.filter(
            (s) => getLanguage(s) === defaultAudioLang
        );

        const normalSubs = (arr) =>
            arr.filter((s) => getSubtitleType(s) === "normal");
        const sdhSubs = (arr) =>
            arr.filter((s) => getSubtitleType(s) === "sdh");
        const forcedSubs = (arr) =>
            arr.filter((s) => getSubtitleType(s) === "forced");

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

            const bestNormal = pickBestFormat(
                normalSubs(subsOfPrefLang),
                formatPriority
            );
            const bestSdh = pickBestFormat(
                sdhSubs(subsOfPrefLang),
                formatPriority
            );
            const bestForcedAudio = pickBestFormat(
                forcedSubs(subsOfAudioLang),
                formatPriority
            );

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
            const shouldBeDefault =
                chosen !== null && stream.index === chosen.index;

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
