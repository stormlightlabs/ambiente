# Ambiente tasks

Implementation checklist for the Ambiente reboot.

See `docs/ROADMAP.md` for product direction and sequencing. The other files in
`docs/` own architecture and design rationale.

## M0 — Reboot foundation

### Workspace

- [x] Replace the existing Ambiente implementation with the reboot workspace structure.
- [x] Create `crates/core`.
- [x] Create `crates/cli`.
- [x] Defer `crates/wasm` until the initial core API exists.
- [x] Establish the frontend workspace.
- [x] Add formatting, linting, testing, and CI commands for Rust and TypeScript.
- [x] Document supported Rust/Node/package-manager versions.
- [x] Keep crates/packages minimal; do not pre-create empty future architecture.

### Documentation

- [x] Add `docs/ROADMAP.md`.
- [x] Add `docs/architecture.md`.
- [x] Add `docs/composition-model.md`.
- [x] Add `docs/audio.md`.
- [x] Add `docs/document-format.md`.
- [x] Document architectural invariants from the roadmap.
- [x] Add a glossary for `Document`, `Piece`, `Material`, `Voice`, `Pattern`, `Event`,
      `Scene`, `Macro`, and `Capture`.

### Foundation contracts

- [x] Choose stable ID representation.
- [x] Choose versioned document serialization format.
- [x] Define schema versioning/migration strategy.
- [x] Choose deterministic PRNG implementation and seed representation.
- [x] Define error/diagnostic types.
- [x] Define musical and absolute time representations.

### Done when

- [ ] A minimal versioned document can serialize and deserialize without loss.
- [ ] CI tests the round trip.
- [ ] There is no audio, UI, or music-theory complexity required to understand the
      persisted document.

## M1 — Musical document

### Document model

- [x] Implement `Document`.
- [x] Implement `Piece`.
- [x] Implement document metadata.
- [x] Implement stable IDs/references.
- [x] Implement validation.
- [x] Implement document operations rather than relying on arbitrary mutable access.

Initial operations should cover:

- [x] add/remove voice
- [x] add/remove material
- [x] update material
- [x] insert/remove note
- [x] update matrix cell
- [x] set seed
- [x] update voice settings

### Time

- [x] Implement absolute duration/time.
- [x] Implement beats/cycles.
- [x] Implement tempo.
- [x] Implement meter only where required by metric material.
- [x] Implement conversion between musical and absolute time.
- [x] Ensure processes can use independent absolute durations without requiring tempo
      synchronization.

Test cases should include:

- [x] ordinary 4/4 metric pattern
- [x] 17.2-second cycle
- [x] 23.8-second cycle
- [x] overlapping independent clocks

### Theory primitives

Implement only primitives required by early composition workflows.

- [x] `Pitch`
- [x] pitch class / chromatic representation as appropriate
- [x] `Interval`
- [x] `PitchSet`
- [x] `Scale`
- [x] register/range helpers
- [x] transposition

Defer sophisticated harmonic analysis and chord-generation APIs.

### Materials

- [x] Implement `Material` as the persisted sum type for authored source material.
- [x] Give every material a stable `MaterialId`.
- [x] Store materials in `Piece` independently from voices.
- [x] Support stable references from voices and later patterns to materials.
- [x] Define explicit serialized tags for each material type.
- [x] Implement add/remove/update material operations.
- [x] Validate duplicate IDs, broken references, and invalid material payloads.
- [x] Keep materials independent of sounds, Tone.js, MIDI, and UI state.
- [x] Initially support:
  - [x] `Phrase`
  - [x] `StepPattern`
  - [x] `PitchSet`
- [x] Defer `SampleSet` until sample playback provides a concrete requirement.

### Phrase

- [x] Implement `Phrase`.
- [x] Store arbitrary note events over time.
- [x] Support note pitch, onset, duration, and velocity.
- [x] Support non-quantized recording data.
- [x] Add optional quantization as a transformation/edit operation.

### StepPattern

- [x] Implement `StepPattern`.
- [x] Support configurable number of steps.
- [x] Support configurable subdivision.
- [x] Support pitch rows.
- [x] Support active/inactive cells.
- [x] Keep the representation extensible for later probability/velocity values.

### Voices

- [x] Implement `Voice`.
- [x] Allow a voice to reference musical material.
- [x] Add a symbolic `SoundRef`.
- [x] Add voice parameter storage without coupling it to Tone.js.
- [x] Do not add a canonical `Track` abstraction unless a later workflow demonstrates
      the need.

### Done when

- [x] A test fixture can contain both a Phrase and StepPattern.
- [x] Editing is performed through document operations.
- [x] Save/load produces an equivalent document.
- [x] No browser code is required to construct or inspect a piece.

## M2 — Pattern and event engine

### Generalized events

- [x] Implement `TimeSpan`.
- [x] Implement generalized `Event`.
- [x] Define event target/voice association.
- [x] Support note events.
- [x] Support extensible event properties.
- [x] Avoid MIDI-specific event semantics in the core model.

### Pattern query

Implement the equivalent of:

```text
pattern.query(time_span, seed) -> events
```

- [x] Query arbitrary spans.
- [x] Query overlapping spans consistently.
- [x] Query non-zero starting positions without rendering from time zero.
- [x] Sort/normalize returned events predictably.
- [x] Define boundary behavior precisely.

### Initial deterministic transformations

- [x] sequence
- [x] stack
- [x] repeat
- [x] shift
- [x] stretch / slow / fast
- [x] rotate
- [x] reverse
- [x] transpose

### Initial stochastic transformations

- [x] deterministic `choose`
- [x] weighted choice
- [x] `omit`
- [x] `sometimes`
- [x] hierarchical/sub-seeds so unrelated edits do not unnecessarily scramble an entire
      piece

### Tests

- [x] Same document + seed + span always returns identical events.
- [x] Native debug/release results agree.
- [x] Adjacent queries agree with equivalent combined queries where semantics require it.
- [x] Stochastic operations remain deterministic.
- [x] Patterns operating on seconds do not require a tempo.
- [x] Metric and free-time patterns can coexist.

### Done when

- [x] A Phrase and StepPattern can each produce generalized note events.
- [x] Several transformations can be composed.
- [x] A small generative piece can be represented entirely in Rust tests.

## M3 — CLI and observability

### CLI foundation

- [ ] Use `clap` for argument parsing, subcommands, help, and shell completions.
- [ ] Use `owo-colors` for terminal styling.
- [ ] Implement `ambiente new`.
- [ ] Implement `ambiente check`.
- [ ] Implement `ambiente inspect`.
- [ ] Implement `ambiente events`.
- [ ] Implement initial `ambiente export --midi`.
- [ ] Show concise help when a required command or argument is missing.
- [ ] Support `-h`, `--help`, and help for each subcommand.
- [ ] Include common examples and a link to the web documentation in help output.

### Output and automation

- [ ] Write primary and machine-readable output to `stdout`.
- [ ] Write diagnostics and progress messages to `stderr`.
- [ ] Return zero on success and meaningful non-zero exit codes on failure.
- [ ] Default to concise, human-readable output.
- [ ] Add `--json` for structured output where it is useful.
- [ ] Add `--plain` when human-oriented formatting would break line-based tools.
- [ ] Add `--quiet` to suppress non-essential output where commands otherwise report
      progress or success.
- [ ] Never require a prompt; accept all required input through arguments or flags.
- [ ] Prompt only when `stdin` is a TTY, and disable prompts with `--no-input`.

### Color and terminal behavior

- [ ] Use color sparingly and never as the only way to convey meaning.
- [ ] Disable color per stream when that stream is not a TTY.
- [ ] Honor `NO_COLOR`, `TERM=dumb`, and `--no-color`.
- [ ] Do not show animations when `stdout` is not a TTY.

### `check`

- [ ] Validate references.
- [ ] Validate time and range values.
- [ ] Validate malformed patterns.
- [ ] Group related validation failures under concise explanations.
- [ ] Explain how to correct expected errors without printing internal traces.

### `inspect`

- [ ] Show document metadata.
- [ ] Show materials.
- [ ] Show voices.
- [ ] Show pattern and process chains.
- [ ] Show activity and register summaries where they can be calculated.

### `events`

- [ ] Accept start and end spans.
- [ ] Support human-readable output.
- [ ] Support JSON output.
- [ ] Allow filtering by voice or material.
- [ ] Include enough information to debug scheduler behavior.

### MIDI export

- [ ] Translate supported note events to MIDI.
- [ ] Define behavior for unsupported and non-note events.
- [ ] Test deterministic export.

### Done when

- [ ] A developer can explain a fixture by inspecting the core through the CLI.
- [ ] The CLI works in scripts without prompts, decoration, or mixed output streams.
- [ ] Pattern debugging does not require the browser.

## M4 — WASM and browser audio

### WASM

- [ ] Compile `ambiente-core` through `ambiente-wasm`.
- [ ] Expose a narrow command/query boundary.
- [ ] Generate TypeScript definitions.
- [ ] Add ergonomic TypeScript wrapper package.
- [ ] Avoid exposing the entire mutable Rust object graph directly.

Required browser operations:

- [ ] load document
- [ ] serialize document
- [ ] apply operation
- [ ] validate
- [ ] query events
- [ ] inspect useful document state

### Cross-runtime conformance

- [ ] Create shared event fixtures.
- [ ] Run fixtures through native Rust.
- [ ] Run fixtures through WASM.
- [ ] Assert identical normalized event output.

### Audio package

- [ ] Create browser audio package.
- [ ] Implement Web Audio/Tone.js scheduler.
- [ ] Query a short future scheduling horizon instead of pre-rendering entire pieces.
- [ ] Handle transport start.
- [ ] Handle stop.
- [ ] Handle pause/resume.
- [ ] Handle seek.
- [ ] Handle document changes while playing.
- [ ] Avoid using Tone.js sequences as canonical composition state.

### Initial sounds

Build a small, useful palette.

- [ ] felt/piano-like sound
- [ ] bell/glass sound
- [ ] warm drone
- [ ] soft pluck
- [ ] noise/air texture
- [ ] simple percussion
- [ ] Give sounds stable semantic IDs.
- [ ] Separate sound presets from composition semantics.
- [ ] Add basic gain, pan, filter, and effects handling.

### Done when

- [ ] A Rust document plays continuously in a browser.
- [ ] No pattern-generation code is duplicated in TypeScript.
- [ ] Native and WASM event fixtures agree.

## M5 — Web Studio and instruments

### Web shell

- [ ] Create Vike + `vike-solid` application.
- [ ] Configure prerendered static routes.
- [ ] Configure `/studio/**` as the SPA portion.
- [ ] Create shared Studio package/components.
- [ ] Establish application/document state boundary around the WASM facade.

### Transport

- [ ] play
- [ ] stop
- [ ] pause
- [ ] seek
- [ ] current position
- [ ] tempo where relevant
- [ ] seed display/control

### Browser project persistence

- [ ] Create a new document.
- [ ] Save locally.
- [ ] Reopen locally.
- [ ] Import/export canonical document files.
- [ ] Preserve document schema/version metadata.

### Material and voice UI

- [ ] List voices.
- [ ] Select voice.
- [ ] Add/delete voice.
- [ ] List materials.
- [ ] Add/delete material.
- [ ] Associate material with voice.
- [ ] Select sound.
- [ ] Add initial inspector.

### Piano

- [ ] Render responsive piano keyboard.
- [ ] Support pointer/touch note input.
- [ ] Support computer keyboard input.
- [ ] Send immediate note preview to selected sound.
- [ ] Add octave navigation.
- [ ] Record note-on/note-off timing.
- [ ] Convert recording to canonical `Phrase`.
- [ ] Display recorded phrase.
- [ ] Add optional post-recording quantization.

### Tone Matrix editor

- [ ] Render configurable matrix.
- [ ] Toggle cells.
- [ ] Show playhead.
- [ ] Map rows to pitches.
- [ ] Configure step length.
- [ ] Configure subdivision.
- [ ] Edit canonical `StepPattern` through Rust operations.
- [ ] Make playback changes audible without rebuilding the application.

### Initial editor modes

- [ ] Matrix
- [ ] Phrase
- [ ] basic System/voice inspector

### Done when

A user with no code knowledge can:

- [ ] create a project
- [ ] select a sound
- [ ] play the piano
- [ ] record a phrase
- [ ] create a matrix pattern
- [ ] play both
- [ ] save
- [ ] close/reopen
- [ ] hear the same musical system again

## M6 — Three Studies quality gate

Do not proceed by adding broad product surface until these studies work musically.

### Phase study

- [ ] Compose a first-party study from a small amount of material.
- [ ] Add independent clock support required by the piece.
- [ ] Support noncommensurate cycles.
- [ ] Verify long playback does not drift incorrectly at the event level.
- [ ] Create useful visualization for interacting cycles if needed.

### Drone study

- [ ] Add long-duration events.
- [ ] Add continuous/slow parameter modulation needed by the study.
- [ ] Add restrained stochastic motion.
- [ ] Improve ambient sound presets.
- [ ] Support long sections of low activity/silence naturally.

### Pattern study

- [ ] Compose from Phrase and/or StepPattern material.
- [ ] Exercise transformations.
- [ ] Exercise deterministic probability.
- [ ] Exercise stronger rhythmic behavior.
- [ ] Verify transformations preserve the authored identity of the material.

### Quality review

For each study:

- [ ] aim for no more than five voices unless the music requires more
- [ ] support 5–10 minutes of convincing playback, with longer runs where the piece
      supports them
- [ ] test several seeds
- [ ] verify different seeds retain recognizable identity
- [ ] remove primitives that encourage bad/random output
- [ ] improve defaults instead of compensating with more configuration
- [ ] listen outside development/debugging sessions

### Hard gate

- [ ] At least one study is something we would voluntarily use as background listening.
- [ ] All three demonstrate a distinct strength of the engine.

If not:

- [ ] stop feature expansion
- [ ] revise sounds
- [ ] revise pattern primitives
- [ ] revise stochastic constraints
- [ ] revise composition workflow

## M7 — Listen mode

- [ ] Add dedicated listener-facing route/mode.
- [ ] Hide composition implementation details.
- [ ] Add first-party piece browser.
- [ ] Support endless playback.
- [ ] Add seed variation.
- [ ] Add session duration controls.
- [ ] Add restrained generative/process visualization.

### Macros

- [ ] Add canonical `Macro` model.
- [ ] Allow composers to publish selected high-level controls.
- [ ] Map one macro to multiple underlying parameters/process values.
- [ ] Define useful semantic controls such as density, motion, space, warmth, and
      intensity where appropriate.

### Purpose presets

- [ ] Allow a piece to offer optional modes such as `Focus`, `Create`, or `Rest`.
- [ ] Implement these as authored macro/scene presets.
- [ ] Do not encode unsupported neuroscience claims into the engine or UI.

### Done when

- [ ] A user can open Ambiente solely to listen.
- [ ] Composition knowledge is unnecessary in Listen mode.
- [ ] At least one first-party piece works credibly as extended work/reading/creative
      background audio.

## M8 — Generative Create

### Process editing

- [ ] Add process chains to the Studio.
- [ ] Inspect transformations attached to a material/voice.
- [ ] Add transformations graphically.
- [ ] Remove/reorder transformations.
- [ ] Edit transformation parameters.
- [ ] Keep all edits represented by canonical Rust operations.

### Additional patterns

Add only as demanded by actual compositions.

Candidates:

- [ ] alternate
- [ ] shuffle
- [ ] random walk
- [ ] `every`
- [ ] `within`
- [ ] duplication/interleave
- [ ] richer pitch-selection helpers

### Signals

- [ ] Define continuous signal abstraction.
- [ ] sine
- [ ] triangle
- [ ] envelope
- [ ] deterministic noise
- [ ] random walk

Use signals initially for:

- [ ] gain
- [ ] pan
- [ ] filter
- [ ] other perceptually useful parameters

### Scenes

- [ ] Add canonical `Scene`.
- [ ] Create/switch scenes.
- [ ] Define transition behavior.
- [ ] Allow scene state to interact with macros.

### Explore

- [ ] Seed browser.
- [ ] Rapidly audition variants.
- [ ] Keep chosen variants/seeds.
- [ ] Add useful summaries rather than pretending to score musical quality automatically.

### Done when

- [ ] A user can turn a recorded Phrase or StepPattern into a substantially evolving
      composition without writing code.

## M9 — DSL and Perform mode

### Language

Do not begin syntax work until the underlying semantic operations are stable.

- [ ] Define textual representation of patterns/processes.
- [ ] Implement parser.
- [ ] Implement diagnostics.
- [ ] Implement formatter.
- [ ] Ensure source constructs map predictably to the Rust semantic model.
- [ ] Avoid exposing implementation-specific Web Audio/Tone.js concepts.

### Code editor

- [ ] Add Code view.
- [ ] Parse/edit while composition is stopped.
- [ ] Add live updates.
- [ ] Preserve transport clock during successful pattern replacement.
- [ ] Preserve old running state when new source has errors.
- [ ] Surface concise diagnostics inline.

### Performance mode

- [ ] Full/reduced performance UI.
- [ ] Scene triggering.
- [ ] Macro controls.
- [ ] Keyboard mappings.
- [ ] MIDI mappings.
- [ ] Live seed changes.
- [ ] Live process changes.
- [ ] Performance-safe error behavior.

### Done when

- [ ] A performer can alter an active piece without stopping playback.
- [ ] No JavaScript/Rust programming is required during musical performance.

## M10 — Capture and production

### Capture

- [ ] Add canonical capture representation.
- [ ] Capture document revision.
- [ ] Capture seed/state.
- [ ] Capture relevant scene/macro state.
- [ ] Capture performance operations where required.
- [ ] Support named captures.
- [ ] Replay a capture deterministically.

### Regions

- [ ] Mark interesting time ranges.
- [ ] Save/freeze a realization.
- [ ] Start playback from captured state where semantically possible.

### Export

- [ ] Improve MIDI export.
- [ ] Add audio export strategy.
- [ ] WAV.
- [ ] FLAC if justified.
- [ ] Stems.
- [ ] Preserve capture metadata alongside renders.

### Done when

- [ ] An interesting emergent performance can be preserved and recreated later.

## M11 — Documentation and public web

### Static site

- [ ] Landing page.
- [ ] `/docs/**`.
- [ ] `/learn/**`.
- [ ] `/examples/**`.
- [ ] `/studio/**`.
- [ ] `/listen/**` as appropriate.

### Documentation

- [ ] introduction
- [ ] composition model
- [ ] Phrase
- [ ] Matrix
- [ ] piano recording
- [ ] voices
- [ ] patterns
- [ ] probability/seeds
- [ ] independent clocks/phasing
- [ ] signals
- [ ] scenes
- [ ] macros
- [ ] sound
- [ ] CLI
- [ ] live coding

### Interactive learning

- [ ] Share WASM/audio runtime with docs examples.
- [ ] Make simple documentation snippets playable.
- [ ] Add focused tutorials based on the Three Studies.
- [ ] Avoid separate demo-only implementations.

### Done when

- [ ] Static deployment requires no production application server.
- [ ] Documentation routes contain prerendered content.
- [ ] Studio remains an SPA.
- [ ] A new user can learn enough on the site to create a basic piece.

## M12 — Tauri desktop

- [ ] Add Tauri 2 application.
- [ ] Reuse shared Solid Studio.
- [ ] Reuse canonical WASM/document behavior.
- [ ] Add native project filesystem adapter.
- [ ] Open project.
- [ ] Save project.
- [ ] Save As.
- [ ] Recent projects.
- [ ] Drag/drop supported assets.
- [ ] Native file dialogs.
- [ ] Native MIDI adapter.
- [ ] OSC adapter.
- [ ] Audio device/settings integration as needed.
- [ ] Native export integration.
- [ ] Package macOS build first.
- [ ] Keep capability interfaces portable for later Windows/Linux builds.

### Done when

- [ ] The same Ambiente document opens interchangeably in web and desktop versions.
- [ ] The Studio UX is shared rather than reimplemented.
- [ ] Desktop-specific capabilities live behind adapters.

## M13 — MCP

### Server

- [ ] Create `ambiente-mcp`.
- [ ] Reuse `ambiente-core`.
- [ ] Load/save canonical projects.
- [ ] Reuse document operations and validation.

### Semantic tools

- [ ] `get_document`
- [ ] `get_piece`
- [ ] `list_voices`
- [ ] `get_voice`
- [ ] `list_materials`
- [ ] `get_material`
- [ ] `add_voice`
- [ ] `add_material`
- [ ] `insert_note`
- [ ] `set_step`
- [ ] `set_pattern`
- [ ] `apply_process`
- [ ] `set_macro`
- [ ] `set_seed`
- [ ] `query_events`
- [ ] `inspect`
- [ ] `validate`

### Agent ergonomics

- [ ] Return semantic summaries rather than enormous serialized documents by default.
- [ ] Make IDs stable and easy to reference across calls.
- [ ] Support bounded edits.
- [ ] Provide useful validation failures.
- [ ] Avoid source-code-writing tools as the primary musical API.

### Done when

- [ ] An agent can make musically meaningful structured edits without generating
      scheduler/audio code.

## M14 — Native audio, if justified

Do not schedule this milestone only because a Rust DSP stack would be interesting.

Investigate only after browser/Tauri workflows demonstrate an actual limitation.

Possible tasks:

- [ ] define concrete shortcomings of browser audio
- [ ] evaluate native audio libraries
- [ ] evaluate offline rendering architecture
- [ ] evaluate shared DSP strategy
- [ ] native real-time audio
- [ ] headless CLI rendering
- [ ] advanced synthesis
- [ ] plugin architecture

### Proceed only if

- [ ] latency, rendering, DSP, device access, or production requirements cannot be met
      adequately by the established architecture.

## Deferred and out of scope

Do not implement during the initial roadmap unless requirements materially change:

- [ ] full DAW timeline
- [ ] multitrack waveform editing
- [ ] VST/AU hosting
- [ ] notation engraving
- [ ] huge modular-synthesis environment
- [ ] hundreds of Tidal-style operators
- [ ] automatic "generate me a song" workflow
- [ ] prompt-to-song
- [ ] automatic chord/melody/bass/drum generators as core architecture
- [ ] cloud accounts/auth
- [ ] collaborative backend
- [ ] server dependency for normal web use
- [ ] native DSP solely for architectural purity
