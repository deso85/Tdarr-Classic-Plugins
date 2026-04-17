# Custom Tdarr Classic Plugins I made and use
Here are the custom plugins I've made for Tdarr. These plugins help with streamlining media processing, debugging, and organizing stream data.

Each plugin can be used independently, but they are most effective when combined in the right order. Below is my recommended plugin chain:

1. **Print Stream Infos** — Log stream details for debugging
2. **Change Stream Properties** — Clean up unwanted video/audio metadata and flags
3. **Filter Streams By Language** — Remove audio and subtitle streams not matching a language keep-list
4. **Set Disposition Flags from Stream Titles** — Automatically set disposition flags based on title patterns
5. **Add Compatible Audio Stream** — Add fallback audio streams (e.g. EAC3) for devices without premium codec support
6. **Rename Stream Titles** — Standardize audio and subtitle stream titles
7. **Sort Streams** — Order streams by type, title and language
8. **Ensure Stream Defaults** — Set the default disposition flag for audio and subtitle streams based on language and codec/format priority

> **Why this order?**
> Stream infos are printed first for a before-snapshot. Then video and audio properties are cleaned up.
> Next, unwanted audio and subtitle streams are removed by language so that subsequent plugins only process relevant streams.
> Disposition flags are then set based on titles.
> Compatible fallback audio streams are added next, while the original streams and their flags are still intact — this way the plugin can correctly identify which languages already have a compatible stream and which premium streams to use as a source.
> Titles are renamed afterwards so flag detection in step 4 still works on the original titles, and the new fallback streams also get proper titles.
> Streams are then sorted into a clean order.
> Finally, default streams are selected based on language preference and codec/format priority — running last ensures all streams have their final titles, flags, and order before defaults are assigned.

---

## Tdarr_Classic_Plugin_Chasil_Print_Stream_Infos
This classic plugin prints out information about the different streams. The information can be shown in the report or logfile. I use it primarily for debugging purposes.

### Logged information per stream
- Codec type, name and long name
- Video/Audio codec name (when available)
- Profile
- Language and title
- Codec ID
- Commercial format name (e.g. "Dolby Digital Plus") via MediaInfo
- Channel layout (formatted, e.g. "2.0" instead of "stereo")
- Audio bitrate (kbps) or quality value as fallback

### Example output inside report
![Example output inside report](./img/print_stream_infos_example.png)

---

## Tdarr_Classic_Plugin_Chasil_Change_Stream_Properties

This plugin removes unwanted metadata and flags from video and audio streams,
includin[...]treams without a language tag are kept or removed based on the `keep_undefined_audio` / `keep_undefined_subtitle` settings.
- Video, data, attachment, and chapter streams are always kept regardless of language.
- The plugin compares the current streams against the keep-lists and **skips processing** if no streams need to be removed.
- When processing is needed, streams are remapped using FFmpeg stream copy (no re-encoding). The `bitexact` flags are set to avoid unnecessary metadata changes.
- The output container matches the input container (e.g. `.mkv` stays `.mkv`).

---

## Tdarr_Classic_Plugin_Chasil_Set_Disposition_Flags_From_Stream_Titles
This plugin parses audio and subtitle stream titles and sets matching disposition flags automatically. It detects keywords in both German and English and only re-encodes (stream copy) when flags are actually missing — leaving existing flags untouched.

### Supported Dispositions
| Disposition | Applicable Streams | Default Patterns (case-insensitive) |
|---|---|---|
| **forced** | Subtitle only | `forced`, `erzwungen`, `signs` |
| **comment** | Audio, Subtitle | `comment`, `kommentar` |
| **hearing_impaired** | Subtitle only | `sdh`, `hearing.?impaired`, `hard.?of.?hearing`, `closed.?caption`, `hörgeschädigt`, `schwerhörig`, `\bcc\b` |
| **visual_impaired** | Audio only | `audio.?desc`, `visual.?impaired`, `descriptive`, `audiodeskription`, `hörfilm` |

### Settings
Each disposition has an optional input field for additional comma-separated regex patterns. Leave empty to use the defaults listed above.

- **forcedPatterns**: Additional patterns for the `forced` flag.
- **commentPatterns**: Additional patterns for the `comment` flag.
- **hearingImpairedPatterns**: Additional patterns for the `hearing_impaired` flag.
- **visualImpairedPatterns**: Additional patterns for the `visual_impaired` flag.

### How It Works
1. Scans all audio and subtitle streams for existing titles
2. Matches titles against the configured regex patterns (respecting stream type restrictions)
3. Compares detected dispositions with the currently set flags
4. Sets missing flags without removing any existing ones
5. Only triggers a transcode (stream copy) if at least one flag needs to be added

### Logging
The plugin provides detailed log output visible in the Tdarr file report:
- Active patterns per disposition
- Per-stream breakdown (skipped, no match, already set, or newly added flags)
- The resulting FFmpeg arguments for full transparency

---

## Tdarr_Classic_Plugin_Chasil_Add_Compatible_Audio_Stream

This plugin checks each language's audio streams for device-compatible codecs (AAC, AC3, EAC3) and adds a fallback transcode when only premium codecs (e.g. TrueHD, DTS-HD MA, Atmos) are present.
This is useful for devices that lack licenses for premium audio formats and would otherwise force the server to transcode on the fly.
Original streams are always preserved.

### Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `target_codec` | Dropdown | `eac3` | Target codec for the fallback stream. Options: `aac`, `ac3`, `eac3`. |
| `bitrate_per_channel` | String | `96` | Bitrate in kbps per audio channel. The total bitrate is calculated as `channels × bitrate_per_channel` (e.g. 6 channels × 96 = 576 kbps). |

### How It Works

- **Groups audio streams by language** and classifies each as either compatible (AAC, AC3, EAC3) or premium (everything else, e.g. TrueHD, DTS-HD MA, FLAC, Opus).
- **Skips streams** with commentary or visual impairment disposition flags — these are not considered for fallback generation.
- For each language that has only premium streams, the plugin selects the best source (highest channel count) and transcodes it to the configured target codec.
- **Channel count is preserved** where possible — capped at the codec's maximum (AAC: 8ch, AC3: 6ch, EAC3: 8ch). If the source exceeds the codec limit, it is downmixed accordingly.
- The new stream inherits the source stream's language and disposition flags (except `default`), and receives a descriptive title (e.g. `EAC3_5.1_fallback`).
- All existing streams are kept untouched via stream copy.

### Behavior

- The plugin checks whether the file is a video; non-video files are skipped.
- Languages where a compatible stream already exists are skipped entirely.
- Languages with no audio streams at all (neither compatible nor premium) are skipped.
- The plugin **skips processing** if all languages already have at least one compatible stream.
- When processing is needed, existing streams are copied and new fallback streams are appended using FFmpeg. Only the new streams are transcoded.
- The output container matches the input container (e.g. `.mkv` stays `.mkv`).

### Logging

The plugin provides detailed log output visible in the Tdarr file report:

- Per-language breakdown showing which compatible or premium streams were found
- Which streams are selected as transcode source and what the target format will be
- Downmix notes when the source channel count exceeds the codec maximum

---

## Tdarr_Classic_Plugin_Chasil_Rename_Stream_Titles

This plugin renames audio and subtitle stream titles based on their language, codec, and optionally channel layout and bitrate information. It ensures consistent and readable stream names across your media library.

### Example

![Rename Stream Titles Example](img/Tdarr_Classic_Plugin_Chasil_Rename_Stream_Titles_Example.png)

### Naming Format
`Language (Addition) | Codec ChannelLayout (Bitrate)`

Parts in the format are only included when applicable/enabled. Examples:

| Stream Type | Example Title |
|---|---|
| Audio (all options enabled) | `English \| AC3 5.1 (448 kbps)` |
| Audio (no channels/bitrate) | `English \| AAC` |
| Audio (VBR codec) | `English \| Opus 5.1` |
| Audio (with addition) | `English (Commentary) \| AAC 2.0 (192 kbps)` |
| Subtitle | `English \| SRT` |
| Subtitle (with addition) | `German (Forced) \| SRT` |

### Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `rename_audio_streams` | Boolean | `true` | Enable or disable renaming of audio streams. |
| `rename_subtitle_streams` | Boolean | `true` | Enable or disable renaming of subtitle streams. |
| `use_audio_channels` | Boolean | `true` | Append channel layout info (e.g. `2.0`, `5.1`, `7.1`) to audio stream titles. |
| `use_audio_bitrate` | Boolean | `true` | Append bitrate info (e.g. `448 kbps`) to audio stream titles. Not shown for VBR codecs (e.g. Opus, Vorbis). |
| `rename_language` | Dropdown | `english` | Language used for stream titles and additions. Options: `english`, `german`. |

### Supported Audio Codecs

AAC, AC3, DTS (incl. DTS-HD MA, DTS-HD HRA, DTS:X), E-AC3 (incl. Atmos), FLAC, MP3, Opus, PCM, TrueHD (incl. Atmos), Vorbis

### Supported Subtitle Codecs

ASS, HDMV PGS, SRT (SubRip), SSA, VobSub (DVD)

### Supported Languages

The plugin recognizes over 40 languages via ISO 639-1 (2-letter) and ISO 639-2/B & T (3-letter) codes, including but not limited to:

Arabic, Basque, Bengali, Bulgarian, Catalan, Chinese, Croatian, Czech, Danish, Dutch, English, Estonian, Filipino/Tagalog, Finnish, French, Galician, German, Greek, Hebrew, Hindi, Hungarian, Icelandic, Indonesian, Italian, Japanese, Korean, Latvian, Lithuanian, Malay, Norwegian, Persian, Polish, Portuguese, Romanian, Russian, Serbian, Slovak, Slovenian, Spanish, Swedish, Tamil, Thai, Turkish, Ukrainian, Vietnamese

### Detected Additions

The plugin parses existing stream titles and detects the following keywords (in English and German) to preserve them as additions in parentheses:

| English | German |
|---|---|
| Commentary | Kommentar |
| Forced | Erzwungen |
| SDH | SDH |
| Hearing Impaired | Hörgeschädigt |

### Behavior

- The plugin compares the current title with the expected title and **skips streams** that are already correctly named.
- Only triggers a transcode (stream copy, no re-encoding) when at least one title needs to be changed.
- VBR codecs (Opus, Vorbis) and streams with VBR-related tags will not display bitrate, even if `use_audio_bitrate` is enabled.

---

## Tdarr_Classic_Plugin_Chasil_Sort_Streams
This plugin sorts streams in a media file by type (video, audio, subtitle, chapter)
and a secondary criteria. The plugin helps to ensure a consistent and logical stream
order, improving accessibility and compatibility.

### Sorting Details
- **Video Streams**: Sorted by language (streams without a language tag are placed last).
- **Audio Streams**: Sorted by title (normalized — parentheses are removed,
  comparison is case-insensitive). Streams without a title are placed first.
- **Subtitle Streams**: Sorted by title (same normalization as audio).
- **Chapter Streams**: Not sorted individually, but appended after the other
  stream types.

### Behavior
- The plugin compares the current stream order with the desired order and
  **skips processing** if the file is already sorted correctly.
- When processing is needed, streams are remapped using FFmpeg stream copy
  (no re-encoding).
- The `bitexact` flags are set to avoid unnecessary metadata changes.

### Usage
This plugin requires no configuration. Simply add it to your library or flow
to ensure streams are ordered logically.

---

## Tdarr_Classic_Plugin_Chasil_Ensure_Stream_Defaults

This plugin ensures that exactly one video and one audio stream are set as default, and at most one subtitle stream. It selects the best candidates based on configurable language preferences, audio codec priority, subtitle format priority, and forced subtitle logic.

### Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `preferred_audio_language` | String | `ger` | Preferred language for the default audio stream (ISO 639-2/B or 639-1 code). |
| `fallback_audio_language` | String | `eng` | Fallback language if the preferred audio language is not found. |
| `preferred_subtitle_language` | String | `ger` | Preferred language for the default subtitle stream. |
| `audio_codec_priority` | String | `truehd,dts,flac,eac3,ac3,aac,opus,mp3` | Comma-separated codec priority list for audio stream selection. Higher priority codecs are preferred when multiple streams match the same language. |
| `subtitle_format_priority` | String | `srt,ass,hdmv,vobsub` | Comma-separated format priority list for subtitle stream selection. |
| `forced_sub_as_default_for_matching_audio` | Boolean | `true` | When enabled, if the selected default audio stream matches the preferred subtitle language, a forced subtitle in that language is preferred as default (if available). |

### How It Works

1. **Video**: Ensures exactly one video stream has the `default` flag. If none or multiple are set, the first video stream is selected.
2. **Audio**: Selects the best audio stream based on language preference (preferred → fallback → any), then codec priority. Streams with `comment` or `visual_impaired` disposition are excluded from selection.
3. **Subtitle**: Selects the best subtitle stream based on language preference and format priority. Streams with `comment` or `hearing_impaired` disposition are excluded. When `forced_sub_as_default_for_matching_audio` is enabled and the default audio language matches the preferred subtitle language, a forced subtitle in that language is preferred.
4. Only modifies disposition flags — no re-encoding. Uses FFmpeg stream copy with `bitexact` flags.
5. **Skips processing** if all default flags are already set correctly.

### Logging

The plugin provides detailed log output visible in the Tdarr file report:

- Current settings overview
- Stream overview with language, codec, and current disposition flags
- Audio and subtitle candidate evaluation with scoring details
- Clear indication of which streams are selected as default and why
- The resulting FFmpeg arguments for full transparency

---

## Installation Guide

To install and use any of these Tdarr plugins, follow these steps:

1. **Download the Plugin**
   Clone the repository or download the specific branch for the plugin you want to use:

   ```
   git clone -b <plugin-branch-name> https://github.com/deso85/Tdarr-Classic-Plugins.git
   ```

2. **Add the Plugin to Tdarr**
   Copy the plugin file from the cloned repository to your Tdarr plugin folder, which is usually located at:
   ```
   /path/to/tdarr/server/Tdarr/Plugins/Local
   ```

3. **Check if the plugin is available in Tdarr**
   - Open Tdarr
   - Navigate to the **Classic Plugins** section to check if the plugin has been recognized

4. **Usage**
   - Go to the **Libraries** section
   - Edit an existing library or create a new one
   - Go to **Transcoder Options** and add the Plugin via drag and drop from the plugins list on the right
   - Configure the plugin if possible by clicking on it

   You can alternatively add the plugin inside a Flow using the 'Run Classic Transcode/Filter Plugin' flow plugin.

   Tdarr will apply it during the transcoding or media processing tasks associated with that Library/Flow.