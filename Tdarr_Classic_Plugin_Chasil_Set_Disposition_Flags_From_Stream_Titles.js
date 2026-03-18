const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Set_Disposition_Flags_From_Stream_Titles",
        Stage: "Pre-processing",
        Name: "[Chasil] Set Disposition Flags from Stream Titles",
        Operation: "Transcode",
        Description: "Parses stream titles and sets matching disposition flags (forced, commentary, hearing/visual impaired). "
            + "Each input field accepts comma-separated regex patterns (case-insensitive). "
            + "Leave empty to use defaults.",
        Version: "1.0",
        Tags: "pre-processing",
        Inputs: [
            {
                name: 'forcedPatterns',
                type: 'string',
                defaultValue: '',
                inputUI: { type: 'text' },
                tooltip: 'Additional patterns for forced disposition (comma-separated). '
                + 'Defaults: forced, erzwungen',
            },
            {
                name: 'commentPatterns',
                type: 'string',
                defaultValue: '',
                inputUI: { type: 'text' },
                tooltip: 'Additional patterns for comment disposition (comma-separated). '
                + 'Defaults: comment, kommentar',
            },
            {
                name: 'hearingImpairedPatterns',
                type: 'string',
                defaultValue: '',
                inputUI: { type: 'text' },
                tooltip: 'Additional patterns for hearing_impaired disposition (comma-separated). '
                + 'Defaults: sdh, hearing.?impaired, hard.?of.?hearing, closed.?caption, '
                + 'hörgeschädigt, \\bcc\\b',
            },
            {
                name: 'visualImpairedPatterns',
                type: 'string',
                defaultValue: '',
                inputUI: { type: 'text' },
                tooltip: 'Additional patterns for visual_impaired disposition (comma-separated). '
                + 'Defaults: audio.?desc, visual.?impaired, descriptive, audiodeskription, hörfilm',
            },
        ],
    };
};

// Default regex patterns for each disposition flag (case-insensitive)
const DEFAULT_PATTERNS = {
    forced: [
        /forced/i,
        /erzwungen/i,
    ],
    comment: [
        /comment/i,
        /kommentar/i,
    ],
    hearing_impaired: [
        /sdh/i,
        /hearing.?impaired/i,
        /hard.?of.?hearing/i,
        /closed.?caption/i,
        /hörgeschädigt/i,
        /\bcc\b/i,
    ],
    visual_impaired: [
        /audio.?desc/i,
        /visual.?impaired/i,
        /descriptive/i,
        /audiodeskription/i,
        /hörfilm/i,
    ],
};

// Maps input field names to their corresponding FFmpeg disposition flag
const INPUT_TO_DISPOSITION = {
    forcedPatterns: 'forced',
    commentPatterns: 'comment',
    hearingImpairedPatterns: 'hearing_impaired',
    visualImpairedPatterns: 'visual_impaired',
};

// Parses a comma-separated string of user-defined patterns into RegExp objects
const parseCustomPatterns = (input) => {
    if (!input || !input.trim()) return [];

    return input
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => {
            try {
                return new RegExp(s, 'i');
            } catch (e) {
                // Skip invalid regex patterns
                return null;
            }
        })
        .filter((r) => r !== null);
};

// Merges default patterns with any user-defined custom patterns
const buildPatterns = (inputs) => {
    const patterns = {};

    for (const [disposition, defaults] of Object.entries(DEFAULT_PATTERNS)) {
        patterns[disposition] = [...defaults];
    }

    for (const [inputName, disposition] of Object.entries(INPUT_TO_DISPOSITION)) {
        const custom = parseCustomPatterns(inputs[inputName]);
        if (custom.length > 0) {
            patterns[disposition].push(...custom);
        }
    }

    return patterns;
};

// Tests a stream title against all patterns and returns matched dispositions
const detectDispositions = (title, patterns) => {
    const detected = {};

    for (const [disposition, regexes] of Object.entries(patterns)) {
        detected[disposition] = regexes.some((pattern) => pattern.test(title)) ? 1 : 0;
    }

    return detected;
};

const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require('../methods/lib')();
    inputs = lib.loadDefaultValues(inputs, details);

    const response = {
        processFile: false,
        preset: '',
        container: `.${file.container}`,
        handBrakeMode: false,
        FFmpegMode: true,
        reQueueAfter: false,
        infoLog: '',
    };

    const patterns = buildPatterns(inputs);
    let dispositionArgs = [];

    file.ffProbeData.streams.forEach((stream, index) => {
        const title = (stream.tags && stream.tags.title) || '';
        if (!title) return;

        const detected = detectDispositions(title, patterns);
        const activeFlags = Object.entries(detected)
            .filter(([, value]) => value === 1)
            .map(([key]) => key);

        // No matching disposition patterns found for this stream
        if (activeFlags.length === 0) return;

        const currentDisposition = stream.disposition || {};

        // Collect all flags that are currently set on this stream
        const existingFlags = Object.entries(currentDisposition)
            .filter(([, value]) => value === 1)
            .map(([key]) => key);

        // Determine which detected flags are not yet set
        const newFlags = activeFlags.filter((flag) => !existingFlags.includes(flag));

        // All detected flags are already set, nothing to do
        if (newFlags.length === 0) {
            response.infoLog += `Stream ${index} ("${title}"): ${activeFlags.join(', ')} already set.\n`;
            return;
        }

        response.infoLog += `Stream ${index} ("${title}"): Adding ${newFlags.join(', ')}\n`;

        // Combine existing and new flags to preserve flags like 'default'
        const allFlags = [...new Set([...existingFlags, ...activeFlags])];
        const dispositionString = allFlags.join('+');
        dispositionArgs.push(`-disposition:${index}`);
        dispositionArgs.push(dispositionString);
    });

    if (dispositionArgs.length === 0) {
        response.infoLog += 'No disposition changes needed.\n';
        return response;
    }

    response.processFile = true;
    response.preset = `,-map 0 -c copy ${dispositionArgs.join(' ')}`;
    response.infoLog += `Applying disposition changes to ${dispositionArgs.length / 2} stream(s).\n`;

    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
