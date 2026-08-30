---
title: Composition model
description: How Ambiente represents material, time, variation, and musical structure.
order: 2
---

# Composition model

An Ambiente piece combines material written by a musician with rules that can
produce many performances. The material stays recognizable while controlled,
repeatable variation changes each realization.

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

Ambiente does not reduce every piece to `Song → Track → MIDI notes`. That
hierarchy treats sequenced notes as the default and turns drones, unpitched sound,
continuous control, field recordings, and independent clocks into exceptions.

## Principles

### Authorship comes before generation

The musician writes the phrases and steps, chooses the pitches and sounds, and
sets the processes and their limits. Ambiente develops that material instead of
inventing a song from a genre, chord progression, or prompt.

A restrained process chain is a useful default:

```text
phrase
  → omit(0.08)
  → rotate(every 7 cycles)
  → transpose(sometimes(0.04), octave)
```

Because each change starts from written material, the result keeps more of the
piece's identity than independently generated melody, bass, harmony, and rhythm.

### Theory is a set of tools

Pitch, interval, tuning, scale, chord, voicing, register, and voice leading give
processes useful musical information. They do not dictate the document hierarchy.
The same model must fit both pitched music and work without conventional harmony.

### Patterns describe behavior over time

A pattern answers a query; it does not run as a hidden mutable sequencer:

```text
Pattern + TimeSpan + Seed → Events
```

The same input always returns the same result. A pattern does not know whether
its events will reach Web Audio, MIDI, OSC, an offline renderer, or a
visualization. Span queries also let tools inspect and test music without playing
it in real time.

Strudel uses a related model in which a pattern is a function of a time span and
returns events that intersect it. Its scheduler repeatedly queries future spans,
which also permits replacing a live pattern while preserving the running
clock.[^strudel-patterns]

### Time uses exact domains

Musical time and elapsed time use separate exact rational types. Neither appears
as an `f64` in the core or the document. Each domain wraps an exact rational
implementation such as `num_rational::Ratio<i64>`:[^num-rational]

```rust
struct Beats(Ratio<i64>);
struct Seconds(Ratio<i64>);

struct MetricSpan {
    start: Beats,
    end: Beats,
}

struct AbsoluteSpan {
    start: Seconds,
    end: Seconds,
}
```

`Seconds` measures elapsed time from the piece or transport origin. It is not
wall-clock time and never contains a Unix timestamp.

The document stores rational values in an Ambiente-owned string format:

```json
{ "onset": "3/2", "duration": "1/4" }
```

Fractions are reduced, denominators are positive, and whole values retain their
denominator (`"4/1"`). The format does not expose `num-rational`'s Serde
representation because the crate is an implementation detail.

Time follows these rules:

- Metric time uses quarter-note beats unless a later musical need requires
  another unit. Meter groups beats; it does not redefine the unit.
- A pattern cycle is structure, not a third implicit clock. Its length is stated
  in beats or seconds, and cycle phase or count may use another exact rational
  type. There is no global `1 cycle = 4 beats` rule.
- Absolute time uses exact rational seconds. For example, 17.2 seconds is
  represented as `86/5`, not approximated as a binary float.
- Tempo is a positive rational BPM value. At constant tempo, conversion is
  exact: `seconds = beats * 60 / bpm`.
- Metric and absolute time convert only through an explicit transport or tempo
  context.
- Time arithmetic is checked. Invalid denominators, overflow, negative
  durations, and reversed spans return errors on document input instead of
  wrapping or panicking.
- The core has no implicit `f64 -> time` constructor. Recording and device
  adapters define a quantization policy when they convert browser or hardware
  timestamps to exact time.
- `Seconds` becomes a floating-point value only at an audio or visualization
  boundary. Web Audio schedules against double-valued seconds, so that
  approximation belongs to the backend.[^web-audio-time]

Exact time gives native Rust and WASM the same query boundaries. It does not
claim that audio devices have infinite precision.

### Randomness is reproducible

The composition seed is a dedicated `Seed(u64)`. Its canonical representation
is a 16-character lowercase hexadecimal string:

```json
"seed": "000000000000002a"
```

This form preserves all 64 bits across JavaScript, where `Number` represents
integers exactly only through `2^53 - 1`.[^js-safe-integer] Interfaces may accept
decimal or hexadecimal input, but serialization always writes the canonical
form.

Use ChaCha8 as the deterministic byte generator. Rand recommends `ChaCha8Rng`
for fast, portable fixed-seed work and warns against `SmallRng` and `StdRng`
when reproducibility matters.[^rand-fixed] The ChaCha generators are portable,
deterministic, and checked against reference vectors.[^rand-chacha]

A single mutable random stream would let one edit change unrelated choices.
Instead, each stochastic decision receives a 32-byte seed derived with BLAKE3
and the fixed Ambiente context `ambiente-random-v1`:[^blake3]

```text
root seed
  + semantic object ID
  + operator identity
  + decision coordinate
  + operator-local decision key
        |
        v
BLAKE3 derive-key, ambiente-random-v1
        |
        v
32-byte ChaCha8 seed
```

The version 1 tuple uses the root seed as an 8-byte little-endian integer,
the target voice UUID and operator UUID as their 16 raw bytes, a 4-byte
little-endian coordinate count, each signed occurrence coordinate as an 8-byte
little-endian integer, and an 8-byte little-endian operator-local key. BLAKE3
derives a 32-byte key with `ambiente-random-v1`; that key seeds `ChaCha8Rng`.
Bounded integers use rejection sampling over `next_u64`, so modulo bias and
library distribution changes do not alter choices. Golden vectors fix this
encoding and sampling behavior.

Keying each choice by semantic identity and time isolates unrelated edits and
query order. Editing one voice need not scramble another, and querying `[0, 4)`
plus `[4, 8)` can agree with querying `[0, 8)`. A composition may still couple
choices explicitly. The seed selects a realization; it does not replace
authored structure.

The deterministic format includes the derivation context, tuple encoding,
ChaCha8 variant, byte order, and the mapping from random bits to bounded choices
and probabilities. Ambiente owns the small stable sampling functions used by
its operators. Rand's higher-level distributions are not persisted musical
semantics because their algorithms may change between compatible releases and
floating-point distributions can vary by platform.[^rand-repro]

Changing `ambiente-random-v1` for an existing document is a breaking semantic
change even when the Rust API remains source-compatible.

Sonic Pi also uses deterministic random streams so repeated runs reproduce
musical choices while another seed explores another sequence.[^sonic-pi-rand]

## Document hierarchy

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

A document contains one piece. The document wrapper owns file-format concerns so
they do not leak into the playable musical state.

### Document

The persisted root. It owns the schema version, stable IDs, metadata,
serialization, migration, validation, and document operations. Loading never
silently discards unknown or invalid information. Migration is explicit and
versioned.

### Piece

The playable musical system within a document. It gathers transport settings,
materials, voices, structural state, published controls, and reproducible
realizations.

### Transport

The shared context for tempo, meter, beat/cycle conversion, and loop regions.
Later versions may add a tempo map. A process can opt into metric time or use
absolute time independently.

### Material

Authored source material. Initial material types are:

- `Phrase`: arbitrary note or event material over time;
- `StepPattern`: quantized material arranged in rows and steps;
- `PitchSet`: a collection of available pitches;
- `SampleSet`: a collection of symbolic sample references.

A later workflow may justify chord sets, automation shapes, recorded controls,
or audio clips.

A piano recording creates a `Phrase`. The matrix edits a `StepPattern`. These
editors do not own private playback models in JavaScript.

### Voice

A playable role such as Piano, Halo, Tape, Rain, Kick, or Field Recording. A
voice connects material or patterns to a symbolic sound, parameters, and routing.
An interface can display voices as tracks, but `Track` is not a persisted type.

### Pattern

Composable behavior that maps source material and time into events. The core
vocabulary is deliberately small:

- structural: sequence, stack, repeat, cycle;
- temporal: shift, stretch, slow, fast, phase;
- transformations: rotate, reverse, transpose, invert, omit, duplicate, map;
- selection: choose, weighted choice, alternate, shuffle, walk;
- conditional: sometimes, rarely, every, within.

Signals such as sine, triangle, envelope, deterministic noise, and random walk
can provide continuous control. Add an operator only when a composition needs
behavior that existing operators cannot express. SuperCollider's pattern guide
shows how value streams and event patterns can compose, but Ambiente does not
copy its API or execution model.[^supercollider-patterns]

### Event

A time-bounded instruction emitted by a pattern. An event has a span, target,
kind, and extensible properties. Kinds can include note, sample, parameter,
scene, and control. Events are not MIDI messages and contain no Tone.js object.
An adapter may translate suitable events to those systems.

Queries and events use non-empty half-open spans: the start is included and the
end is excluded. A query returns an event when `event.start < query.end` and
`event.end > query.start`. It therefore includes events that start before the
query and remain active, but excludes events ending exactly at the query start
or starting exactly at the query end. Returned spans retain their original
bounds; the query does not clip them.

Metric and absolute spans are queried separately. A mixed-clock stack can
contain both, and each query returns events in its own clock without converting
through tempo. Results sort by clock, start, end, target, source, kind, and
properties, then remove exact duplicates. These rules make adjacent,
overlapping, and non-zero-start queries agree without rendering from time zero.

### Scene

A named state or transition target such as Opening, Dense, Still, or Ending.
Scenes provide large-scale structure without requiring a linear arrangement.
They can change voice activity, process values, macros, and other declared
state. Transition behavior must be explicit.

### Macro

A control published by the composer. A macro maps one visible value to one or
more parameters or process values. Names such as density, space, brightness,
motion, and intensity are conventions rather than fixed engine semantics. Each
piece defines the meaning and range of its macros.

### Capture

A reproducible realization. A capture preserves enough state to recover an
interesting performance: document revision, seed or derived state, scenes,
macro values, time range, and relevant performance operations. A capture is not
an audio recording, though it may later be rendered to one.

## Materials and editors

### Phrase

A phrase stores arbitrary note or event material with onset and duration. Piano
recording keeps the performed timing. Quantization is a later edit or
transformation, not a requirement imposed while recording.

A note phrase initially needs pitch, onset, duration, and velocity. The model
must leave room for non-note events and expressive data without requiring them
in the first slice.

### StepPattern

A step pattern stores configurable rows, steps, subdivision, pattern length, and
cell state. Rows map to pitches or another declared value domain. Active cells
can later gain velocity, probability, duration, ratchets, or arbitrary event
properties.

The matrix is one view over this data. A step pattern can feed the same process
engine as a phrase:

```text
step pattern
  → slow(2)
  → rotate(every 7 cycles)
  → omit(0.08)
```

## Operations and validation

Interfaces change documents through named operations: add a voice, update
material, insert a note, set a matrix cell, or change a seed. Each operation
checks references, ranges, schema rules, and musical preconditions. The same
operations support undo, CLI commands, live editing, and MCP tools.

Validation reports all useful independent failures in one pass. Diagnostics
identify the object and field, explain the violated rule, and include a
correction when one is known. Persisted sound references and parameter names
remain symbolic so validation does not depend on a particular audio runtime.

## Determinism tests

The composition model requires tests that prove:

- seed parsing and formatting preserve all 64 bits;
- BLAKE3 derivation and ChaCha8 sampling match fixed golden vectors;
- native Rust and WASM pass the same random vectors once WASM exists;
- rational time normalizes equivalent fractions and rejects invalid values; and
- tempo conversion and adjacent span boundaries remain exact before audio
  conversion.

If a dependency update changes a golden vector, investigate the semantic change.
Do not accept it by refreshing the snapshot.

## Glossary

`Document`
: The versioned persisted root that owns schema, IDs, migration, validation, and
one playable piece.

`Piece`
: The playable musical system in a document.

`Material`
: Authored source content, such as a phrase or step pattern.

`Voice`
: A playable role that connects musical behavior to a symbolic sound and
parameters.

`Pattern`
: Composable, deterministic behavior queried over a time span to produce events.

`Event`
: A backend-independent, time-bounded instruction produced by the core.

`Scene`
: A named musical state or transition target.

`Macro`
: A composer-published control that maps to one or more lower-level values.

`Capture`
: The state needed to replay a particular realization of a piece.

[^strudel-patterns]: [Strudel technical manual, _Patterns_](https://strudel.cc/technical-manual/patterns/)

[^num-rational]: [`num-rational`](https://docs.rs/num-rational/latest/num_rational/)

[^web-audio-time]: [MDN, `BaseAudioContext.currentTime`](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime)

[^js-safe-integer]: [MDN, `Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)

[^rand-fixed]: [The Rust Rand Book, _Fixed seed RNGs_](https://rust-random.github.io/book/quick-start.html#fixed-seed-rngs)

[^rand-chacha]: [`rand_chacha`](https://docs.rs/rand_chacha/latest/rand_chacha/)

[^blake3]: [`blake3::derive_key`](https://docs.rs/blake3/latest/blake3/fn.derive_key.html)

[^rand-repro]: [The Rust Rand Book, _Reproducibility_](https://rust-random.github.io/book/crate-reprod.html)

[^sonic-pi-rand]: [Sonic Pi tutorial, _Randomisation_](https://sonic-pi.net/tutorial.html#section-8)

[^supercollider-patterns]: [SuperCollider, _A Practical Guide to Patterns_](https://doc.sccode.org/Tutorials/A-Practical-Guide/PG_01_Introduction.html)
