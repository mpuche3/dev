# dev

This repository contains a small web UI and client-side code for "EnglishIPA" — a simple reader that displays lines from a collection of books (text and phonetic transcription), offers basic navigation (book / chapter / sentence), and can speak lines using either pre-generated MP3 audio or the browser Speech Synthesis API.

The main client script is `scripts/script03.js`. Below is a thorough explanation of what it does, how it is structured, what browser APIs it uses, how to run it locally, known edge-cases, and suggestions for improvement.

## Overview of `scripts/script03.js`

- Purpose: render a minimal single-page UI for browsing a curated set of books, chapters and sentences; load text/transcription/remote audio; and provide playback via either precomputed MP3s (fetched as base64 data URIs) or the browser's SpeechSynthesis voices.
- Execution model: all logic is client-side JavaScript meant to run in a modern browser. It builds DOM elements imperatively (no frameworks), wires event listeners, and lazily loads book data from relative paths under `../../text` and `../../transcriptions`.

## Key components and responsibilities

- PermanentDictionary: a small wrapper around IndexedDB for persistent key/value storage. It:
	- opens/creates an IndexedDB database and object store named after the provided `storeName`.
	- exposes async methods: `set`, `get`, `delete`, `clear`, `has`, `keys`, `values`, `entries`.
	- converts IDB requests to Promises for easier async/await usage.

- DOM helpers and CSS: the script creates a lightweight `el()` helper to build elements and apply attributes. It injects a `<style>` element with the app's styles and builds the entire UI structure in JS: top controls, book/chapter rows, the reading area, and lists used for choosing books/chapters.

- STATE: a central object that holds the current BXXX/CXXX/SXXX identifiers (book/chapter/sentence), playback settings and flags (phonetic vs text mode, repeat, soft/hard mute), that:
	- stores voice mappings and provides methods that query `speechSynthesis.getVoices()`.
	- provides getter/setter properties with side effects: toggling phonetic mode refreshes UI text, changing mute flags updates icons and playback, etc.

- Data loading helpers: functions to read the repository's text/transcription files:
	- `get_books(TEXTS|TRANS)` loads `.../books/BXXX/BXXX_${TEXTS|TRANS}_ALL.txt` files and produces an object keyed by BXXX/CXXX/SXXX.
	- `get_obj_tracks()` merges TEXTS and TRANS results into a single `obj_tracks` structure containing text, tran (transcription) and an audio path.
	- `get_text(url)` uses a synchronous XHR with caching via a `PermanentDictionary` instance keyed by URL (so repeated requests are fast and persistent).

- Playback and audio caching:
	- `Fetcher` class fetches remote MP3s (as ArrayBuffer -> base64 data URI) and uses a `PermanentDictionary` to cache audio strings in IndexedDB.
	- `PlayString` wraps an HTMLAudioElement and exposes `playAudio()` which returns a Promise that resolves when playback ends (or is paused). It also supports volume and playback rate controls.
	- `play()`: orchestrates playback. If `STATE.voice === 'echo'`, it attempts to fetch precomputed audio (via `fetcher.getAudioString`) and use the `player` to play it; otherwise it creates a `SpeechSynthesisUtterance` and speaks the text via browser TTS.

- Navigation helpers: `book_up`, `book_down`, `chapter_up`, `chapter_down`, `sentence_up`, `sentence_down`, and `next_track` implement linear navigation across the `obj_tracks` structure.

- UI interactions: many DOM event listeners (clicks, keydown, fullscreenchange, resize, touch events) update UI state and call navigation / playback functions. The `#book` and `#chapter` buttons open inline selection lists built on demand.

## Important implementation details and design notes

- File layout and paths: the script expects relative files in the structure `../../text/books/BXXX/...` and `../../transcriptions/books/BXXX/...` and has fallback audio host URLs under `https://englishipa.site/audio/...`.
- Synchronous XHR: `get_text()` uses a synchronous XHR (`xhr.open('GET', url, false)`) which blocks the main thread. This simplifies sequencing but can cause jank; an async fetch() is recommended for responsiveness.
- IndexedDB usage: `PermanentDictionary` ensures the object store exists by opening/upgrading the DB as needed. Values (text and base64 audio strings) are cached persistently.
- Voice handling: `STATE` maps friendly voice names to full `SpeechSynthesisVoice` names (for Chrome/Edge). It inspects `speechSynthesis.getVoices()` and picks the first matching available one.
- Error handling: many functions log errors and return undefined on failure. For a robust user experience, surfaced UI messages would be better than console logs.

## How to run locally

1. Serve the repository directory with a static file server (required because the script fetches relative files and uses XHR/fetch). Example using Python 3 from the repo root:

```bash
python3 -m http.server 8000
```

2. Open http://localhost:8000/index.html in a modern browser (Chrome, Edge, Firefox). Some features depend on secure context (HTTPS) or specific browser support (SpeechSynthesis voice names); `speechSynthesis` may behave differently across browsers.

3. The script expects data under `../../text` and `../../transcriptions` relative to `index.html`. If those folders are missing, the UI will still render and fall back to console logs when files are not found.

## Browser APIs used

- IndexedDB (via `indexedDB.open`) for persistent caching.
- XMLHttpRequest (synchronous HEAD and GET) for file existence checks and text loading.
- fetch() and ArrayBuffer -> base64 conversion for fetching remote audio.
- SpeechSynthesis API for TTS playback.
- HTMLAudioElement for playing precomputed MP3 audio.
- Fullscreen API, DOM events, and touch events for interactions.

## Edge cases and known limitations

- Synchronous XHR will block the UI and may be blocked by browser policies; use `fetch()` with async/await instead.
- The script assumes a fixed file layout and many hard-coded paths. Missing files result in console errors but no graceful UI fallback.
- The `PermanentDictionary` uses the storeName as both DB and store name. If you need multiple stores in one DB, refactor to accept a DB name + store name separately.
- `getBooks` enumerates a fixed list of B001..B022; adding more books requires editing the list.
- The `enumerate` generator is implemented incorrectly (uses `yield[index, item]` instead of `yield [index, item]`) but the generator isn't used; if used it would not behave as expected.
- `fetcher.getAudioString` references `app.fetcher` and `app.state` in a fallback path — these names may not be defined in the global scope of this script and could cause runtime errors in fallback cases.

## Suggestions for improvement

- Convert synchronous XHRs to async fetch() and await, with timeouts and retry logic.
- Add visible UI error/warning messages (instead of console.log) when data or audio is missing.
- Improve IndexedDB scheme: use a single DB name and multiple stores (text, audio, metadata) with versioned migrations.
- Replace manual DOM construction with template HTML or a small rendering helper to improve readability.
- Add unit or integration tests for parsing `BXXX...` files and for the PermanentDictionary wrapper.
- Fix small bugs: correct the `enumerate` generator, remove or fix references to undefined globals in `Fetcher` fallback, and ensure `getBookText` returns data.

## Files of interest

- `index.html` — root page that includes `scripts/script03.js` and mounts the UI.
- `scripts/script03.js` — the script explained here.

## Example usage

- Open the page in a browser with the right files available. Click the book title to open the book list, click a chapter to open chapter list, then click the text area to play the current sentence's audio. Toggle phonetic/text mode with the top-left button, toggle repeat and sound with the respective icons, and change voices with the voice button when SpeechSynthesis voices are available.

---

If you want, I can also:
- convert synchronous XHRs to async fetch calls and update the code accordingly,
- add a small JSON manifest generator for `obj_tracks` so the app can load a single metadata file instead of many synchronous loads,
- or add a small test for `PermanentDictionary` to verify caching works in your environment.

Which of those would you like me to do next?
