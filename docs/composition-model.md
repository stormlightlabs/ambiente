# Composition model

Ambiente represents a human-authored musical system that can produce many
performances. The model preserves authored identity while allowing controlled,
repeatable variation.

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

The model is not a canonical `Song → Track → MIDI notes` hierarchy. That shape
would make sequenced note music primary and force drones, unpitched sound,
continuous control, field recordings, and independent clocks into exceptions.

## Principles

### Authorship comes before generation

The musician supplies phrases, steps, pitch sets, samples, sounds, process
choices, and limits. Processes develop that material rather than inventing an
entire song from a scale, genre, chord progression, or prompt.

A restrained process chain is a useful default:

```text
phrase
  → omit(0.08)
  → rotate(every 7 cycles)
  → transpose(sometimes(0.04), octave)
```

This preserves more identity than independently generating a random melody,
bass line, harmony, and rhythm.

### Theory is a set of tools

Pitch, pitch class, interval, tuning, scale, chord, voicing, pitch set, register,
and voice leading help processes make meaningful decisions. They do not define
the document hierarchy. A piece with no conventional harmony must fit the same
model as a pitched piece.

### Patterns describe behavior over time

A pattern can be queried rather than run as a hidden mutable sequencer:

```text
Pattern + TimeSpan + Seed → Events
```

The result for a given input is deterministic. The pattern does not know whether
the events will reach Web Audio, MIDI, OSC, an offline renderer, or a
visualization. Querying a span also lets tools inspect and test music without
real-time playback.

Strudel uses a related model in which a pattern is a function of a time span and
returns events that intersect it. Its scheduler repeatedly queries future spans,
which also permits replacing a live pattern while preserving the running
clock.[^strudel-patterns]

### Time is not always metric

The transport supports beats, cycles, tempo, and meter where the music needs
them. It must also support absolute durations such as 17.2 seconds, 23.8
seconds, or four minutes. A drone or phasing process does not need to pretend
that every duration is synchronized to a beat grid.

Metric and absolute-time processes can coexist. Conversion requires an explicit
transport context; absolute time does not silently acquire a tempo.

### Randomness is reproducible

Every stochastic choice derives from an explicit seed hierarchy. Given the same
document, root seed, and queried time span, every supported runtime returns the
same normalized events.

Sub-seeds should isolate unrelated choices. Adding a visual property or editing
one voice should not scramble all random decisions in another voice unless the
composition explicitly couples them. A seed selects a realization; it does not
replace authored structure.

Sonic Pi's tutorial uses deterministic random streams so that repeated runs can
reproduce musical choices, while changing the seed explores another sequence.
That behavior is valuable for both composition and performance.[^sonic-pi-rand]

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

A document initially contains one piece. Keeping the persisted wrapper distinct
from the playable piece leaves room for schema and project concerns without
putting them into musical state.

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
voice references material or patterns, a symbolic sound, parameters, and routing
information. An interface may display voices as tracks when that layout helps,
but `Track` is not a canonical persisted type.

### Pattern

Composable behavior that maps source material and time into events. The first
vocabulary stays small:

- structural: sequence, stack, repeat, cycle;
- temporal: shift, stretch, slow, fast, phase;
- transformations: rotate, reverse, transpose, invert, omit, duplicate, map;
- selection: choose, weighted choice, alternate, shuffle, walk;
- conditional: sometimes, rarely, every, within.

Signals such as sine, triangle, envelope, deterministic noise, and random walk
can later provide continuous control. New operators must earn their place in a
real composition. SuperCollider's pattern guide is a useful precedent for
composing value streams and event patterns, but Ambiente does not copy its API
or execution model.[^supercollider-patterns]

### Event

A time-bounded instruction emitted by a pattern. An event has a span, target,
kind, and extensible properties. Kinds can include note, sample, parameter,
scene, and control. Events are not MIDI messages and contain no Tone.js object.
An adapter may translate suitable events to those systems.

Query boundaries must be precise. An event that starts before a requested span
but overlaps it may need to be returned so a renderer can reconstruct active
state. Exact inclusion, clipping, ordering, and deduplication rules belong to the
core API before the pattern engine is considered stable.

### Scene

A named state or transition target such as Opening, Dense, Still, or Ending.
Scenes provide large-scale structure without requiring a linear arrangement.
They can change voice activity, process values, macros, and other declared
state. Transition behavior must be explicit.

### Macro

A control published by the composer. A macro maps one listener-facing value to
one or more lower-level parameters or process values. Names such as density,
space, brightness, motion, and intensity are conventions, not universal engine
semantics. Each piece defines what its macros mean and the range in which they
operate.

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

Interfaces edit documents through named operations such as adding a voice,
updating material, inserting a note, setting a matrix cell, or changing a seed.
Operations provide one place to check references, ranges, schema rules, and
musical preconditions. They also create a stable basis for undo, CLI commands,
live editing, and MCP tools.

Validation reports all useful independent failures in one pass. Diagnostics
identify the object and field, explain the violated rule, and include a
correction when one is known. Persisted sound references and parameter names
remain symbolic so validation does not depend on a particular audio runtime.

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

[^sonic-pi-rand]: [Sonic Pi tutorial, _Randomisation_](https://sonic-pi.net/tutorial.html#section-8)

[^supercollider-patterns]: [SuperCollider, _A Practical Guide to Patterns_](https://doc.sccode.org/Tutorials/A-Practical-Guide/PG_01_Introduction.html)
