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

### Changed

- Updated the web shell to use Literata and Instrument Sans variable fonts,
  UnoCSS-backed Bootstrap and Remix icons, and clearer public and placeholder
  copy.
- Moved project architecture documentation into `apps/web/content/docs/` for the
  web application, while keeping the product roadmap at the repository root.
- Sequenced the Vike/Solid web shell and Sätteri documentation pipeline before
  the WASM/browser-audio milestone so the browser boundary is integration-driven.
- Kept `TODO.md` focused on outstanding work; completed implementation history now
  lives here.
