# Ambiente roadmap

> Status: reboot with a replacement architecture  
> Primary platforms: web, macOS desktop, and CLI  
> Core stack: Rust, WebAssembly, Solid, Vike, Tauri, Web Audio, and Tone.js

Ambiente is a system for composing, performing, exploring, and listening to
generative music. It sits between a conventional composition tool, a live
instrument, and a listener-facing generative player.

The intended position is:

> High composer control, deeply generative behavior, and approachable direct
> manipulation.

A musician should be able to play a phrase on a piano, draw notes into a matrix,
transform that material into a generative system, perform it live, capture a
realization, and later open the same piece in Listen mode.

The [composition model](composition-model.md), [architecture](architecture.md),
[document format](document-format.md), and [audio design](audio.md) own the
rationale and system details behind this sequence. `TODO.md` tracks
implementation work.

## Product direction

Ambiente treats a composition as authored material transformed into a stream of
repeatable events. It is not primarily a DAW, MIDI generator, chord-progression
generator, or collection of theory utilities.

The main influences are:

- Brian Eno's process-oriented and generative composition;
- SuperCollider's separation of patterns, generalized events, and sound
  synthesis;
- TidalCycles and Strudel's composable temporal patterns;
- Sonic Pi's accessible live coding and reproducible randomness;
- Bloom and other instruments where composition, instrument, and visual artwork
  overlap;
- Wotja's generative and adaptive composition breadth;
- Generative.fm's human-authored browser generators;
- Brain.fm's low-friction, purpose-oriented playback product;
- Endel's separation of designed sound systems from contextual adaptation;
- ambient, drone, experimental music, and algorithmic visual art.

These are references, not products or APIs to reproduce. Ambiente does not claim
to implement proprietary neurological techniques from listener products.

Three views operate on the same document:

- **Listen** hides implementation detail and exposes only controls published by
  the composer.
- **Create** provides piano, matrix, phrase, voice, process, sound, and system
  editors.
- **Perform** provides scenes, macros, mappings, seed changes, live replacement,
  capture, and focused visualization.

## Sequence

Each milestone proves a dependency needed by the next. The Three Studies form a
hard quality gate: broad product work stops if the engine cannot yet produce
music worth hearing.

### M0 — Reboot foundation

Establish project boundaries before product features.

Deliver:

- Rust and pnpm workspaces;
- architecture, composition, audio, roadmap, and glossary documentation;
- CI plus formatting, linting, and test commands;
- documented toolchain versions;
- a minimal versioned `Document`;
- documented contracts for IDs, serialization, migration, time, deterministic
  randomness, and diagnostics.

Exit when a minimal document can be created, serialized, loaded, migrated,
validated, and round-tripped without information loss. CI must test the round
trip.

### M1 — Musical document and time

Build the smallest useful musical model.

Deliver:

- `Document`, `Piece`, metadata, stable references, and document operations;
- `Voice`, `Material`, `Phrase`, and `StepPattern`;
- metric and absolute time, tempo, event spans, and independent clocks;
- the pitch, interval, pitch set, scale, register, and transposition primitives
  needed by the first workflows.

Exit when a Rust fixture can contain a phrase and step pattern, inspect them
deterministically, edit them through operations, and survive save/load. No
browser or audio code is required.

### M2 — Pattern and event engine

Turn material into deterministic events that can be queried by time span.

Start with sequence, stack, repeat, shift, stretch, rotate, reverse, and
transpose. Add deterministic choose, weighted choice, omit, and sometimes with a
hierarchical seed scheme.

Deliver `TimeSpan`, generalized `Event`, pattern composition, query boundary
rules, and native determinism tests. Adjacent and overlapping queries must agree
where the semantics require it. Metric and absolute-time patterns must coexist.

Exit when a phrase and step pattern can each produce events through composed
transformations, and a small generative piece can live entirely in Rust tests.

### M3 — CLI and observability

Make the engine inspectable before adding GUI complexity.

Deliver:

```text
ambiente new
ambiente check
ambiente inspect
ambiente events
ambiente export --midi
```

Use `clap` for command parsing and help, and `owo-colors` for terminal styling.
Provide concise human output plus JSON or plain output where useful. Keep primary
output on `stdout`, diagnostics on `stderr`, prompts optional, exit codes
meaningful, and styling TTY-aware.

Exit when a developer can explain and debug a fixture from the terminal, and the
same commands work in scripts without prompts or mixed streams.

### M4 — WASM and browser audio

Produce reliable real-time browser sound from Rust events.

Deliver:

- `ambiente-wasm` and generated TypeScript declarations;
- a narrow TypeScript facade;
- shared native/WASM event fixtures;
- a look-ahead scheduler over Tone.js and Web Audio;
- transport and audio lifecycle handling;
- a small palette for felt piano, glass, drone, pluck, air, and percussion.

Exit when a browser can load a Rust-authored document and play continuously with
no pattern generation duplicated in TypeScript. Native and WASM fixtures must
produce identical events.

### M5 — Instrument Studio

Make Ambiente playable without requiring code.

Deliver:

- a Vike and Solid site with prerendered public routes and a Studio SPA;
- transport, seed control, and browser project persistence;
- material and voice browsing, sound selection, and an inspector;
- a pointer, touch, and keyboard piano with phrase recording;
- a Tone-Matrix-inspired editor over canonical `StepPattern` data;
- Matrix, Phrase, and basic System views.

Exit when a new user can choose a sound, play and record a phrase, create a
matrix pattern, play both, save the project, reopen it, and hear the same system.

### M6 — Three Studies

Prove musical value before broadening the product.

Create three first-party pieces:

- **Phase** uses independent noncommensurate clocks and slow phase relationships.
- **Drone** uses long events, restrained pitch sets, slow modulation, texture,
  and silence.
- **Pattern** uses metric material, transformations, deterministic probability,
  and live mutation.

Each study should usually use no more than five voices, develop from a small
amount of authored structure for 5–10 minutes or longer where suitable, vary
meaningfully by seed, and retain its identity across seeds.

Exit when the team would listen to the pieces outside development and each study
shows a different strength. If this fails, improve sounds, primitives, defaults,
constraints, and composition workflow instead of adding features.

### M7 — Listen

Make completed pieces useful as listener-facing music.

Deliver a dedicated Listen view, first-party piece browser, endless playback,
seed exploration, session controls, process artwork, composer-defined macros,
and optional intent presets such as Focus, Create, or Rest. Presets are authored
macro and scene values, not global neuroscience claims.

Exit when one study works credibly as an extended soundtrack for work, reading,
creative activity, or rest.

### M8 — Generative Create

Expose process composition graphically.

Deliver transformation chains, independent-cycle visualization, seed browsing,
macros, scenes, continuous signals, and only the additional pattern primitives
that real pieces require. Keep the graphical model focused on musical
relationships rather than an unconstrained node graph.

Exit when a user can turn a recorded phrase or step pattern into a nontrivial,
evolving piece without code.

### M9 — Code and Perform

Add a textual frontend after Rust semantics are stable.

Deliver a concise language, parser, formatter, diagnostics, editor, hot
replacement, running-clock preservation, scenes, macro and seed controls,
keyboard and MIDI mappings, and a reduced performance UI. Invalid replacement
source must leave the previous valid pattern running.

Exit when a performer can alter an active piece without stopping playback or
writing JavaScript or Rust.

### M10 — Capture and production

Preserve and render emergent performances.

Deliver named captures, seed and state snapshots, scene and macro state,
captured ranges, relevant performance operations, deterministic replay, improved
MIDI export, WAV and justified FLAC export, and stems where the architecture
permits.

Exit when a musician can mark an interesting realization, reopen the project,
and recreate or render it.

### M11 — Public web product

Ship the web experience as one static distribution.

Deliver the landing site, prerendered documentation and learning routes,
interactive examples, Studio and Listen shells, first-party pieces, and a
sharing/export strategy. Documentation will cover phrases, matrix composition,
piano recording, voices, patterns, probability, seeds, independent clocks,
phasing, signals, scenes, macros, sound, CLI use, and live coding.

Examples must share the production WASM and audio runtime. Exit when a new user
can understand Ambiente, run examples, and create a small piece without a
production application server.

### M12 — Desktop

Wrap the shared Studio in Tauri 2.

Deliver native projects, open/save, recent files, drag and drop, file dialogs,
native MIDI, OSC, audio settings, export integration, and macOS packaging.
Platform-specific capabilities remain behind adapters.

Exit when one document moves between browser and desktop without conversion or
semantic differences, and both use the same Studio UI.

### M13 — MCP

Expose semantic musical operations to agents.

Deliver inspection, stable object references, document operations, variation,
event queries, validation, and project loading/saving through an MCP server that
reuses `ambiente-core`.

Exit when an agent can make meaningful musical edits without generating source
for a scheduler or audio engine.

### M14 — Native audio, only if justified

Investigate native DSP, offline rendering, plugins, or a native real-time engine
only after browser and desktop use identifies a concrete latency, rendering,
device, or production limitation.

Do not build a second sound engine solely because the Rust ecosystem makes it
interesting.

## First implementation slice

The first vertical slice establishes the central architectural property:

```text
Document
  ↓
StepPattern
  ↓
pattern query
  ↓
Events
  ↓
WASM
  ↓
Tone.js
  ↓
Matrix UI
  ↓
sound
```

Implement one document, piece, voice, and step pattern; represent pitch and
time; query note events; compile the core to WASM; schedule through Tone.js;
edit the step pattern in Solid; and prove deterministic save/load. Repeat with a
piano recording into a `Phrase` before adding broad transformations.

## Non-goals for the reboot

Do not initially build:

- a DAW timeline or multitrack waveform editor;
- VST/AU hosting or a large modular synthesizer;
- hundreds of pattern operators;
- prompt-to-song or automatic song, chord, melody, bass, or drum generation;
- notation engraving;
- accounts, collaboration, or a required server backend;
- native DSP solely to avoid Tone.js;
- MCP before the composition model works;
- a bespoke language before Rust semantics work.

## Success measures

Ambiente succeeds when musicians can author recognizable material, develop it
through restrained generative processes, and recover useful realizations. The
default sounds must support credible music. Piano and matrix editors must offer
an immediate entry point, while the same material can grow into deeper Create,
Listen, and Perform workflows.

The document and event semantics must remain portable across native Rust, WASM,
browser, desktop, CLI, and later MCP. The engine stays small enough that musical
choices matter more than framework machinery.

## References

- [SuperCollider, _A Practical Guide to Patterns_](https://doc.sccode.org/Tutorials/A-Practical-Guide/PG_01_Introduction.html)
- [Strudel technical manual, _Patterns_](https://strudel.cc/technical-manual/patterns/)
- [Sonic Pi tutorial](https://sonic-pi.net/tutorial.html)
- [Wotja user guide](https://wotja.com/help/)
- [Generative.fm](https://generative.fm/)
- [Brain.fm](https://www.brain.fm/)
- [Endel, _The science behind Endel_](https://endel.io/science)
- [Tone.js](https://tonejs.github.io/)
- [`wasm-bindgen` Guide](https://wasm-bindgen.github.io/wasm-bindgen/)
- [Vike, _Pre-rendering (SSG)_](https://vike.dev/pre-rendering)
- [Tauri 2, _Frontend Configuration_](https://v2.tauri.app/start/frontend/)
- [Command Line Interface Guidelines](https://clig.dev/)
