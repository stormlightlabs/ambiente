# Changelog

All notable changes to the Ambiente reboot are documented in this file. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Rebooted the repository around Cargo and pnpm workspaces with `ambiente-core`
  and `ambiente-cli`, shared formatting/linting/testing commands, CI, and pinned
  development toolchains.
- Added the versioned canonical document model, stable IDs and references,
  validation, document operations, metric and absolute time, deterministic
  randomness, and the initial music-theory primitives.
- Added authored `Material`, `Phrase`, `StepPattern`, `PitchSet`, and `Voice`
  models, including non-quantized phrase data and explicit quantization edits.
- Added deterministic span-based event queries, deterministic transformations,
  seeded stochastic operations, independent clocks, and native conformance tests.
- Added the `new`, `check`, `inspect`, and `events` CLI commands with detailed
  document, material, voice, pattern, activity, register, and event-source output.
  Event queries accept exact spans and voice or material filters.
- Added deterministic Standard MIDI File export for note events. The exporter
  converts metric and absolute event times, rejects unsupported named events, and
  refuses to overwrite existing files.
- Added script-safe JSON and plain output, separated diagnostics, meaningful exit
  codes, shell completions, and styling that honors TTY state, `NO_COLOR`,
  `TERM=dumb`, and `--no-color`.
- Added the Vike and Solid web application with prerendered public and
  documentation routes, a prerendered Studio SPA shell, responsive site and
  documentation layouts, and browser smoke tests.
- Added Sätteri Markdown and MDX processing with frontmatter, GFM, heading
  navigation, clean documentation links, Expressive Code, and Solid components
  embedded in prerendered MDX.
- Added the narrow TypeScript application facade and a read-only shell fixture
  that leaves document semantics and event generation in Rust.
- Added the `ambiente-wasm` crate and `@ambiente/wasm` wrapper with generated
  TypeScript bindings for canonical loading, serialization, operations,
  validation, event queries, and document inspection.
- Added shared event fixtures that verify identical normalized output through
  native Rust and WebAssembly runtimes.
- Added the shared `@ambiente/audio` package with a short-horizon Tone.js/Web
  Audio scheduler, complete transport lifecycle, live document refresh, and six
  stable semantic sound presets with gain, pan, filter, and reverb controls.
- Connected Studio playback to a Rust-authored document through the production
  WASM facade and browser audio package.
- Added complete Studio transport and seed controls, including canonical tempo
  edits, seeking, and live position display.
- Added a Dexie-backed local piece library with autosave, create, reopen,
  duplicate, delete, canonical import/export, storage persistence handling, and
  independent IndexedDB migration tests.
- Added voice and material browsing, creation, deletion, association, sound
  selection, and an initial voice inspector with playback controls.
- Added a responsive pointer, touch, and computer-keyboard piano with octave
  navigation, immediate sound preview, canonical phrase recording, phrase
  display, and optional sixteenth-note quantization.
- Added canonical matrix reconfiguration, a playable Matrix editor with cell,
  pitch-row, length, subdivision, and transport-playhead controls, and live audio
  refresh after edits.
- Added focused Phrase, Matrix, piano, voice, and sound guide examples that use
  the production WASM document runtime and browser audio package.
- Added Pagefind indexing, in-page search, and scroll-aware section navigation
  for the prerendered documentation.
- Added first-party Phase and Drone studies as canonical documents and Rust
  builders. Phase uses three exact noncommensurate absolute-time cycles; Drone
  uses long events, rests, restrained seeded changes, and four voices over a
  ten-minute query span.
- Added a semantic `motion` sound control for slow filter and pan modulation in
  the browser audio graphs.
- Added the first-party Pattern study with authored metric cells, rotation,
  reversal, stretching, transposition, deterministic omission, and conditional
  transformation across four voices.
- Added multi-seed ten-minute identity checks for all Three Studies and exposed
  the canonical study builders through the WebAssembly application facade.
- Added an interactive Three Studies guide with in-browser playback, adjacent
  seed variations, and canonical Studio downloads.

### Changed

- Matched the frontend Prettier rules used by related Stormlight Labs projects
  and expanded ESLint coverage for the Vike and Solid application.
- Updated the web shell to use Literata and Instrument Sans variable fonts,
  UnoCSS-backed Bootstrap and Remix icons, the favicon artwork as its header
  mark, dark mode, a fuller site footer, and clearer public and documentation
  copy.
- Revised the published guides for current product behavior and added an
  Instrument Studio guide for playing, recording, voice editing, and local
  saving.
- Moved project architecture documentation into `apps/web/content/docs/` for the
  web application, while keeping the product roadmap at the repository root.
- Sequenced the Vike/Solid web shell and Sätteri documentation pipeline before
  the WASM/browser-audio milestone so the browser boundary is integration-driven.
- Kept `TODO.md` focused on outstanding work; completed implementation history now
  lives here.
- Corrected browser pitch rendering so canonical chromatic pitches are converted
  from MIDI-style semitone values to Tone.js frequencies.
- Changed semantic gain mapping from linear amplitude to a -36 dB to 0 dB curve
  so multi-voice pieces retain mix headroom.
- Added restrained seeded omissions to Phase while retaining one complete phrase
  voice and the three exact noncommensurate clocks.
