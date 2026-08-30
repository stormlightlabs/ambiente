---
title: Audio
description: Browser playback, scheduling, sound adapters, and deterministic event boundaries.
order: 4
---

# Audio

Ambiente separates composition from sound production. The Rust core emits
backend-independent events. An audio runtime maps those events to instruments,
samples, parameters, routing, and effects.

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

This boundary lets the same piece drive browser audio, MIDI, OSC,
visualization, native synthesis, or offline rendering without changing its
persisted musical structure.

## Browser-first runtime

The first real-time backend uses Web Audio with Tone.js. Web Audio provides an
audio graph and a high-precision audio clock. Tone.js adds a transport,
future-time scheduling, synths, effects, and control signals.[^web-audio]
[^tone]

Tone.js is infrastructure rather than Ambiente's composition model. The core
does not ask JavaScript to create a `Tone.Sequence`, persist a Tone instrument,
or evaluate a Tone callback. It returns generalized events with musical timing
and symbolic targets. The TypeScript runtime translates them to the active
audio graph.

The browser backend is sufficient for the first product proof. Native real-time
DSP is not a reboot prerequisite.

## Scheduling

The scheduler repeatedly queries a short span ahead of the current transport
position. It then converts event time to the audio context clock and schedules
work in advance. It does not render an endless piece from time zero or keep the
canonical pattern state inside Tone.js.

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

Starting audio is asynchronous and can fail. The UI reports the failure and
allows another user-initiated attempt. Loading a document must not start sound.
Play, pause, stop, mute, and volume remain available controls.

Stopping releases active notes and scheduled work. Pausing preserves the musical
position. Seeking rebuilds audible state at the destination, including events
that began before the exact seek point when the core reports them as active.

## Sounds and voices

A persisted voice contains a stable symbolic `SoundRef` and backend-independent
parameters. The browser sound library resolves that reference to a concrete
instrument or sample graph.

Initial sound roles are deliberately few:

- felt or piano-like;
- bell or glass;
- warm drone;
- soft pluck;
- noise or air texture;
- simple percussion.

Stable IDs describe the intended sound within Ambiente, not a Tone.js class.
Presets can change implementation while preserving their documented musical
role. A missing sound produces a diagnostic and a defined fallback or silence;
it must not corrupt the document.

Gain, pan, filter, and effects belong to the audio adapter when they describe
rendering. A voice can persist semantic parameters that an adapter maps to those
controls. Backend-specific node topology, sample URLs, buffer state, audio
context IDs, and scheduling handles are never serialized in the document.

## Samples and assets

Short musical samples are normally fetched and decoded into audio buffers,
which gives the runtime precise control. Long recordings may later use streaming
media elements where that trade-off is appropriate. MDN distinguishes these two
loading paths: media elements provide streaming, while decoded buffers provide
more direct control.[^audio-loading]

Asset loading is asynchronous. Playback should expose loading and failure state,
avoid partially initialized instruments, and cache decoded assets within the
runtime. The canonical document refers to an asset by a stable semantic ID or
portable project reference rather than a transient URL.

Licenses and attribution must accompany every shipped sample. The initial
palette should be curated for the Three Studies rather than expanded by preset
count.

## Determinism and audio output

Determinism applies to the event stream. The same document, seed, and time span
must yield identical normalized events in native Rust and WASM.

Rendered samples are not expected to be bit-identical across browsers, operating
systems, audio devices, or future backend implementations. Web Audio engines,
sample rates, effects, and floating-point DSP can differ. A capture therefore
preserves musical realization state. An exported audio file preserves one
specific rendering of that state.

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

A native backend may become justified by a concrete need for lower latency,
device access, headless rendering, plugins, advanced DSP, or reliable offline
exports. Until browser audio and the Three Studies expose such a limitation,
Ambiente does not maintain a second sound engine.

If a native backend is added, it implements the same event-adapter boundary. It
does not move composition semantics out of `ambiente-core` or introduce a
native-only document format.

[^web-audio]: [MDN, _Web Audio API_](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

[^tone]: [Tone.js documentation](https://tonejs.github.io/)

[^autoplay]: [MDN, _Web Audio API best practices: Autoplay policy_](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices#autoplay_policy)

[^audio-loading]: [MDN, _Web Audio API best practices: Loading sounds/files_](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices#loading_soundsfiles)
