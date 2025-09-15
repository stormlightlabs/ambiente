# Reactive Audio Engine

The AudioEngine class provides a reactive audio system built on Tone.js and RxJS for ambient music generation.

## Core Architecture

The engine uses reactive streams to manage audio state, timing, and pattern playback.
All state changes flow through RxJS observables, enabling declarative audio programming and real-time responsiveness.

### Key Components

**State Management**: Central state stream (`state$`) manages playbook status, tempo, key/mode, volume, and active instruments.
State updates trigger cascading reactive changes throughout the system.

**Clock System**: Tempo-based timer stream (`clock$`) drives pattern playback and chord progression timing.
The clock converts BPM to millisecond intervals and provides the rhythmic foundation.

**Chord Progression**: Generates harmonic sequences based on current key and mode using music theory utilities from `src/lib/theory.ts`.
Progressions update automatically when key or mode changes.

**Pattern Engine**: Maps instrument patterns to the clock stream, triggering note events at precise timing intervals.
Each instrument type maintains its own pattern with configurable steps, velocities, and durations.

**Synthesis Layer**: Manages Tone.js PolySynth instances for each active instrument type.
Instruments connect through the ambient mixer with appropriate effects chains.

## State Flow

State changes propagate through reactive streams:

1. User actions call public methods (togglePlayback, setTempo, etc.)
2. Methods update the central state observable
3. Derived streams react to state changes
4. Audio synthesis responds to stream events
5. Events are emitted for external monitoring

## Instrument System

The engine supports multiple instrument types from `src/lib/audio.ts`:

- **Pad**: Harmonic foundation with reverb and chorus
- **Atmosphere**: Sparse ethereal textures with extended reverb
- **Lead**: Melodic lines with delay and filtering
- **Bass**: Low-end foundation with compression
- **Texture**: Complex ambient layers with multiple effects
- **Percussion**: Rhythmic elements with compression and reverb

Each instrument type automatically receives appropriate effect processing through the ambient mixer connection in `ambientMixer.connectSynth()`.

## Pattern Generation

The `createDefaultPattern` function generates instrument-specific patterns:

- **Pad**: Sustained chords on downbeats (every 8 steps)
- **Atmosphere**: Very sparse notes (every 16 steps) with long durations
- **Bass**: Root note emphasis (every 4 steps)
- **Default**: Moderate activity (every 4 steps)

Patterns use the current scale and adapt to key/mode changes automatically.

## Harmonic Processing

The `harmonizeNote` method in src/lib/audio-engine.ts:174 provides intelligent note selection:

- Pad and Atmosphere instruments use chord tones from the current progression
- Other instruments play their original pattern notes
- This creates natural harmonic movement as chord progressions evolve

## Observable Streams

**Public Observables**:

- `getState$()`: Complete engine state
- `getEvents$()`: Audio events (play, pause, chord changes, etc.)
- `getChordProgression$()`: Current harmonic sequence
- `getCurrentChord$()`: Active chord notes

**Internal Streams**:

- `clock$`: Rhythmic timing pulses
- `chordProgression$`: Generated harmonic sequences
- `patterns$`: Instrument pattern definitions

## Lifecycle Management

**Initialization**: Constructor sets up all reactive streams and begins monitoring state changes.
Audio context remains suspended until first play action.

**Cleanup**: The `dispose()` method properly cleans up all resources:

- Completes RxJS subscriptions via `destroy$` subject
- Disposes all Tone.js synthesizer instances
- Cleans up ambient mixer and transport resources

## Parameter Automation

The `automateParameter` method provides dynamic sound shaping by targeting nested synthesizer parameters.
Uses reflection to access parameter paths like "envelope.attack" and applies smooth transitions over specified durations.

## Usage Pattern

Create engines using factory functions:

- `new AudioEngine(initialState)`: Custom configuration
- `createAmbientAudioEngine(initialState)`: Ambient-focused preset with slower tempo, minor mode, and atmospheric instrument selection

The engine maintains reactive state throughout its lifecycle, responding immediately to user interactions while providing smooth audio transitions.
