# Ambiente roadmap

> Status: reboot with a replacement architecture  
> Primary platforms: web, macOS desktop, and CLI  
> Core stack: Rust, WebAssembly, Solid, Vike, Sätteri, Tauri, Web Audio, and Tone.js

Ambiente is a system for composing, performing, exploring, and listening to
generative music. It sits between a conventional composition tool, a live
instrument, and a listener-facing generative player.

The intended position is:

> High composer control, deeply generative behavior, and approachable direct
> manipulation.

A musician should be able to play a phrase on a piano, draw notes into a matrix,
transform that material into a generative system, perform it live, capture a
realization, and later open the same piece in Listen mode.

The [composition model](apps/web/content/docs/composition-model.md),
[architecture](apps/web/content/docs/architecture.md),
[document format](apps/web/content/docs/document-format.md), and
[audio design](apps/web/content/docs/audio.md) own the
rationale and system details behind this sequence. The repository-root `TODO.md`
tracks outstanding implementation work; `CHANGELOG.md` summarizes completed work.

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

The user-facing authored artifact is a `Piece`. `Document` remains the versioned
serialization and migration envelope around a piece; persistence implementations
store canonical documents without becoming a second musical model.

Five connected surfaces operate on the same piece:

- **Listen** hides implementation detail and exposes only controls published by
  the composer.
- **Create** provides piano, matrix, phrase, voice, process, sound, and system
  editors.
- **Perform** provides scenes, macros, mappings, seed changes, live replacement,
  capture, and focused visualization.
- **Learn** teaches sound, process, ambient-music history, and theory by letting
  readers manipulate production pieces and primitives.
- **Inspect** explains the material, processes, events, and scheduler state behind
  what the user hears without becoming a second editing model.

The product expands by musical role and demonstrated workflow. Sounds remain
stable semantic references rather than serialized Tone.js graphs. Browser audio
maps those references and normalized controls to curated implementations. Assets
use stable project or content references rather than browser URLs or native file
handles. MIDI, notation, visualization, and analysis remain adapters or read-only
projections over canonical Rust state.

New process, theory, sound, and material abstractions must first serve a named
piece, lesson, performance, listening, or interoperability workflow. Ambiente
will not accumulate speculative algorithms, effect graphs, genre vectors, or a
persisted DAW `Track` hierarchy.

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

### M4 — Web shell and documentation

Build the actual browser product container before defining the WASM package.

Deliver:

- the Vike + `vike-solid` application under `apps/web`;
- prerendered landing, documentation, learning, and example routes;
- `/studio/**` as a prerendered SPA shell;
- the canonical documentation source under `apps/web/content/docs/`;
- Markdown and MDX processing through Sätteri and `vite-plugin-satteri`;
- Solid-capable MDX (`jsxImportSource: "solid-js/h"`), GFM/frontmatter, and
  Expressive Code integration;
- site/documentation layout, navigation, typography, and browser smoke tests;
- a narrow TypeScript application/document facade that can initially run against
  fixtures without reimplementing musical semantics.

Astro 7 uses Sätteri as its default Markdown processor. Ambiente uses the same
processor family directly in Vite rather than adopting Astro or maintaining a
second documentation application.

Exit when the current project documentation prerenders from the web app, the
Studio shell builds without WASM, and the frontend has a concrete boundary ready
for the Rust implementation. No TypeScript code may become authoritative for
composition, theory, or pattern generation.

### M5 — WASM and browser audio

Produce reliable real-time browser sound from Rust events inside the existing web
shell.

Deliver:

- `ambiente-wasm` and generated TypeScript declarations;
- an implementation of the M4 TypeScript facade over the WASM bindings;
- shared native/WASM event fixtures;
- the shared browser audio package under `packages/audio`;
- a look-ahead scheduler over Tone.js and Web Audio;
- transport and audio lifecycle handling;
- a small palette for felt piano, glass, drone, pluck, air, and percussion.

Exit when `/studio` can load a Rust-authored document through the facade and play
continuously with no pattern generation duplicated in TypeScript. Native and
WASM fixtures must produce identical events.

### M6 — Instrument Studio

Make Ambiente playable without requiring code.

Deliver:

- transport and seed control;
- browser piece persistence through `PieceStorage`, backed by Dexie/IndexedDB;
- a local piece library with canonical import/export and persistent-storage
  handling;
- material and voice browsing, sound selection, and an inspector;
- a pointer, touch, and keyboard piano with phrase recording;
- a Tone-Matrix-inspired editor over canonical `StepPattern` data;
- Matrix, Phrase, and basic System views;
- documentation examples that use the same production WASM/audio runtime.

Exit when a new user can choose a sound, play and record a phrase, create a
matrix pattern, play both, save the piece, reopen it, and hear the same system.

### M7 — Three Studies

Prove musical value before broadening the product.

Create three first-party pieces:

- **Phase** uses independent noncommensurate clocks and slow phase relationships.
- **Drone** uses long events, restrained pitch sets, slow modulation, texture,
  and silence.
- **Pattern** uses metric material, transformations, deterministic probability,
  and live mutation.

Each study should usually use no more than five voices, develop from a small
amount of authored structure for 5–10 minutes or longer where suitable, vary
meaningfully by seed, and retain its identity across seeds. Once stable, use the
studies as the basis for focused learning material rather than maintaining
separate demo compositions.

Exit when the team would listen to the pieces outside development and each study
shows a different strength. If this fails, improve sounds, primitives, defaults,
constraints, and composition workflow instead of adding features.

### M8 — Listen

Make completed pieces useful as listener-facing music.

Deliver a dedicated Listen view, first-party piece browser, endless playback,
seed exploration, session controls, event-driven process artwork,
composer-defined macros, and optional intent presets such as Focus, Create, or
Rest. Presets are authored macro and scene values, not global neuroscience
claims.

Improve the semantic sound families as the Studies require: soft piano,
resonant mallets, drones, plucks, pads, air/noise textures, restrained percussion,
and later sample-backed granular or vocal-like textures. Reusable controls may
cover envelope, brightness, motion, space, delay, width, warmth, and
sample-specific grain or formant behavior. Complex effect chains stay inside
curated sound implementations unless several pieces need the same semantic
control.

The Studies become the first interactive learning pieces: Phase teaches
independent clocks and repetition, Drone teaches sustained sound and silence,
and Pattern teaches transformation, probability, pulse, and mutation.

Exit when one study works credibly as an extended soundtrack for work, reading,
creative activity, or rest.

### M9 — Generative Create

Expose process composition graphically.

Deliver transformation chains, independent-cycle visualization, seed A/B
comparison, macros, scenes, continuous signals, deterministic humanize and
swing, and only the additional pattern primitives that real pieces require. Keep
the graphical model focused on musical relationships rather than an
unconstrained node graph.

Scenes establish declared voice, material, process, and macro state. Transitions
may be immediate, quantized, or morphed over metric or absolute time. Continuous
parameters interpolate only where semantics are defined; discrete values switch
at a declared boundary.

Add **Materialize** or **Freeze to phrase** as an atomic document operation:
query a source over a span and seed, preserve note onset, duration, pitch, and
velocity, and create editable authored material with lightweight provenance.
Capture preserves performance state; materialization creates source material.

Read-only analysis may report pitch sets, range, intervals, density, overlap,
likely scales or modes, and event provenance. It must report ambiguity and never
silently rewrite a piece. Operation history covers canonical document mutations,
not transport, audio readiness, or transient UI state.

Exit when a user can turn a recorded phrase or step pattern into a nontrivial,
evolving piece without code.

### M10 — Code and Perform

Add a textual frontend after Rust semantics are stable.

Deliver a concise language, parser, formatter, diagnostics, editor, hot
replacement, running-clock preservation, scenes, macro and seed controls,
keyboard and MIDI mappings, and a reduced performance UI. Invalid replacement
source must leave the previous valid pattern running.

Exit when a performer can alter an active piece without stopping playback or
writing JavaScript or Rust.

### M11 — Capture and production

Preserve and render emergent performances.

Deliver named captures, seed and state snapshots, scene and macro state,
captured ranges, relevant performance operations, deterministic replay, improved
MIDI export, WAV and justified FLAC export, stems where the architecture permits,
and deterministic SVG or PNG process artwork.

Add constant-tempo Standard MIDI File import through `midly`, mapping logical
tracks and channels to voices without adding a canonical `Track`. Preserve
performed timing and velocity; diagnose unsupported tempo maps, controllers, and
events rather than silently dropping them. Web MIDI remains progressive
enhancement for performance, recording, mappings, and external synth output.

When a first-party piece establishes the need, add stable `AssetRef` and
`AssetStore` capabilities plus small sample-backed material and source-event
semantics. Canonical documents store asset references and musical intent, while
browser and desktop adapters own blobs and files.

Exit when a musician can mark an interesting realization, reopen the piece,
and recreate or render it.

### M12 — Desktop

Wrap the shared Studio in Tauri 2.

Deliver native piece files through `DesktopPieceStorage`, open/save/Save As,
recent pieces, atomic filesystem writes, drag and drop, file dialogs, native MIDI,
OSC, audio settings, export integration, and macOS packaging. Keep small app
metadata such as recents and preferences outside canonical piece files.
Platform-specific capabilities remain behind adapters.

Exit when the same piece moves between browser and desktop as the same canonical
`Document`, without conversion or semantic differences, and both use the same
Studio UI.

### M13 — MCP

Expose semantic musical operations to agents.

Deliver inspection, stable object references, document operations, variation,
event queries, validation, and piece loading/saving through an MCP server that
reuses `ambiente-core`.

Exit when an agent can make meaningful musical edits without generating source
for a scheduler or audio engine.

### M14 — Native audio, only if justified

Investigate native DSP, offline rendering, plugins, or a native real-time engine
only after browser and desktop use identifies a concrete latency, rendering,
device, or production limitation.

Do not build a second sound engine solely because the Rust ecosystem makes it
interesting.

## Expansion sequence

Instrument Studio completes the first no-code composition workflow. Phase and
Drone cover independent clocks, exact long-form timing, sustained events, sparse
sections, restrained stochastic changes, and slow sound modulation. The next
slice remains Pattern: use existing Phrase or StepPattern material to test
transformation, deterministic probability, rhythm, and live mutation before
adding unrelated operators.

After all Three Studies pass the quality gate:

1. Improve listener-quality sound and event-driven visual identity, then ship
   Listen and turn the Studies into the first interactive learning pages.
2. Deepen Create with signals, scenes, macros, explicit transitions,
   deterministic feel, seed A/B comparison, analysis, and materialization.
3. Add constant-tempo MIDI import, Web MIDI, then asset and sample-backed
   workflows as concrete pieces require them.
4. Grow Learn lesson by lesson: theory spelling and harmony, VexFlow notation,
   ambient history, and composition-linked ear training.
5. Add Perform mappings and morphing, the textual frontend, Capture, production
   export, and desktop integration after their underlying semantics stabilize.

Learn uses the same piano, matrix, Rust/WASM theory, and audio runtime as Studio.
Its default loop is hear, see, change, predict, hear again, then use the result in
a piece. Ambient history follows a branching map across listening context, tape
and studio practice, process and phase, dub, ambient's explicit formulation,
Deep Listening, Japanese environmental music, ambient electronic descendants,
drone, sound art, and contemporary practice. Each chapter combines sourced
history with an original micro-study and an **Open in Studio** action; Ambiente
does not ship imitations of named artists.

Theory grows only with lessons: written pitch spelling, diatonic intervals,
scale degrees, chords, inversion, voicing, voice leading, and later harmonic
function. Written spelling remains distinct from equal-tempered sounding pitch.
VexFlow may render small teaching examples, but notation is not the canonical
model. External curricula may guide coverage; copied CC BY-SA material requires
intentional attribution and share-alike compliance.

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

The `Piece` semantics, `Document` format, and event semantics must remain
portable across native Rust, WASM, browser, desktop, CLI, and later MCP. The
engine stays small enough that musical choices matter more than framework
machinery.

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
- [Astro 7.0, _Sätteri: native Markdown parsing_](https://astro.build/blog/astro-7/#sätteri-native-markdown-parsing)
- [Sätteri documentation](https://satteri.bruits.org/docs/)
- [`vite-plugin-satteri`](https://github.com/bruits/satteri/tree/main/packages/vite-plugin-satteri)
- [`satteri-expressive-code`](https://github.com/bruits/satteri/tree/main/packages/satteri-expressive-code)
- [Tauri 2, _Frontend Configuration_](https://v2.tauri.app/start/frontend/)
- [Tauri 2, _File System_](https://v2.tauri.app/plugin/file-system/)
- [Tauri 2, _Store_](https://v2.tauri.app/plugin/store/)
- [Dexie.js documentation](https://dexie.org/docs/Dexie.js)
- [MDN, `StorageManager.persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
- [MDN, Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
- [Tone.js `GrainPlayer`](https://tonejs.github.io/docs/15.0.4/classes/GrainPlayer.html)
- [`midly`](https://docs.rs/midly/)
- [VexFlow](https://www.vexflow.com/)
- [Open Music Theory](https://viva.pressbooks.pub/openmusictheory/)
- [Command Line Interface Guidelines](https://clig.dev/)
