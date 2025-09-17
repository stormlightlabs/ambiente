# Reactive Audio Engine

The AudioEngine class provides a reactive audio system built on Tone.js and RxJS for ambient music generation through a modular architecture that separates concerns for better maintainability and testability.

## Modular Architecture

The engine is now organized into specialized modules, each with a single responsibility:

### Core Engine (`src/lib/engines/audio-engine.ts`)

The main AudioEngine class acts as a coordinator, delegating responsibilities to specialized modules while maintaining the same public API.

### Audio Modules (`src/lib/audio/`)

- Synth Factory (`synth-factory.ts`): Creates and configures Tone.js synthesizers with instrument-specific parameters and waveforms.
- Effects (`effects.ts`): Manages effect chain creation and parameter automation utilities.
- Mixer (`mixer.ts`): Handles audio routing, channel management, and global effects through the AmbientMixer class.

### Engine Modules (`src/lib/engines/`)

- Audio Streams (`audio-streams.ts`): Manages all reactive stream setup, chord progressions, pattern randomization, and the main transport loop.
- Preset Processor (`preset-processor.ts`): Handles texture application, voice configuration, layering, and generative pattern generation.
- Instrument Manager (`instrument-manager.ts`): Manages instrument lifecycle, pattern assignment, and ambient instrument context updates.

## Key Components

- State Management: Central state stream (`state$`) coordinates between modules, with each module receiving only the observables it needs.
- Reactive Streams: Audio timing, chord progressions, and pattern randomization flow through dedicated stream management in AudioStreams.
- Synthesis Layer: Managed by InstrumentManager with proper lifecycle handling and context updates for both pattern-based and ambient instruments.
- Audio Routing: AmbientMixer provides flexible signal routing with global effects and channel management.

## State Flow

State changes propagate through the modular architecture:

1. User actions call AudioEngine public methods (`togglePlayback`, `setTempo`, etc.)
2. AudioEngine coordinates updates across specialized modules
3. AudioStreams manages reactive stream changes and timing
4. InstrumentManager handles instrument lifecycle and patterns
5. PresetProcessor applies texture configurations
6. Events flow through the central events stream for external monitoring

## Instrument System

The engine supports multiple instrument types through `src/lib/audio/synth-factory.ts`:

- Pad: Harmonic foundation with reverb and chorus
- Atmosphere: Sparse ethereal textures with extended reverb
- Lead: Melodic lines with delay and filtering
- Bass: Low-end foundation with compression
- Texture: Complex ambient layers with multiple effects
- Percussion: Rhythmic elements with compression and reverb

Each instrument type automatically receives appropriate effect processing through `AmbientMixer.connectSynth()` with effects from `createEffectsChain()`.

### Ambient Texture Instruments

The InstrumentManager handles ambient texture instruments (AmbientPad, Granular, Melodic, HarmonicDrone, RhythmicPulse, FieldRecording, VocalPad, Arpeggiator) through the ambient instrument system. These operate continuously when enabled rather than following step-sequenced patterns.
See [`docs/tone-instruments.md`](./tone-instruments.md) for detailed ambient instrument documentation.

## Pattern Generation

The `createDefaultPattern` function in `src/lib/engines/utilities.ts` generates instrument-specific patterns:

- **Pad**: Sustained chords on downbeats (every 8 steps)
- **Atmosphere**: Very sparse notes (every 16 steps) with long durations
- **Bass**: Root note emphasis (every 4 steps)
- **Default**: Moderate activity (every 4 steps)

Patterns use the current scale and adapt to key/mode changes automatically through AudioStreams.

## Harmonic Processing

The `harmonizeNote` method in `src/lib/engines/utilities.ts` provides intelligent note selection:

- Pad and Atmosphere instruments use chord tones from the current progression
- Other instruments play their original pattern notes
- This creates natural harmonic movement as chord progressions evolve through AudioStreams

## Observable Streams

### Public Observables (AudioEngine)

- `getState$()`: Complete engine state
- `getEvents$()`: Audio events (play, pause, chord changes, etc.)
- `getChordProgression$()`: Current harmonic sequence (delegated to AudioStreams)
- `getCurrentChord$()`: Active chord notes

### Internal Streams (AudioStreams)

- `chordProgression$`: Generated harmonic sequences from music theory
- `randomizedPatterns$`: Pattern variations based on randomization parameters
- Various reactive streams for tempo, volume, instruments, and scale changes

## Module Responsibilities

- `AudioEngine`: Public API coordination and module orchestration
- `AudioStreams`: Reactive stream management and timing coordination
- `InstrumentManager`: Instrument lifecycle and pattern management
- `PresetProcessor`: Texture application and voice configuration
- Audio Modules: Synthesis, effects, and mixing infrastructure

## Lifecycle Management

Initialization: AudioEngine constructor initializes all modules and delegates stream setup to AudioStreams.
Audio context remains suspended until first play action.

Cleanup: The `dispose()` method properly cleans up all module resources:

- Completes RxJS subscriptions via `destroy$` subject
- Disposes all Tone.js synthesizer instances through InstrumentManager
- Cleans up AmbientMixer and transport resources

## Parameter Automation

The `automateParameter` method provides dynamic sound shaping by targeting nested synthesizer parameters.
Uses `getNestedParam` from utilities to access parameter paths and applies smooth transitions via `ParameterAutomation`.

## Usage Pattern

Create engines using factory functions:

- `new AudioEngine(initialState)`: Custom configuration
- `createAmbientAudioEngine(initialState)`: Ambient-focused preset with slower tempo, minor mode, and atmospheric instrument selection

The modular architecture maintains reactive state throughout its lifecycle, with each module handling its specific domain while responding immediately to user interactions.
