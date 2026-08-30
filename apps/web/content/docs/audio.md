---
title: Audio
description: How events become browser audio without changing the composition model.
order: 4
---

# Audio

The Rust core describes musical events without choosing how they sound. An audio
runtime turns those events into instruments, samples, parameter changes, routing,
and effects.

```text
Rust/WASM
    ↓
event queries
    ↓
TypeScript scheduler
    ↓
Tone.js / Web Audio
    ↓
instruments + samples + effects
```

Because playback sits outside the document model, the same piece can drive
browser audio, MIDI, OSC, visualization, native synthesis, or offline rendering.

## Browser-first runtime

The first real-time backend uses Web Audio with Tone.js. Web Audio provides an
audio graph and a high-precision audio clock. Tone.js adds a transport,
future-time scheduling, synths, effects, and control signals.[^web-audio]
[^tone]

Tone.js is playback infrastructure, not part of Ambiente's composition model.
The core never creates a `Tone.Sequence`, stores a Tone instrument, or evaluates
a Tone callback. It returns events with musical timing and symbolic targets; the
TypeScript runtime maps them to the active audio graph.

The first real-time backend will run in the browser. Ambiente does not need
native real-time DSP until a musical workflow exposes a browser limitation.

## Scheduling

The scheduler queries a short span ahead of the transport, converts each event to
audio-context time, and schedules it before it must play. It neither renders an
endless piece from time zero nor keeps pattern state inside Tone.js.

The scheduler owns:

- mapping the Ambiente transport position to audio-context time;
- choosing and advancing the look-ahead query window;
- deduplicating events returned by overlapping queries;
- scheduling note-on and note-off behavior;
- creating and updating parameter automation;
- handling start, stop, pause, resume, and seek;
- applying document changes without resetting unrelated playback state;
- releasing or cancelling audio nodes when events leave the active schedule.

The core owns event inclusion, ordering, and overlap semantics. The scheduler
must not infer a second set of pattern rules.

A query horizon must be long enough to absorb ordinary main-thread delays and
short enough for edits to become audible promptly. Its exact duration is a
runtime setting established through measurement, not persisted musical data.

## Audio lifecycle

Browsers block audio until a user gesture starts or resumes the audio context.
Tone.js documents the same requirement for `Tone.start()`, and MDN recommends
creating or resuming an audio context from a user action.[^tone] [^autoplay]
The Studio therefore treats audio readiness as explicit state.

The runtime progresses through states such as:

```text
uninitialized → starting → ready → running
                            ↕       ↕
                         suspended  stopped
```

Starting audio is asynchronous and can fail. The UI reports the error and lets
the user try again. Loading a document never starts sound. Play, pause, stop,
mute, and volume remain explicit controls.

Stopping releases active notes and scheduled work. Pausing preserves the musical
position. Seeking rebuilds audible state at the destination, including events
that began before the exact seek point when the core reports them as active.

## Sounds and voices

A persisted voice contains a stable symbolic `SoundRef` and backend-independent
parameters. The browser sound library resolves that reference to a concrete
instrument or sample graph.

The browser sound library provides six stable semantic presets:

- `felt-piano` for a felt or piano-like voice;
- `glass` for a bell or glass voice;
- `warm-drone` for sustained tones;
- `soft-pluck` for short plucked notes;
- `air` for a noise texture;
- `percussion` for simple percussion.

A stable ID names the intended sound, not a Tone.js class. A preset can change
its implementation while keeping its documented musical role. If a sound is
missing, the runtime reports a diagnostic and uses a defined fallback or silence;
the document remains valid.

Gain, pan, filter, and effects belong to the audio adapter when they describe
rendering. The browser adapter maps integer `gain` and `reverb` values from
0–100, `pan` values from -100–100, and `filter_hz` values from 80–20,000 Hz.
Backend-specific node topology, sample URLs, buffer state, audio context IDs, and
scheduling handles are never serialized in the document.

## Samples and assets

Short musical samples are normally fetched and decoded into audio buffers,
which gives the runtime precise control. Long recordings may later use streaming
media elements where that trade-off is appropriate. MDN distinguishes these two
loading paths: media elements provide streaming, while decoded buffers provide
more direct control.[^audio-loading]

Asset loading is asynchronous. Playback should expose loading and failure state,
avoid partially initialized instruments, and cache decoded assets within the
runtime. The document refers to an asset by a stable semantic ID or portable project
reference, never by a temporary URL.

Licenses and attribution must accompany every shipped sample. The initial
palette should be curated for the Three Studies rather than expanded by preset
count.

## Determinism and audio output

Determinism applies to the event stream. The same document, seed, and time span
must yield identical normalized events in native Rust and WASM.

Rendered audio can differ across browsers, operating systems, devices, sample
rates, effects, and backend implementations. Determinism therefore applies to
the events, not to identical output samples. A capture preserves the musical
realization; an exported audio file preserves one rendering of it.

Audio adapters must not add compositional randomness. If a sound needs random
variation that affects reproducibility, its random inputs must come from event
properties or another explicit deterministic seed supplied by the core.

## MIDI, OSC, and visualization

MIDI and OSC are sibling event adapters, not layers beneath browser audio. A
note event can map to MIDI note messages; parameter events can map to control
changes where the target declares such a mapping. Unsupported events produce a
defined warning or omission rather than being coerced into note data.

Visualization can consume the same event stream and inspection data. It must not
be the authority for transport or process state.

## Native and offline audio

A concrete need for lower latency, device access, headless rendering, plugins,
advanced DSP, or reliable offline export may justify a native backend. Until the
browser or the Three Studies exposes such a limit, Ambiente maintains one sound
engine.

If a native backend is added, it implements the same event-adapter boundary. It
does not move composition semantics out of `ambiente-core` or introduce a
native-only document format.

[^web-audio]: [MDN, _Web Audio API_](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

[^tone]: [Tone.js documentation](https://tonejs.github.io/)

[^autoplay]: [MDN, _Web Audio API best practices: Autoplay policy_](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices#autoplay_policy)

[^audio-loading]: [MDN, _Web Audio API best practices: Loading sounds/files_](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices#loading_soundsfiles)
