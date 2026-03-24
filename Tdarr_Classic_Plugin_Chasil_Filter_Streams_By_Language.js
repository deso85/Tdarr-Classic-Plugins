/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Filter_Streams_By_Language",
        Stage: "Pre-processing",
        Name: "[Chasil] Filter audio and subtitle streams by language",
        Operation: "Transcode",
        Description: "[Contains built-in filter] Removes audio and subtitle streams whose language is not in the configured keep-list. Video and other stream types are never touched.",
        Version: "1.0",
        Link: "",
        Tags: "pre-processing,audio,subtitle,ffmpeg,configurable",
        Inputs: [
            {
                name: "audio_languages",
                type: 'string',
                defaultValue: 'eng,deu',
                inputUI: {
                    type: 'text',
                },
                tooltip: 'Comma-separated list of languages to KEEP for audio streams. Accepts ISO 639-1 (en, de) and ISO 639-2/B or /T (eng, ger, deu).\\n(default: eng,deu)',
            },
            {
                name: "subtitle_languages",
                type: 'string',
                defaultValue: 'eng,deu',
                inputUI: {
                    type: 'text',
                },
                tooltip: 'Comma-separated list of languages to KEEP for subtitle streams. Accepts ISO 639-1 (en, de) and ISO 639-2/B or /T (eng, ger, deu).\\n(default: eng,deu)',
            },
            {
                name: "keep_undefined_audio",
                type: 'boolean',
                defaultValue: true,
                inputUI: {
                    type: 'dropdown',
                    options: ['false', 'true'],
                },
                tooltip: 'Keep audio streams that have no language tag set.\\n(default: true)',
            },
            {
                name: "keep_undefined_subtitle",
                type: 'boolean',
                defaultValue: true,
                inputUI: {
                    type: 'dropdown',
                    options: ['false', 'true'],
                },
                tooltip: 'Keep subtitle streams that have no language tag set.\\n(default: true)',
            },
        ],
    };
};

// ISO 639-1 (2-letter) to ISO 639-2/T (3-letter)
const iso639Map = {
    aa: "aar", ab: "abk", af: "afr", ak: "aka", am: "amh", an: "arg",
    ar: "ara", as: "asm", av: "ava", ay: "aym", az: "aze", ba: "bak",
    be: "bel", bg: "bul", bh: "bih", bi: "bis", bm: "bam", bn: "ben",
    bo: "bod", br: "bre", bs: "bos", ca: "cat", ce: "che", ch: "cha",
    co: "cos", cr: "cre", cs: "ces", cu: "chu", cv: "chv", cy: "cym",
    da: "dan", de: "deu", dv: "div", dz: "dzo", ee: "ewe", el: "ell",
    en: "eng", eo: "epo", es: "spa", et: "est", eu: "eus", fa: "fas",
    ff: "ful", fi: "fin", fj: "fij", fo: "fao", fr: "fra", fy: "fry",
    ga: "gle", gd: "gla", gl: "glg", gn: "grn", gu: "guj", gv: "glv",
    ha: "hau", he: "heb", hi: "hin", ho: "hmo", hr: "hrv", ht: "hat",
    hu: "hun", hy: "hye", hz: "her", ia: "ina", id: "ind", ie: "ile",
    ig: "ibo", ii: "iii", ik: "ipk", io: "ido", is: "isl", it: "ita",
    iu: "iku", ja: "jpn", jv: "jav", ka: "kat", kg: "kon", ki: "kik",
    kj: "kua", kk: "kaz", kl: "kal", km: "khm", kn: "kan", ko: "kor",
    kr: "kau", ks: "kas", ku: "kur", kv: "kom", kw: "cor", ky: "kir",
    la: "lat", lb: "ltz", lg: "lug", li: "lim", ln: "lin", lo: "lao",
    lt: "lit", lu: "lub", lv: "lav", mg: "mlg", mh: "mah", mi: "mri",
    mk: "mkd", ml: "mal", mn: "mon", mr: "mar", ms: "msa", mt: "mlt",
    my: "mya", na: "nau", nb: "nob", nd: "nde", ne: "nep", ng: "ndo",
    nl: "nld", nn: "nno", no: "nor", nr: "nbl", nv: "nav", ny: "nya",
    oc: "oci", oj: "oji", om: "orm", or: "ori", os: "oss", pa: "pan",
    pi: "pli", pl: "pol", ps: "pus", pt: "por", qu: "que", rm: "roh",
    rn: "run", ro: "ron", ru: "rus", rw: "kin", sa: "san", sc: "srd",
    sd: "snd", se: "sme", sg: "sag", si: "sin", sk: "slk", sl: "slv",
    sm: "smo", sn: "sna", so: "som", sq: "sqi", sr: "srp", ss: "ssw",
    st: "sot", su: "sun", sv: "swe", sw: "swa", ta: "tam", te: "tel",
    tg: "tgk", th: "tha", ti: "tir", tk: "tuk", tl: "tgl", tn: "tsn",
    to: "ton", tr: "tur", ts: "tso", tt: "tat", tw: "twi", ty: "tah",
    ug: "uig", uk: "ukr", ur: "urd", uz: "uzb", ve: "ven", vi: "vie",
    vo: "vol", wa: "wln", wo: "wol", xh: "xho", yi: "yid", yo: "yor",
    za: "zha", zh: "zho", zu: "zul",
};

// ISO 639-2/B alternatives to their ISO 639-2/T canonical form
const iso639Aliases = {
    alb: "sqi", // Albanian
    arm: "hye", // Armenian
    baq: "eus", // Basque
    bur: "mya", // Burmese
    chi: "zho", // Chinese
    cze: "ces", // Czech
    dut: "nld", // Dutch
    fre: "fra", // French
    geo: "kat", // Georgian
    ger: "deu", // German
    gre: "ell", // Greek
    ice: "isl", // Icelandic
    mac: "mkd", // Macedonian
    mao: "mri", // Maori
    may: "msa", // Malay
    per: "fas", // Persian
    rum: "ron", // Romanian
    slo: "slk", // Slovak
    tib: "bod", // Tibetan
    wel: "cym", // Welsh
};

function normalizeCode(code) {
    code = code.trim().toLowerCase();
    // 2-letter to 3-letter
    if (code.length === 2 && iso639Map[code]) {
        code = iso639Map[code];
    }
    // B-variant to T-variant
    if (iso639Aliases[code]) {
        code = iso639Aliases[code];
    }
    return code;
}

function parseLanguages(input) {
    if (!input || input.trim() === "") return [];
    const codes = new Set();
    input.split(',').forEach(lang => {
        const normalized = normalizeCode(lang);
        if (normalized.length > 0) {
            codes.add(normalized);
        }
    });
    return [...codes];
}

const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require('../methods/lib')();
    inputs = lib.loadDefaultValues(inputs, details);

    const response = {
        processFile: false,
        preset: "",
        container: "." + file.container,
        handBrakeMode: false,
        FFmpegMode: true,
        reQueueAfter: false,
        infoLog: "",
    };

    // Parse settings
    const audioLanguages = parseLanguages(inputs.audio_languages);
    const subtitleLanguages = parseLanguages(inputs.subtitle_languages);
    const keepUndefinedAudio = inputs.keep_undefined_audio === true || inputs.keep_undefined_audio === 'true';
    const keepUndefinedSubtitle = inputs.keep_undefined_subtitle === true || inputs.keep_undefined_subtitle === 'true';

    // Log configuration
    response.infoLog += `Audio languages to keep: ${audioLanguages.join(', ')}\n`;
    response.infoLog += `Subtitle languages to keep: ${subtitleLanguages.join(', ')}\n`;
    response.infoLog += `Keep undefined audio: ${keepUndefinedAudio}\n`;
    response.infoLog += `Keep undefined subtitle: ${keepUndefinedSubtitle}\n`;

    // Abort if no streams
    if (!file.ffProbeData || !file.ffProbeData.streams) {
        response.infoLog += "☒ File has no stream data. Skipping.\n";
        return response;
    }

    const streamsToKeep = [];
    const streamsToRemove = [];

    for (let i = 0; i < file.ffProbeData.streams.length; i++) {
        const stream = file.ffProbeData.streams[i];
        const codecType = (stream.codec_type || "").toLowerCase();
        const lang = (stream.tags && stream.tags.language) ? stream.tags.language.trim().toLowerCase() : undefined;
        const normalizedLang = lang ? normalizeCode(lang) : undefined;

        if (codecType === "audio") {
            if (!normalizedLang) {
                if (keepUndefinedAudio) {
                    streamsToKeep.push(i);
                } else {
                    streamsToRemove.push({ index: i, type: "audio", lang: "undefined" });
                }
            } else if (audioLanguages.includes(normalizedLang)) {
                streamsToKeep.push(i);
            } else {
                streamsToRemove.push({ index: i, type: "audio", lang: lang });
            }
        } else if (codecType === "subtitle") {
            if (!normalizedLang) {
                if (keepUndefinedSubtitle) {
                    streamsToKeep.push(i);
                } else {
                    streamsToRemove.push({ index: i, type: "subtitle", lang: "undefined" });
                }
            } else if (subtitleLanguages.includes(normalizedLang)) {
                streamsToKeep.push(i);
            } else {
                streamsToRemove.push({ index: i, type: "subtitle", lang: lang });
            }
        } else {
            // Video, data, attachments etc. — always keep
            streamsToKeep.push(i);
        }
    }

    // Nothing to remove
    if (streamsToRemove.length === 0) {
        response.infoLog += "☑ All streams match the language filter. Nothing to do.\n";
        return response;
    }

    // Log removals
    for (const removed of streamsToRemove) {
        response.infoLog += `☒ Removing ${removed.type} stream #${removed.index} (language: ${removed.lang})\n`;
    }

    // Build ffmpeg command
    const mapArgs = streamsToKeep.map(i => `-map 0:${i}`).join(' ');
    const ffmpegCommand = `, -fflags +bitexact -flags:v +bitexact -flags:a +bitexact ${mapArgs} -c copy -max_muxing_queue_size 9999`;

    response.processFile = true;
    response.preset = ffmpegCommand;
    response.container = "." + file.container;
    response.handBrakeMode = false;
    response.FFmpegMode = true;
    response.reQueueAfter = true;
    response.infoLog += `☒ File has ${streamsToRemove.length} stream(s) to remove!\n`;

    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
