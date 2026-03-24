const details = () => {
    return {
        id: "Tdarr_Classic_Plugin_Chasil_Set_Disposition_Flags_From_Stream_Titles",
        Stage: "Pre-processing",
        Name: "[Chasil] Set Disposition Flags from Stream Titles",
        Operation: "Transcode",
        Description: "Parses stream titles and sets matching disposition flags (forced, commentary, hearing/visual impaired). "
            + "Each input field accepts comma-separated regex patterns (case-insensitive). "
            + "Leave empty to use defaults.",
        Version: "1.3",
        Tags: "pre-processing",
        Inputs: [
            {
                name: 'forcedPatterns',
                type: 'string',
                defaultValue: '',
                inputUI: { type: 'text' },
                tooltip: 'Additional patterns for forced disposition (comma-separated). '
                + 'Defaults: forced, erzwungen, signs',
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
                + 'hörgeschädigt, schwerhörig, \\bcc\\b',
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
        /\bsigns?\b/i,
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
        /schwerhörig/i,
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

// Map input field names to their corresponding disposition keys
const INPUT_MAP = {
    forcedPatterns: 'forced',
    commentPatterns: 'comment',
    hearingImpairedPatterns: 'hearing_impaired',
    visualImpairedPatterns: 'visual_impaired',
};

/**
 * Merges default patterns with user-supplied patterns from inputs.
 * User patterns are provided as comma-separated regex strings.
 */
const buildPatterns = (inputs) => {
    const patterns = {};

    for (const [inputKey, dispositionKey] of Object.entries(INPUT_MAP)) {
        patterns[dispositionKey] = [...DEFAULT_PATTERNS[dispositionKey]];

        const userValue = inputs[inputKey];
        if (userValue && typeof userValue === 'string' && userValue.trim()) {
            const userPatterns = userValue
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => new RegExp(s, 'i'));
            patterns[dispositionKey].push(...userPatterns);
        }
    }

    return patterns;
};

/**
 * Tests the given title against all pattern groups and returns
 * an object with disposition flags set to 1 (match) or 0 (no match).
 */
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

    // Log active patterns per disposition for transparency
    response.infoLog += '=== Active Patterns ===\n';
    for (const [disposition, regexes] of Object.entries(patterns)) {
        const patternStrings = regexes.map((r) => r.source).join(', ');
        response.infoLog += `  ${disposition}: ${patternStrings}\n`;
    }
    response.infoLog += '\n';

    // Log stream overview
    const totalStreams = file.ffProbeData.streams.length;
    response.infoLog += `=== Scanning ${totalStreams} stream(s) ===\n`;

    let dispositionArgs = [];

    file.ffProbeData.streams.forEach((stream, index) => {
        const codec = stream.codec_type || 'unknown';
        const title = (stream.tags && stream.tags.title) || '';

       // Skip non-audio/subtitle streams
       if (codec !== 'audio' && codec !== 'subtitle') {
           response.infoLog += `  Stream ${index} (${codec}): Not applicable — skipped.\n`;
           return;
       }

       // Skip streams without a title and log them
        if (!title) {
            response.infoLog += `  Stream ${index} (${codec}): No title — skipped.\n`;
            return;
        }

        const detected = detectDispositions(title, patterns);
        const activeFlags = Object.entries(detected)
            .filter(([, value]) => value === 1)
            .map(([key]) => key);

        // No matching disposition patterns found for this stream
        if (activeFlags.length === 0) {
            response.infoLog += `  Stream ${index} (${codec}, "${title}"): No matches.\n`;
            return;
        }

        const currentDisposition = stream.disposition || {};

        // Collect all flags that are currently set on this stream
        const existingFlags = Object.entries(currentDisposition)
            .filter(([, value]) => value === 1)
            .map(([key]) => key);

        // Determine which detected flags are not yet set
        const newFlags = activeFlags.filter((flag) => !existingFlags.includes(flag));

        // All detected flags are already set, nothing to do
        if (newFlags.length === 0) {
            response.infoLog += `  Stream ${index} (${codec}, "${title}"): `
                + `${activeFlags.join(', ')} already set.\n`;
            return;
        }

        response.infoLog += `  Stream ${index} (${codec}, "${title}"): `
            + `Adding ${newFlags.join(', ')} `
            + `(existing: ${existingFlags.length > 0 ? existingFlags.join(', ') : 'none'})\n`;

        // Combine existing and new flags to preserve flags like 'default'
        const allFlags = [...new Set([...existingFlags, ...activeFlags])];
        const dispositionString = allFlags.join('+');
        dispositionArgs.push(`-disposition:${index}`);
        dispositionArgs.push(dispositionString);
    });

    response.infoLog += '\n';

    if (dispositionArgs.length === 0) {
        response.infoLog += '=== Result: No disposition changes needed. ===\n';
        return response;
    }

    response.processFile = true;
    response.preset = `, -fflags +bitexact -flags:v +bitexact -flags:a +bitexact -map 0 -c copy ${dispositionArgs.join(' ')}`;

    // Log summary and the resulting FFmpeg arguments
    response.infoLog += `=== Result: Updating ${dispositionArgs.length / 2} stream(s). ===\n`;
    response.infoLog += `FFmpeg args: -map 0 -c copy ${dispositionArgs.join(' ')}\n`;

    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
