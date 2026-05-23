# Gemmary

[![Install userscript](https://img.shields.io/badge/Install-userscript-blue)](https://raw.githubusercontent.com/oooooooo/gemmary/main/gemmary.user.js) ![Chrome only](https://img.shields.io/badge/Chrome-138%2B_only-yellow?logo=googlechrome)

Gemmary (/ˈdʒɛməri/) — a portmanteau of **Gemini Nano** and **summary** — is a
Chrome-only userscript that summarizes any web page on-device using Chrome's
built-in Summarizer API. No API key, no server, no data leaving your machine.

The output language follows your browser's language setting — Japanese for `ja`,
English for everything else. To add more languages, edit the `LANG_*` and
`LABELS` constants near the top of the script.

## Requirements

- Chrome 138+
- [Tampermonkey](https://www.tampermonkey.net/) extension

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Enable the required Chrome flags:
   - `chrome://flags/#summarization-api-for-gemini-nano` → **Enabled**
   - `chrome://flags/#optimization-guide-on-device-model` → **Enabled BootstrapSentinel**
3. Restart Chrome, then go to `chrome://components` and update
   **Optimization Guide On Device Model**.
4. Open the raw script URL and click **Install**:

   ```text
   https://raw.githubusercontent.com/oooooooo/gemmary/main/gemmary.user.js
   ```

## Usage

Click the Gemini icon button in the bottom-right corner of any page. A modal
opens with four summary formats: **Key Points**, **TL;DR**, **Teaser**, and
**Headline**. Press **Esc** or click outside to close.

## License

ISC
