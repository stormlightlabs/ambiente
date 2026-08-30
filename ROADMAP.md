# Ambiente Roadmap

> **Status:** reboot / replacement architecture
> **Primary platforms:** Web, macOS desktop, CLI
> **Core stack:** Rust, WebAssembly, Solid, Vike, Tauri, Web Audio / Tone.js
> **Later integrations:** MIDI, OSC, MCP, native/offline audio rendering

## 1. Project direction

Ambiente is a system for **composing, performing, exploring, and listening to generative music**.

The project is not primarily a DAW, MIDI generator, algorithmic chord-progression generator, or collection of music-theory utilities. The central abstraction is a **musical system**: authored musical material transformed by deterministic and stochastic processes into a stream of events that can be rendered through audio, MIDI, OSC, or visualization.

The primary influences are:

- Brian Eno's process-oriented and generative composition
- ambient, drone, and experimental music associated with labels such as Kranky
- SuperCollider's separation of patterns, events, and sound synthesis[^1]
- TidalCycles and Strudel's composable temporal pattern model[^2]
- Sonic Pi's accessible live-coding workflow and reproducible randomness[^3]
- Bloom and similar generative instruments in which composition, instrument, and visual artwork overlap
- Wotja's broad generative and adaptive composition capabilities[^4]
- Generative.fm's model of human-authored musical generators rather than automated songwriting[^5]
- Brain.fm's listener-first, purpose-oriented playback experience[^6]
- Endel's separation between human-designed sound systems and contextual real-time adaptation[^7]
- algorithmic and generative visual art

The aim is not to reproduce any one of these products. Ambiente should occupy the space between them:

> **High composer control + deeply generative behavior + approachable direct manipulation.**

A user should be able to play a phrase on a piano, draw notes into a matrix, transform that material into a generative system, perform it live, capture an interesting realization, and later simply open the same piece in **Listen** mode while working.

# 2. Product principles

## 2.1 Human-authored material, machine-realized performance

Ambiente should not attempt to generate an entire piece from a scale, chord progression, genre, or prompt.

Instead:

```text
authored material
        ↓
musical processes
        ↓
bounded interactions
        ↓
event stream
        ↓
sound / MIDI / visualization
```

The musician supplies the identity of the piece.

The system supplies controlled evolution.

## 2.2 Theory is a tool, not the architecture

Music-theory concepts should exist as reusable primitives:

- pitch
- pitch class
- interval
- tuning
- scale
- chord
- voicing
- pitch set
- register
- voice leading

They should help processes make musically meaningful decisions, but the composition model must not assume that music is fundamentally a chord progression plus melody.

Ambient drones, unpitched sound, field recordings, microtonality, noise, MIDI CC, and continuous modulation must fit naturally into the same architecture.

## 2.3 Patterns describe behavior

A pattern represents behavior across time.

The core conceptual operation is:

```text
Pattern + TimeSpan + Seed
          ↓
       Events
```

This follows the useful property demonstrated by Strudel: a pattern can be queried for a time span to obtain events, making the pattern itself independent of realtime scheduling.[^2]

Patterns should therefore be:

- deterministic for a given seed and query
- composable
- independent of the audio backend
- queryable without realtime playback
- suitable for both metric and non-metric music

## 2.4 Sound is separate from composition

The Rust core determines:

> **What happens and when?**

The audio runtime determines:

> **What does that event sound like?**

This resembles SuperCollider's useful separation between pattern/event generation and the action taken when an event is played.[^1]

The same musical event should eventually be usable with:

- Web Audio
- MIDI
- OSC
- native synthesis
- offline rendering
- visualization

## 2.5 Determinism is mandatory

Every stochastic process must ultimately derive from explicit deterministic seeds.

Given:

```text
document
seed
time span
```

the Rust engine must produce the same event stream on every supported platform.

Sonic Pi demonstrates why reproducible pseudo-randomness is particularly useful musically: the composer can explore random possibilities and preserve a realization simply by preserving its seed.[^3]

## 2.6 Randomness should be restrained by default

Prefer:

```text
phrase
  → omit(0.08)
  → rotate(every 7 cycles)
  → transpose(sometimes(0.04), octave)
```

over:

```text
random melody
→ random chords
→ random bass
→ random drums
```

Processes should deform authored identity rather than constantly replace it.

## 2.7 The UI is an instrument, not a DAW clone

Ambiente can use familiar concepts such as:

- piano keyboards
- piano rolls where appropriate
- steps
- tracks
- transport controls

but should not assume that the timeline is the primary representation of music.

A process may instead be best represented as:

- a loop
- orbit
- signal
- probability distribution
- relationship
- transformation chain
- independent clock

The visual language should connect the musical system to algorithmic art.

# 3. Primary user experiences

The application should eventually expose three major modes over the same document.

## Listen

Listener-first playback.

Inspired partly by the simplicity of Brain.fm and Endel, Listen mode hides implementation detail and exposes only parameters deliberately published by the composer.[^6][^7]

Examples:

```text
Focus
Create
Rest

Intensity   ━━━●━━━━━━
Motion      ━●━━━━━━━━
Space       ━━━━━━●━━━
Warmth      ━━━━━●━━━━
```

These are **macros**, not magic application-wide definitions.

A piece decides which controls it exposes and how they affect its system.

The initial product should make no claims that Ambiente reproduces Brain.fm's proprietary neurological modulation or scientifically changes cognitive states. The inspiration is its product framing: purpose, low friction, long-running audio, and bounded user controls.

## Create

The graphical composition environment.

Primary editors should include:

- piano
- Tone-Matrix-inspired step sequencer
- phrase editor
- voice/material browser
- process editor
- sound selector
- parameter inspector
- system visualization

The user should be able to create meaningful music without programming.

## Perform

A reduced interface for manipulating a running system.

Eventually includes:

- live code editing
- process replacement without resetting the transport
- scenes
- macro controls
- MIDI mappings
- keyboard mappings
- seed changes
- capture
- minimal performance visualization

The same piece must remain compatible with all three modes.

# 4. Canonical architecture

```text
                         ambiente-core
                             Rust
                              │
              ┌───────────────┼────────────────┐
              │               │                │
              ▼               ▼                ▼
        ambiente-cli    ambiente-wasm     ambiente-mcp
                              │
                              ▼
                     TypeScript facade
                              │
                  ┌───────────┴───────────┐
                  │                       │
                  ▼                       ▼
              studio UI               audio-web
                Solid                Web Audio /
                                      Tone.js
                  │
             ┌────┴─────┐
             ▼          ▼
          Vike Web    Tauri
```

Rust is the authority for musical meaning.

TypeScript should not implement a parallel composition engine.

The web application should not contain a second canonical song model.

Tauri should not contain a third.

# 5. Rust document model

Do **not** begin with a conventional:

```text
Song
└── Tracks
    └── MIDI Notes
```

hierarchy.

It would prematurely constrain Ambiente to sequenced note music.

Start closer to:

```text
Document
└── Piece
    ├── Metadata
    ├── Transport
    ├── Materials
    ├── Voices
    ├── Scenes
    ├── Signals
    ├── Macros
    └── Captures
```

## Document

The persisted root object.

Responsibilities:

- schema/version information
- IDs
- metadata
- serialization
- migration
- document operations
- validation

## Piece

The playable musical system.

A document may initially contain exactly one piece; the distinction is still useful for future project-level concerns.

## Transport

Contains the relevant concepts of musical/global time:

- tempo
- meter
- beat/cycle conversion
- loop regions
- tempo map later

Do not require every process to use beats.

The time model must also support durations such as:

```text
17.2 seconds
23.8 seconds
4 minutes
```

for phasing, drones, environmental sound, and independent clocks.

## Material

Authored source material.

Initial material types:

```text
Phrase
StepPattern
PitchSet
SampleSet
```

Later possibilities:

```text
ChordSet
AutomationShape
RecordedControl
AudioClip
```

### Phrase

Arbitrary note/event material over time.

The piano recorder should produce a `Phrase`.

### StepPattern

Quantized two-dimensional step material.

The Tone Matrix editor should manipulate a `StepPattern`.

The matrix is therefore **an editor for canonical musical data**, not an isolated JavaScript sequencer.

## Voice

A playable role in the piece.

Examples:

```text
Piano
Halo
Tape
Rain
Kick
Field Recording
```

A voice references:

- one or more patterns/materials
- a sound
- parameters
- routing information

The graphical application may display voices as tracks when useful, but **Track should not initially be the canonical Rust abstraction**.

## Scene

A named configuration or transition target.

Examples:

```text
Opening
Dense
Still
Ending
```

Scenes should allow the system to evolve structurally without requiring a conventional linear arrangement.

## Macro

A composer-published control that modifies one or more lower-level parameters.

This provides the foundation for Listen and Perform modes.

Examples:

```text
density
space
brightness
motion
intensity
```

## Capture

A reproducible realization of a generative system.

A capture should eventually preserve enough information to replay the same musical realization:

- document revision
- seed/state
- selected scenes
- macro state
- time range
- relevant performance operations

# 6. Event model

The shared output of the composition engine should be a generalized event rather than MIDI.

Conceptually:

```rust
Event {
    span,
    target,
    kind,
    properties,
}
```

Possible events include:

```text
note
sample
parameter
scene
control
```

Properties may include:

```text
pitch
velocity
gain
pan
filter
sample_position
grain_size
MIDI CC
visual properties
```

SuperCollider is an important precedent here: its pattern system produces generalized events whose interpretation is separate from pattern construction.[^1]

This abstraction allows a pattern to drive audio, MIDI, visualization, or other outputs without rewriting the pattern system.

# 7. Pattern engine

Start with a deliberately small vocabulary.

## Structural

- sequence
- stack
- repeat
- cycle

## Temporal

- shift
- stretch
- slow
- fast
- phase

## Transformations

- rotate
- reverse
- transpose
- invert
- omit
- duplicate
- map

## Selection

- choose
- weighted choice
- alternate
- shuffle
- walk

## Conditional

- sometimes
- rarely
- every
- within

## Signals

Later:

- sine
- triangle
- step
- envelope
- noise
- random walk

The aim is **a small algebra whose combinations are expressive**, not a catalog of hundreds of independent generators.

Strudel/Tidal and SuperCollider are references for composability, not APIs to reproduce wholesale.[^1][^2]

# 8. Audio architecture

## Browser-first realtime audio

For the initial implementation:

```text
Rust/WASM
    ↓
Event queries
    ↓
TypeScript scheduler
    ↓
Tone.js / Web Audio
    ↓
instruments + samples + FX
```

Tone.js already provides browser audio primitives, synths/effects, transport, and audio-clock-aware scheduling.[^8]

Use it as infrastructure.

Do **not** expose Tone.js concepts as Ambiente's composition model.

Bad boundary:

```text
Rust tells JS to create Tone.Sequence(...)
```

Preferred boundary:

```text
Rust returns musical Events
JS schedules those Events
```

## Sound library

Musical quality is a product requirement.

The initial app should ship with a small curated sound palette instead of a large collection of generic oscillator presets.

Initial roles might include:

- felt
- glass
- warm drone
- bowed
- tape
- dust
- air
- pluck
- bell
- room tone

The exact synthesis/sample implementation can change without affecting a piece's compositional structure.

## Native audio

Do not make native realtime synthesis a prerequisite for the first usable version.

A Rust/native backend may later be justified for:

- headless rendering
- CLI rendering
- lower latency
- plugins
- advanced DSP
- desktop device control

Build it only after the browser version has demonstrated that Ambiente can produce worthwhile music.

# 9. WASM boundary

Compile the composition engine to WebAssembly.

`wasm-bindgen` supports higher-level Rust/JavaScript interaction and TypeScript binding generation, making it appropriate for exposing a narrow browser API around the Rust document.[^9]

The frontend API should look conceptually like:

```text
load(document)
save()
apply(operation)
validate()
query(span)
inspect(...)
```

Avoid sending an enormous deeply mutable Rust object graph into JavaScript.

Prefer an ergonomic TypeScript wrapper over a small WASM command/query surface.

A critical invariant:

> Native Rust and WASM must produce identical event streams for identical document + seed + time-span inputs.

# 10. CLI

The CLI is the inspectable interface to the same core.

Initial commands:

```text
ambiente new
ambiente check
ambiente inspect
ambiente events
ambiente export
ambiente vary
```

Later:

```text
ambiente play
ambiente render
ambiente studio
```

## `ambiente check`

Validate the document and report structural errors.

## `ambiente inspect`

Explain the musical system:

```text
VOICE       ACTIVITY    REGISTER    PROCESS
piano       8–12/min    C3–A4       phrase → omit → rotate
halo        3–4/min     D3–E5       choose → sustain
tape        continuous  —           cycle → filter → pan
```

## `ambiente events`

Query deterministic output:

```text
ambiente events --from 30s --to 35s
```

This is important for:

- debugging
- testing
- agents
- reproducibility
- engine development

## `ambiente vary`

Explore seed space without rewriting the composition.

Possible later workflow:

```text
ambiente vary --count 8
ambiente vary --listen
```

## `ambiente render`

Eventually support:

```text
ambiente render piece.amb --format wav
ambiente render piece.amb --stems
```

Do not block the early roadmap on this if it requires premature native DSP infrastructure.

# 11. Web architecture

Use:

```text
Vite
Vike
vike-solid
Solid
```

Vike explicitly supports using different rendering strategies by page, including a statically generated website containing SPA routes.[^10]

Target routes:

```text
/                  prerendered
/docs/**            prerendered
/learn/**           prerendered
/examples/**        prerendered + interactive components
/studio/**          SPA shell
```

This produces the same general hybrid architecture desired from Inkfinite:

- searchable/indexable documentation
- cheap static hosting
- interactive examples
- substantial browser application without requiring an application server

The Studio must use the same WASM core and audio package as embedded examples.

A documentation example should therefore be able to literally run an Ambiente pattern.

# 12. Studio UX

Target shell:

```text
┌─────────────────────────────────────────────────────────────┐
│ Ambiente      after rain       ▶  ■     seed 1948          │
├─────────────┬───────────────────────────────┬───────────────┤
│             │                               │               │
│ MATERIALS   │          MAIN EDITOR          │   INSPECTOR   │
│             │                               │               │
│ Piano       │                               │               │
│ Bells       │                               │               │
│ Drone       │                               │               │
│ Rain        │                               │               │
│             │                               │               │
├─────────────┴───────────────────────────────┴───────────────┤
│                      instrument dock                       │
└─────────────────────────────────────────────────────────────┘
```

The central editor changes according to the selected object/view.

Initial views:

```text
Matrix
Phrase
System
```

Later:

```text
Code
Performance
Explore
```

# 13. Piano

The piano is both:

1. an immediate instrument for auditioning sounds;
2. an input mechanism for creating `Phrase` material.

Required early behavior:

- mouse/touch input
- computer keyboard mapping
- selected voice/sound preview
- note-on / note-off
- octave navigation
- velocity default
- recording into a Phrase
- quantization after recording, not necessarily during recording

Later:

- MIDI input
- scale highlighting
- chord/voicing tools
- sustain
- velocity
- MPE where justified

The piano should make Ambiente useful before a user learns its generative concepts.

# 14. Tone-Matrix-inspired sequencer

The matrix edits `StepPattern`.

Required initial behavior:

- configurable rows
- configurable steps
- toggle cells
- playhead
- pitch mapping
- subdivision
- pattern length
- loop playback

Later:

- velocity
- probability
- ratchets/substeps
- per-cell duration
- scale-aware rows
- parameter matrices
- arbitrary event values

Critically, a `StepPattern` can then participate in the same process engine:

```text
matrix
  → slow(2)
  → rotate(every 7)
  → omit(0.08)
```

This is the bridge between conventional sequencing and Ambiente's generative model.

# 15. System / process view

The graphical process editor should expose relationships rather than becoming a generic node editor.

Possible representation:

```text
Phrase A
   │
   ▼
slow ×4
   │
   ▼
omit 12%
   │
   ▼
rotate every 7
   │
   ▼
Piano
```

Independent cycles should be visualizable as independent cycles.

Continuous signals should appear as signals.

Probability should be visually inspectable.

The visualization should be useful both aesthetically and diagnostically.

Avoid implementing an unconstrained node graph before concrete musical workflows establish which relationships actually need graphical representation.

# 16. Code / live-coding mode

The textual language should come **after** the Rust semantics are stable.

Do not make parser design the first milestone.

The language is a frontend over the document/pattern system.

Conceptually:

```text
voice piano {
  play phrase_a
    |> slow 4
    |> omit 0.12
    |> every 7 rotate(1)

  sound felt
}
```

Exact syntax remains intentionally unspecified early in the roadmap.

Required properties:

- concise
- readable during performance
- compositional rather than implementation-oriented
- maps cleanly to canonical pattern operations
- hot-replaceable while playback continues

Strudel demonstrates the usefulness of replacing an active pattern while preserving the scheduler's running clock.[^2]

# 17. Tauri desktop application

The desktop app should reuse the Solid Studio rather than becoming another frontend.

Tauri conceptually hosts static HTML/CSS/JS/WASM inside its webview, which fits Ambiente's static Vike/Solid frontend architecture well.[^11]

Tauri-specific capabilities should live behind adapters.

Examples:

```text
ProjectStorage
├── BrowserProjectStorage
└── DesktopProjectStorage

MidiHost
├── WebMidiHost
└── NativeMidiHost

FileHost
├── BrowserFileHost
└── TauriFileHost
```

Desktop additions:

- filesystem projects
- recent files
- native save/open
- drag/drop files
- audio device configuration
- native MIDI
- OSC
- export/render integration
- system integration

The desktop application must not fork the Studio UX.

# 18. MCP

MCP comes late deliberately.

The agent API should manipulate **musical semantics**, not source-code strings.

Possible tools:

```text
get_document
get_piece
list_voices
get_voice
list_materials
add_voice
add_material
set_pattern
set_step
insert_note
apply_process
set_macro
set_seed
query_events
inspect
validate
```

MCP operations should internally use the same document operations used by the GUI and CLI.

Avoid tools such as:

```text
execute_javascript
write_tonejs
replace_source_file
```

unless required for development tooling outside the musical protocol.

An agent should be able to say:

> reduce the bell density and restrict it to the upper register

rather than generate bespoke scheduler code.

# 19. Milestones

## M0 — Reboot foundation

### Goal

Establish the project boundaries before implementing product features.

### Deliverables

- Rust workspace
- frontend workspace
- architecture documentation
- project principles
- glossary
- CI
- formatting/lint/test commands
- minimal versioned `Document`

### Decisions required

- serialization format
- ID strategy
- time representation
- deterministic PRNG
- error model

### Exit criteria

A minimal document can be created, serialized, loaded, migrated, validated, and round-tripped without information loss.

## M1 — Musical document and time

### Goal

Build the smallest useful musical model.

### Deliverables

- `Document`
- `Piece`
- `Voice`
- `Material`
- `Phrase`
- `StepPattern`
- musical time
- absolute time
- event spans
- operations/edit model
- theory primitives:
    - `Pitch`
    - `Interval`
    - `PitchSet`
    - `Scale`
    - register helpers

### Exit criteria

Tests can construct a small piece containing a Phrase and StepPattern and deterministically inspect its contents.

No audio is necessary yet.

## M2 — Pattern/event engine

### Goal

Turn musical material into deterministic time-queryable events.

### Initial patterns

- sequence
- stack
- repeat
- shift
- stretch
- rotate
- reverse
- transpose

### Initial stochastic processes

- choose
- weighted
- omit
- sometimes

### Deliverables

- deterministic seed hierarchy
- `TimeSpan`
- event query API
- generalized `Event`
- pattern composition
- property-based/determinism tests

### Exit criteria

Given the same document, seed, and time span, tests always produce the same events.

Queries over adjacent or overlapping spans remain semantically consistent.

## M3 — CLI and observability

### Goal

Make the engine inspectable before adding GUI complexity.

### Deliverables

```text
ambiente new
ambiente check
ambiente inspect
ambiente events
ambiente export --midi
```

### Exit criteria

A developer can debug an entire simple composition from the terminal.

No browser developer tools are required to understand what the musical engine is doing.

## M4 — WASM and browser audio

### Goal

Produce reliable realtime sound from the Rust engine.

### Deliverables

- `ambiente-wasm`
- generated TypeScript bindings
- ergonomic TS facade
- query scheduler
- Tone.js/Web Audio adapter
- audio lifecycle
- small curated sound palette

### Required test

For fixed fixtures:

```text
native Rust events == WASM events
```

### Exit criteria

A browser can load a Rust-authored document and play it continuously without duplicating composition logic in TypeScript.

## M5 — Instrument Studio

### Goal

Make Ambiente immediately playable.

### Deliverables

- Vike + Solid application
- Studio SPA
- transport
- material/voice browser
- piano
- Tone-Matrix-inspired step sequencer
- Phrase recording
- StepPattern editing
- inspector
- save/load browser projects

### Exit criteria

A user can open Ambiente with no code knowledge and:

1. select a sound;
2. play the piano;
3. record a phrase;
4. create a matrix pattern;
5. combine the material;
6. save the composition;
7. reopen it;
8. hear the same piece.

## M6 — Three Studies

### Goal

Prove that the engine produces **good music**, not merely valid event streams.

Create three first-party pieces.

### Study A — Phase

Explore:

- independent clocks
- noncommensurate durations
- slow phase relationships

### Study B — Drone

Explore:

- long events
- slow modulation
- restrained pitch sets
- texture
- silence
- continuous signals

### Study C — Pattern

Explore:

- metric patterns
- transformation
- probability
- live mutation
- stronger rhythmic behavior

### Constraints

Each study should aim for:

- at most approximately five voices
- a small amount of authored structure
- 5–10+ minutes of compelling evolution
- meaningful seed variation
- recognizable identity across seeds

### Exit criteria

The team would voluntarily listen to these pieces outside the development/test context.

If this milestone fails, **do not compensate by adding features**.

Improve:

- primitives
- sounds
- defaults
- constraints
- composition workflow

until it succeeds.

## M7 — Listen

### Goal

Make Ambiente useful as a music-listening product.

### Deliverables

- full Listen mode
- artwork/process visualization
- endless playback
- piece selection
- seed exploration
- composer-defined macros
- Focus/Create/Rest-style intent presets where appropriate
- duration/session controls
- minimal interruption

### Exit criteria

One of the Three Studies can plausibly be used as an extended coding, reading, writing, or relaxation soundtrack.

## M8 — Generative Create

### Goal

Expose the process system graphically.

### Deliverables

- process inspector
- graphical transformation chains
- independent-cycle visualization
- seed browser
- variation explorer
- macros
- scenes
- continuous signals
- additional pattern primitives

### Exit criteria

A user can turn a recorded Phrase or StepPattern into a nontrivial evolving piece without writing code.

## M9 — Code and Perform

### Goal

Make the same system effective for live coding.

### Deliverables

- Ambiente textual syntax
- parser
- formatter
- diagnostics
- editor
- hot replacement
- running-clock preservation
- scene switching
- keyboard mappings
- MIDI mappings
- performance UI

### Exit criteria

A performer can modify a running piece without stopping playback and without dropping into JavaScript or Rust.

## M10 — Capture and production

### Goal

Turn emergent performances into reproducible musical artifacts.

### Deliverables

- capture
- seed/state snapshots
- captured time regions
- reproducible playback
- MIDI export improvements
- WAV/FLAC export
- stems where architecture permits
- performance metadata

### Exit criteria

A musician can hear an interesting realization, capture it, reopen the project later, and recreate/render the same realization.

## M11 — Public web product

### Goal

Ship Ambiente as a cohesive browser experience.

### Deliverables

- landing site
- prerendered documentation
- learning material
- interactive examples
- Studio SPA
- first-party example library
- sharing/export strategy

### Documentation topics

- generative composition
- patterns
- probability
- phasing
- independent clocks
- matrix composition
- piano/phrase recording
- sound
- seeds
- performance

### Exit criteria

A new user can understand the project, learn the basics, run examples, and create a small piece entirely through the web distribution.

## M12 — Desktop

### Goal

Turn the web Studio into a serious local application.

### Deliverables

- Tauri shell
- native projects
- recent files
- filesystem integration
- native MIDI
- OSC
- native export integration
- desktop settings
- platform packaging

### Exit criteria

Projects can move between web and desktop without format conversion or semantic differences.

## M13 — MCP

### Goal

Expose Ambiente as a semantic musical tool for agents.

### Deliverables

- document inspection tools
- musical edit operations
- deterministic event queries
- variation tools
- validation
- project operations

### Exit criteria

An agent can make meaningful musical edits without writing scheduler or audio-engine code.

## M14 — Native audio, only if justified

Potential work:

- Rust DSP
- offline renderer
- native realtime audio
- plugin architecture
- advanced synthesis
- lower-latency performance

This is intentionally deferred.

Do not build a second sound engine merely because Rust makes doing so interesting.

# 20. Proposed repository shape

```text
ambiente/
├── crates/
│   ├── ambiente-core/
│   │   ├── document/
│   │   ├── time/
│   │   ├── event/
│   │   ├── material/
│   │   ├── pattern/
│   │   ├── theory/
│   │   └── operation/
│   │
│   ├── ambiente-cli/
│   ├── ambiente-wasm/
│   ├── ambiente-dsl/        # later milestone
│   └── ambiente-mcp/        # later milestone
│
├── packages/
│   ├── core/
│   │   └── ergonomic TS facade over WASM
│   ├── audio/
│   ├── sounds/
│   ├── studio/
│   └── ui/
│
├── apps/
│   ├── web/
│   │   ├── landing/
│   │   ├── docs/
│   │   ├── learn/
│   │   ├── examples/
│   │   └── studio/
│   │
│   └── desktop/
│       └── src-tauri/
│
├── examples/
│   ├── phase-study/
│   ├── drone-study/
│   └── pattern-study/
│
└── docs/
    ├── architecture.md
    ├── composition-model.md
    ├── audio.md
    └── roadmap.md
```

Do not create every empty crate on day one.

Split crates/packages only when the boundary is real.

# 21. First implementation slice

A developer beginning the reboot should **not** attempt the whole roadmap simultaneously.

The first vertical slice should be:

```text
Document
  ↓
StepPattern
  ↓
Pattern query
  ↓
Events
  ↓
WASM
  ↓
Tone.js
  ↓
Matrix UI
  ↓
Sound
```

Specifically:

1. Create a versioned Rust `Document`.
2. Add one `Piece`.
3. Add one `Voice`.
4. Add one `StepPattern`.
5. Represent pitch and musical time.
6. Query the pattern into note events.
7. Compile the same core to WASM.
8. Schedule returned events through Tone.js.
9. Build a minimal matrix editor in Solid.
10. Toggle cells and update the Rust document.
11. Play the result.
12. Save, reload, and reproduce it deterministically.

Then repeat with:

```text
Piano
  ↓
Phrase
  ↓
Events
```

Only after both work should the team begin implementing broader generative transformations.

This establishes the most important architectural property immediately:

> **Every interface is editing and playing the same Rust-owned musical document.**

# 22. Explicit non-goals for the reboot

Do not initially build:

- a full DAW
- multitrack waveform editing
- VST/AU hosting
- a large synthesizer construction environment
- hundreds of pattern operators
- AI-generated compositions
- prompt-to-song
- automatic chord progression generation as a core feature
- notation engraving
- collaborative cloud infrastructure
- accounts/authentication
- a server backend
- native DSP solely to avoid Tone.js
- MCP before the composition model is proven
- a bespoke DSL before the Rust semantic model is proven

These may eventually be valid projects.

They are not required to prove Ambiente.

# 23. Success criteria

Ambiente succeeds when all of the following are true.

### Composition

A musician can author material deliberately instead of continually asking an algorithm to invent it.

### Generation

Small transformations create long-lived variation while preserving musical identity.

### Sound

The default output is aesthetically credible without requiring immediate sound-design work.

### Interaction

Piano and matrix interfaces provide an intuitive starting point.

### Depth

The same material can graduate naturally from conventional sequencing into generative behavior.

### Listening

A finished Ambiente piece is useful even when the listener has no interest in seeing its implementation.

### Performance

A musician can manipulate a running system as an instrument.

### Reproducibility

Seeds and captures make emergent results recoverable.

### Portability

The same document semantics work in native Rust, WASM, browser, desktop, CLI, and eventually MCP.

### Scope

The engine stays comprehensible enough that musical thinking remains more important than framework machinery.

# 24. Architectural invariants

Treat these as constraints when evaluating implementation choices.

1. **Rust owns canonical musical state.**
2. **The event stream is backend-independent.**
3. **Patterns are deterministic for a given input span and seed.**
4. **Theory assists patterns; it does not define the whole composition model.**
5. **A Voice is more fundamental than a DAW Track.**
6. **Piano, Matrix, graphical editors, code, CLI, and MCP manipulate the same semantic model.**
7. **Web and desktop share Studio code.**
8. **Realtime Web Audio implementation details do not leak into persisted compositions.**
9. **Generated variation remains bounded by authored intent.**
10. **Musical quality gates platform/feature expansion.**
11. **Listen, Create, and Perform are views of the same piece rather than separate products.**
12. **Complexity must justify itself musically.**

If a proposed feature violates several of these invariants, reconsider the design before implementing it.

# 25. References

[^1]: SuperCollider 3.14 documentation, _A Practical Guide to Patterns — What Is Pbind?_ and _Composition of Patterns_. SuperCollider's model separates streams/patterns that produce values from generalized Events and from the actions used to play those Events.

[^2]: Strudel documentation, _Patterns_ and _REPL_. Strudel models a pattern as a time-span query producing events and has its scheduler repeatedly query the active pattern, enabling live replacement while the clock continues running.

[^3]: Sonic Pi documentation, _Tutorial_. Sonic Pi's live-coding environment and explicitly seedable pseudo-random streams demonstrate the musical value of reproducible variation.

[^4]: Intermorphic, _Wotja 25 User Guide_. Wotja describes itself as a live generative music and MIDI system supporting ambient soundscapes, drones, experimental/adaptive music, generator networks, rules, and listener-driven generation.

[^5]: Generative.fm documentation, _Introduction_, and the open-source Generative.fm generator collection. Generative.fm separates a playback product from individual human-authored generative music systems; its published generators have historically used Tone.js for browser scheduling/audio.

[^6]: Brain.fm product documentation. Brain.fm organizes playback around listener purposes such as focus, relaxation, and sleep and deliberately presents a much simpler interface than a composition environment. Ambiente should take inspiration from this product abstraction, not assume or reproduce Brain.fm's proprietary acoustic/neuroscience techniques.

[^7]: Endel, _Personalized, real-time sound generation_. Endel describes an architecture where its sound team pre-designs sound elements and soundscape logic while runtime contextual inputs alter the resulting soundscape in real time.

[^8]: Tone.js documentation. Tone.js provides a Web Audio framework with synchronized scheduling, a transport, synthesis primitives, effects, and control signals. These are suitable browser-audio infrastructure while composition semantics remain outside Tone.js.

[^9]: The `wasm-bindgen` Guide. `wasm-bindgen` supports higher-level Rust/JavaScript interoperability and automatic generation of TypeScript bindings for exported Rust functionality.

[^10]: Vike documentation, _Pre-rendering (SSG)_ and _Render Modes_. Vike supports prerendered static pages and client-rendered SPA pages within the same application, including prerendering the HTML shell of SPA routes for static hosting. `vike-solid` provides its Solid integration.

[^11]: Tauri 2 documentation, _Frontend Configuration_. Tauri treats its frontend conceptually as static web content and can host HTML, CSS, JavaScript, and WASM, making the shared Solid/WASM Studio suitable for both browser and desktop distribution.
