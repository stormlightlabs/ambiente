# Advanced Audio Effects System

The ambient texture system now includes eight sophisticated audio effects that enhance the sonic characteristics of each instrument. These effects operate through reactive parameter streams and provide real-time audio processing capabilities.

## Effect Architecture

Each effect follows a consistent pattern with `connectInput()`, `connect()`, and `getOutput()` methods for flexible signal routing. Effects use RxJS BehaviorSubjects for reactive parameter control and implement proper disposal patterns to prevent memory leaks.

## Available Effects

### Spectral Processing

**File:** `src/lib/effects/spectral-processing.ts`

Performs real-time FFT analysis with harmonic enhancement and spectral manipulation. Features configurable window types, noise gating, and spectral shifting. The effect analyzes incoming audio using Tone.Analyser and applies frequency-domain processing to enhance harmonic content.

**Integration:** Enhanced VocalPadSynth with spectral processing for ethereal harmonic enhancement.

### Granular Delay

**File:** `src/lib/effects/granular-delay.ts`

Implements multi-grain delay processing with eight independent delay lines. Each grain has variable size, density, pitch offset, and temporal spread. The scheduler creates organic textures through probabilistic grain triggering.

**Integration:** Applied to ArpeggiatorSynth for complex echo patterns with grain-based texture evolution.

### Convolution Reverb

**File:** `src/lib/effects/convolution-reverb.ts`

Uses synthetic impulse responses to simulate various acoustic spaces. Room sizes from small to cathedral are generated algorithmically, with configurable decay times and pre-delay. The system supports loading external impulse response files when available.

**Integration:** Provides spatial depth to VocalPadSynth with medium hall characteristics.

### Tape Saturation

**File:** `src/lib/effects/tape-saturation.ts`

Authentic analog tape emulation using waveshaping, tape hiss, and flutter modulation. Features configurable drive, warmth, bias, and flutter parameters. The waveshaper creates soft clipping with even harmonic distortion for vintage character.

**Integration:** Applied to FieldRecordingSynth for authentic field recording tape characteristics.

### Modulated Filters

**File:** `src/lib/effects/modulated-filters.ts`

Dynamic filter processing with LFO and envelope modulation. Supports multiple filter types with configurable resonance, frequency, and modulation parameters. Optional envelope triggering provides rhythmic filter sweeps.

**Integration:** Creates evolving timbral changes in ArpeggiatorSynth through bandpass filtering.

### Stereo Imaging

**File:** `src/lib/effects/stereo-imaging.ts`

Advanced stereo processing with width control, Haas delay, bass mono processing, and phase manipulation.
Maintains mono compatibility for low frequencies while enhancing stereo width for higher content.

**Integration:** Enhances spatial positioning in FieldRecordingSynth for immersive field recording playback.

### Probability Ornaments

**File:** `src/lib/effects/probability-ornaments.ts`

Generates musical ornaments (trills, mordents, grace notes, slides) based on probability parameters.
The effect operates additively, layering ornamental notes over the existing audio signal with scale-aware note selection.

**Integration:** Adds subtle melodic embellishments to ArpeggiatorSynth patterns.

### Adaptive Dynamics

**File:** `src/lib/effects/adaptive-dynamics.ts`

Intelligent compression and gain management with trend analysis. Monitors signal levels over time and adjusts gain based on dynamic trends. Features look-ahead processing and adaptive gain scaling for consistent output levels.

## Integration Strategy

### Instrument Enhancement

- **VocalPadSynth**: Spectral processing + convolution reverb for ethereal vocal textures
- **FieldRecordingSynth**: Tape saturation + stereo imaging for authentic field recording character
- **ArpeggiatorSynth**: Granular delay + modulated filters + probability ornaments for complex evolving patterns

### Signal Chain Design

Effects are chained through `connectInput()` and `getOutput()` methods, allowing flexible routing while maintaining clean separation between Tone.js native nodes and custom effect processing.

### Parameter Control

All effects expose reactive parameter streams through BehaviorSubjects, enabling real-time control and automation.
Parameters are type-safe through dedicated interfaces in `src/lib/types/audio-effects.ts`.

### Performance Considerations

Effects use efficient scheduling patterns and proper resource cleanup. Real-time processing is balanced with CPU efficiency through configurable analysis windows and selective activation.

## Adding Effects

The effect system is designed for extensibility. Additional effects can be integrated by following the established pattern of reactive parameters, proper signal routing, and comprehensive disposal management.
