# Ambiente tasks

Outstanding implementation checklist for the Ambiente reboot. Completed work is
summarized in `CHANGELOG.md`.

See `ROADMAP.md` for product direction and sequencing. Architecture and design
rationale live with the web documentation source under `apps/web/content/docs/`.

## M7 — Three Studies listening sign-off

The three canonical Studies, multi-seed ten-minute checks, sound-palette audit,
and interactive guide are complete. Broad feature work remains gated on a human
listening pass.

- [ ] Listen to Phase, Drone, and Pattern outside a development session across at
      least three seeds each.
- [ ] Confirm that at least one Study works as voluntary background listening.
- [ ] Confirm that phase relationships, sparse sustained texture, and transformed
      metric material are distinct musical strengths.
- [ ] If any Study fails, revise its sounds, authored material, probabilities, or
      composition workflow before starting M8.

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

### Sound and browser audio

Add sounds and controls only when a Study or first-party piece needs them.

- [ ] Define semantic sound families and stable IDs.
- [ ] Add a broad pad if `warm-drone` does not cover the needed role.
- [ ] Add tape-style drive and subtle wow/flutter inside curated sound implementations.
- [ ] Add modulated-filter support, reusing `motion` where possible.
- [ ] Add stereo width without harming mono or low-frequency behavior.
- [ ] Evaluate convolution/IR reverb against the current implementation.
- [ ] Add delay only if it works as a reusable semantic voice control.
- [ ] Prototype granular sample playback with Tone.js `GrainPlayer` after asset
      semantics exist.
- [ ] Add formant/vocal-like sound only for a named piece.
- [ ] Test audio-context resume/recovery and disposal of effects, samples, and
      long-running voices.

### Process visualization

- [ ] Visualize independent cycles and phase.
- [ ] Visualize event spans, voice activity, density, and silence.
- [ ] Visualize pitch/register movement and process decisions where useful.
- [ ] Define restrained visual profiles for first-party pieces.
- [ ] Derive motion from piece, event, and seed state where possible.
- [ ] Keep waveform and spectrum views diagnostic rather than primary.

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

- [ ] alternate/interleave
- [ ] shuffle
- [ ] deterministic random walk for a concrete pitch or control workflow
- [ ] `every`
- [ ] `within`
- [ ] Euclidean pulse distribution
- [ ] arpeggiation over authored pitch material
- [ ] bounded ornamentation
- [ ] sparse minimum-gap/density triggering
- [ ] richer pitch-selection helpers

Do not add Markov, recursive, grammatical, or evolutionary operators until a
first-party piece cannot be expressed cleanly without them.

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

### Explore

- [ ] Seed browser.
- [ ] Add A/B seed slots and replay identical spans under each seed.
- [ ] Rapidly audition, compare, pin, and keep variants.
- [ ] Summarize event/process differences without pretending to score musical quality.
- [ ] Materialize a selected realization or save its full state as a Capture.

### Deterministic feel

- [ ] Add bounded deterministic onset and velocity humanization.
- [ ] Derive variation from semantic event identity, operator ID, and decision
      coordinates so unrelated edits do not reshuffle all events.
- [ ] Add native/WASM golden tests and adjacent/overlapping query tests.
- [ ] Add swing for metric material.
- [ ] Defer named groove templates until recorded or imported material proves a need.

### Scenes, presets, and recipes

- [ ] Add canonical `Scene` and create/switch operations.
- [ ] Define the voice, material, process, and macro state owned by a scene.
- [ ] Add immediate and quantized scene transitions.
- [ ] Add metric-time and absolute-time morph transitions.
- [ ] Define which parameters interpolate and which switch discretely.
- [ ] Preserve determinism through scene changes.
- [ ] Keep sound presets inside `@ambiente/audio`.
- [ ] Use canonical starter documents as piece templates.
- [ ] Add inspectable process recipes that expand into canonical processes and
      operations.
- [ ] Keep playback and UI state out of presets.
- [ ] Do not ship artist-named presets.

### Materialize / Freeze to phrase

- [ ] Define source, time span, seed, output name, and normalize-to-zero inputs.
- [ ] Query deterministic events through the core.
- [ ] Convert note events to a new `Phrase`, preserving onset, duration, pitch,
      and velocity exactly.
- [ ] Record lightweight source, span, and seed provenance.
- [ ] Make the operation atomic and undoable through document operations.
- [ ] Add Studio and later CLI actions.
- [ ] Consider `StepPattern` output only when conversion is lossless and explicit.

### Analysis and history

- [ ] Add read-only projections for pitch sets, range, interval content, rhythmic
      density, overlap, and event/process provenance.
- [ ] Report likely scales or modes with explicit ambiguity.
- [ ] Add chord, voicing, and voice-leading analysis after those semantics exist.
- [ ] Surface analysis in CLI `inspect` and a focused Studio activity inspector.
- [ ] Add undo/redo over canonical document operations.
- [ ] Keep transport, audio readiness, panel selection, and transient MIDI state
      outside document history.
- [ ] Define history behavior for import, replacement, duplicate, and open.
- [ ] Show current query span, upcoming events, sources, and processes separately
      from scheduler/device diagnostics.

### Done when

- [ ] A user can turn a recorded Phrase or StepPattern into a substantially evolving
      composition without writing code.

## Learn program

Begin after the Three Studies quality gate and build it alongside M8–M11. Lessons
use the production Rust/WASM semantics, piano, matrix, and audio runtime.

### Infrastructure and theory model

- [ ] Replace the `/learn` placeholder with history, theory, and ear-training routes.
- [ ] Build interactive MDX lesson components and **Open in Studio** actions.
- [ ] Reuse production piano and matrix components where practical.
- [ ] Add VexFlow 5 for small SVG/Canvas notation examples derived from Rust data.
- [ ] Add lesson/playback smoke tests and browser gesture handling.
- [ ] Add spelled notes and accidentals while keeping spelling distinct from
      sounding pitch class.
- [ ] Add diatonic intervals, scale-degree helpers, chord quality, inversion,
      voicing, and voice-leading in lesson-driven slices.
- [ ] Add harmonic-function/Roman-numeral semantics only when lessons require them.
- [ ] Expose required theory projections through WASM; do not reimplement them in
      TypeScript.

### Ambient history

Build a branching history rather than a single linear canon. Pair each chapter
with sourced context, an original technique study, one interactive variable,
and legitimate further-reading/listening links.

- [ ] Furniture music and listening context.
- [ ] Tape, musique concrète, and studio composition.
- [ ] Cage, environment, and listening.
- [ ] Minimalism, repetition, process, and phase.
- [ ] Dub and the studio as instrument.
- [ ] Eno and ambient's explicit formulation.
- [ ] Pauline Oliveros and Deep Listening.
- [ ] Japanese environmental music / `kankyō ongaku`.
- [ ] Kosmische and new-age overlaps; ambient house, ambient techno, and dub techno.
- [ ] Drone, lowercase, sound art, installation, and contemporary practice.
- [ ] Turn Phase, Drone, and Pattern into the first substantial technique chapters.
- [ ] Use original pieces rather than artist imitations.

### Theory, ear training, and composition drills

- [ ] Teach sound, frequency, pitch, register, chromatic steps, and intervals.
- [ ] Teach pitch sets, major/minor scales, and modes.
- [ ] Teach beat, subdivision, meter, phase, and polyrhythm.
- [ ] Teach triads, seventh chords, inversion, voicing, and voice leading.
- [ ] Teach drones, pedals, static/modal harmony, repetition, probability, and form.
- [ ] Add interval, chord, mode, register, voicing, pulse, and phase exercises.
- [ ] Add filter, reverb, width, envelope, and process-change A/B exercises.
- [ ] End each drill with a composition action or prepared Studio piece.
- [ ] Accept optional Web MIDI answers where available.
- [ ] Write original prose and exercises; use external curricula only to audit coverage
      unless their licenses are intentionally adopted.

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

### Live MIDI

- [ ] Define a `MidiHost` capability.
- [ ] Add Web MIDI behind feature detection and permission handling.
- [ ] Route MIDI notes to piano preview and phrase recording.
- [ ] Map MIDI CC to macros and notes/buttons to scenes.
- [ ] Add event-stream MIDI output for external synths.
- [ ] Keep pointer, touch, and computer-keyboard input fully functional without
      Web MIDI.

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
- [ ] Export deterministic SVG/PNG process artwork.
- [ ] Preserve capture metadata alongside renders.
- [ ] Evaluate short audiovisual loops only after audio and image export are reliable.

### MIDI import

- [ ] Reuse `midly` and define the initial supported SMF subset.
- [ ] Import constant-tempo Type 0 and Type 1 files into Phrase/Voice data.
- [ ] Preserve velocity and converted performed timing.
- [ ] Map logical tracks/channels to voices without adding canonical `Track`.
- [ ] Diagnose unsupported tempo changes, controllers, and events.
- [ ] Add `ambiente import --midi` and save/load round-trip fixtures.
- [ ] Add tempo-map support only when real imports require it.

### Assets and sample material

Add these only after a first-party sample workflow establishes the need.

- [ ] Specify stable `AssetRef` and browser `AssetStore` behavior.
- [ ] Store content/project references rather than object URLs in documents.
- [ ] Add IndexedDB-backed imported asset storage.
- [ ] Define minimal sample, region, loop, and optional start-offset semantics.
- [ ] Emit generalized sample/source events from Rust.
- [ ] Connect source events to browser playback and loading/failure states.
- [ ] Prototype field-recording import and granular playback.
- [ ] Define desktop project-asset behavior before M12.

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
- [ ] Native MIDI adapter implementing `MidiHost`.
- [ ] Desktop asset store or portable project bundle for sample-backed pieces.
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

## Cross-cutting reliability and accessibility

- [ ] Test audio-context start, resume, and recovery states.
- [ ] Test sample decoding, loading failures, and audio-node/buffer disposal.
- [ ] Add or verify transport shortcuts and piano, matrix, and lesson keyboard access.
- [ ] Add ARIA labels, roles, and focus behavior for interactive music controls.
- [ ] Measure scheduler and audio performance before adding workers or native DSP.

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
