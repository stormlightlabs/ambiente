# Ambiente tasks

Outstanding implementation checklist for the Ambiente reboot. Completed work is
summarized in `CHANGELOG.md`.

See `ROADMAP.md` for product direction and sequencing. Architecture and design
rationale live with the web documentation source under `apps/web/content/docs/`.

## M6 — Instrument Studio

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

### Interactive documentation

- [ ] Share the production WASM/audio runtime with documentation examples.
- [ ] Make focused Phrase, Matrix, piano, voice, and sound examples playable.
- [ ] Avoid separate demo-only musical implementations.

### Done when

A user with no code knowledge can:

- [ ] create a piece
- [ ] select a sound
- [ ] play the piano
- [ ] record a phrase
- [ ] create a matrix pattern
- [ ] play both
- [ ] save
- [ ] close/reopen
- [ ] hear the same musical system again

## M7 — Three Studies quality gate

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

### Documentation

- [ ] Turn the Three Studies into focused tutorials/examples once their musical
      behavior is stable.

### Hard gate

- [ ] At least one study is something we would voluntarily use as background listening.
- [ ] All three demonstrate a distinct strength of the engine.

If not:

- [ ] stop feature expansion
- [ ] revise sounds
- [ ] revise pattern primitives
- [ ] revise stochastic constraints
- [ ] revise composition workflow

## M8 — Listen mode

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

## M9 — Generative Create

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

## M10 — DSL and Perform mode

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

## M11 — Capture and production

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

## M12 — Tauri desktop

- [ ] Add Tauri 2 application.
- [ ] Reuse shared Solid Studio.
- [ ] Reuse canonical WASM/document behavior.
- [ ] Add `DesktopPieceStorage` filesystem adapter.
- [ ] Open canonical piece files.
- [ ] Save piece.
- [ ] Save As.
- [ ] Recent pieces.
- [ ] Use canonical `.ambiente.json` piece files.
- [ ] Write user piece files atomically.
- [ ] Keep recent-file/preferences state in Tauri Store, outside canonical piece
      files.
- [ ] Drag/drop supported assets.
- [ ] Native file dialogs.
- [ ] Native MIDI adapter.
- [ ] OSC adapter.
- [ ] Audio device/settings integration as needed.
- [ ] Native export integration.
- [ ] Package macOS build first.
- [ ] Keep capability interfaces portable for later Windows/Linux builds.

### Done when

- [ ] The same Ambiente piece opens interchangeably in web and desktop versions
      through the same canonical `Document`.
- [ ] The Studio UX is shared rather than reimplemented.
- [ ] Desktop-specific capabilities live behind adapters.

## M13 — MCP

### Server

- [ ] Create `ambiente-mcp`.
- [ ] Reuse `ambiente-core`.
- [ ] Load/save canonical pieces.
- [ ] Reuse document operations and validation.

### Semantic tools

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
