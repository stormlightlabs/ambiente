# Ambient Texture Instruments

The ambient texture system provides eight specialized instruments for creating evolving, organic soundscapes.
These generate continuous textures through parameter automation, generative algorithms, and advanced audio effects.

## Core Philosophy

Ambient instruments operate on **continuous texture generation** rather than discrete note patterns.
Each instrument runs continuously when enabled, creating evolving soundscapes through:

- **Parameter automation**: Real-time modulation of synthesis parameters
- **Scale awareness**: Harmonic content respects current key/mode
- **Generative behavior**: Organic variation through controlled randomness
- **Layered composition**: Multiple instruments blend to create complex textures

## Instrument Types

### AmbientPad

Sustained harmonic layers providing the foundational harmonic bed.

**Parameters:**

- `volume`: Output level (0-1)
- `filterFreq`: Low-pass filter cutoff frequency
- `resonance`: Filter resonance/Q factor
- `muted`: Bypass instrument output
- `enabled`: Include in active texture mix

**Synthesis**: Multiple detuned oscillators with slow attack/release envelopes, filtered and chorused.

### Granular

Textural grains creating atmospheric textures and movement.

**Parameters:**

- `density`: Grains per second (0.1-2.0)
- `grainSize`: Individual grain duration (0.05-0.5 seconds)
- `pitch`: Pitch offset in semitones (-12 to +12)
- `spread`: Stereo width of grain placement (0-1000ms)

**Synthesis**: Tone.js GrainPlayer with randomized grain scheduling and pitch variation.

### Melodic

Sparse melodic elements providing occasional melodic interest.

**Parameters:**

- `octave`: Base octave for melodic content (2-6)
- `volume`: Output level
- `muted`/`enabled`: Standard controls

**Synthesis**: Simple oscillator with probability-based note triggering from current scale.

### HarmonicDrone

Static harmonic foundation providing tonal center and harmonic stability.

**Parameters:**

- `changeInterval`: Chord change timing in beats (4-32)
- `voiceLeading`: Smoothness of chord transitions (0-1)
- `voiceCount`: Number of simultaneous voices (2-8)
- `spread`: Stereo placement variation (0-2.0)

**Synthesis**: Multiple sine waves with gradual frequency transitions following chord progressions.

### RhythmicPulse

Subtle rhythmic textures adding gentle temporal organization.

**Parameters:**

- `baseTempo`: Base pulse rate (30-120 BPM)
- `accentProb`: Probability of accented pulses (0-1)
- `layerCount`: Number of polyrhythmic layers (1-5)
- `tempoVar`: Tempo variation range (0-0.5)
- `syncopation`: Rhythmic displacement factor (0-1)

**Synthesis**: Filtered noise bursts with probability-based triggering and polyrhythmic layering.

### FieldRecording

Authentic field recording textures with tape characteristics and spatial processing.

**Parameters:**

- `textureType`: Recording environment ("rain", "forest", "urban", "wind", "ocean")
- `density`: Texture variation frequency (0.1-2.0)
- `filterFreq`: Low-pass filter cutoff for environmental character
- `reverb`: Environmental reverb amount (0-1)
- `fadeTime`: Texture transition smoothness (1-10 seconds)

**Synthesis**: Pink/brown/white noise through configurable filtering with tape saturation and stereo imaging effects for authentic field recording character.

### VocalPad

Ethereal vocal-like sustained tones with harmonic processing.

**Parameters:**

- `formantFreq`: Vocal formant frequency (200-2000 Hz)
- `breathiness`: Air/breath character amount (0-1)
- `vibrato`: Vocal vibrato depth (0-1)
- `chorusDepth`: Ensemble vocal thickness (0-1)
- `attack`/`release`: Envelope timing for breath-like articulation

**Synthesis**: Sawtooth oscillators through formant filtering with spectral processing and convolution reverb for supernatural vocal textures.

### Arpeggiator

Flowing melodic patterns with complex texture evolution.

**Parameters:**

- `tempo`: Arpeggio rate (60-200 BPM)
- `pattern`: Note sequence ("up", "down", "upDown", "random")
- `octaveRange`: Melodic span in octaves (1-4)
- `noteDuration`: Individual note length (0.1-1.0 seconds)
- `probability`: Note triggering likelihood (0-1)
- `swing`: Rhythmic timing variation (0-0.5)

**Synthesis**: Triangle wave oscillators with granular delay, modulated filters, and probability-based ornaments for evolving melodic textures.

## Implementation Architecture

### Continuous Generation

Instead of step-sequencer patterns, instruments use interval-based scheduling through periodic evaluation of density parameters and probabilistic triggering. The granular instrument exemplifies this approach by continuously checking enablement state and density thresholds to determine grain triggering timing.

### Parameter Automation

All parameters connect to the reactive parameter system through RxJS observable subscriptions.
When density values change, the granular scheduler automatically updates its internal timing parameters to maintain responsive real-time control without audio interruption.

### Scale Integration

Instruments query current harmonic context from the audio engine to ensure melodic content remains harmonically coherent.
Scale-aware note selection uses the current scale array with randomized index selection, allowing instruments to generate melodic content that respects the established key and mode while maintaining organic variation.

## Ambient Preset System

The ambient preset system provides complete musical configurations that coordinate all eight instruments with coherent parameter relationships and artistic vision.

### Preset Architecture

Each ambient preset encapsulates a full musical configuration including tempo, harmonic content, voice synthesis parameters, audio processing chains, and structural characteristics. The `AmbientPreset` interface in `src/lib/data/presets.ts` defines comprehensive settings spanning synthesis, effects processing, generative structure, and mix parameters.

Presets include harmonic foundations through scale definitions, synthesis characteristics via voice configurations with envelope and oscillator parameters, spatial processing through reverb/delay/filter chains, and structural behavior through density, randomness, and generative patterns.

### Preset Configurations

The ambient preset library includes thematically diverse configurations spanning multiple ambient styles:

Artist-Inspired Presets: Three configurations draw inspiration from pioneering ambient composers.
Brian Eno's "Discreet Music" uses minimalist textures with pentatonic harmonic content and random-walk generation. Harold Budd's "Lovely Thunder" emphasizes sparse piano textures with hexatonic scales and Markov-chain melodic development. "Stars of the Lid" maximizes harmonic drone presence with triadic content and static-drone generation patterns.

Environmental Themes: Presets capture specific atmospheric qualities through coordinated instrument configurations.
"Cosmic Voyage" creates space-themed textures with ethereal processing and wide stereo placement. "Ancient Forest" provides organic woodland ambience through harmonic drones and natural textures. "Lucid Dreams" generates ethereal soundscapes with extensive reverb and minimal layering.

Stylistic Variations: Additional presets explore different ambient approaches.
"Steel Cathedral" combines industrial textures with mechanical rhythms using dense layering and euclidean patterns. "Gentle Current" balances melodic content with flowing harmonies through coordinated pad and drone relationships.

### Configuration Integration

The preset system provides unified ambient configurations that coordinate all musical elements through comprehensive parameter specification.
Each preset defines tempo, key/mode, instrument selection, and complete ambient instrument parameters alongside synthesis voice characteristics and generative behavior patterns.

The `AMBIENT_TO_ENGINE_MAPPING` constant bridges ambient instrument types to engine instrument types, enabling seamless integration with the audio engine.
This unified architecture supports continuous ambient generation with coordinated parameter relationships across all eight ambient instruments.

### Parameter Coordination

Ambient presets ensure musical coherence through parameter relationships across instruments.
Volume levels are balanced to create proper mix hierarchy, with pads providing harmonic foundation, granular elements adding texture, melodic instruments providing occasional interest, drones offering stability, rhythmic pulses adding subtle temporal organization, field recordings contributing environmental atmosphere, vocal pads creating ethereal harmonic layers, and arpeggiators generating flowing melodic patterns.

Harmonic parameters coordinate through shared scale definitions and voice leading settings.
Temporal parameters align through density relationships and change intervals that create natural evolution patterns without conflicting rhythmic elements.

### Preset Selection and Application

The `PresetPlayer` component provides preset browsing with theme-based filtering and automatic configuration application.
When ambient presets are selected, the system configures both the audio engine state and the ambient instrument parameters simultaneously.

Preset application updates tempo, key/mode settings, active instrument selection, effect chain assignments, and all ambient instrument parameters in a single coordinated action. This ensures immediate musical coherence without requiring manual parameter adjustment.
