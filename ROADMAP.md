# Ambiente Roadmap

## Architecture Stack

- **Music Theory**: Core primitives for scales, chords, progressions
- **Audio Engine**: RxJS + Tone.js for reactive audio logic
- **UI Framework**: Svelte 5 Runes for reactive state management
- **Persistence**: Dexie.js for browser-based data storage
- **Patterns**: Functional programming throughout

## Core Tasks

### Music Theory Foundation ✓

- Implement scale and mode generation
- Create chord progression algorithms
- Build note relationship mappings
- Develop harmonic analysis utilities

### Audio Engine ✓

- Set up Tone.js reactive streams
- Create instrument synthesis modules
- Build audio effect processing chains
- Implement real-time parameter automation

### Ambient Texture System ✓

- Continuous Texture Generation
    - Replace step-sequencer patterns with organic, evolving ambient textures
- Core Instruments:
    - `ambientPad`: Sustained harmonic layers with filter automation
    - `granular`: Textural grains with density/size/pitch modulation
    - `melodic`: Sparse melodic elements based on scale relationships
    - `harmonicDrone`: Static harmonic foundation with voice leading
    - `rhythmicPulse`: Subtle probability-based rhythmic textures
    - `fieldRecording`: Nature sounds, urban ambience textures
    - `vocalPad`: Ethereal vocal-like sustained tones
    - `arpeggiator`: Flowing melodic patterns
- Advanced Effects:
    - Spectral processing, granular delay, convolution reverb
    - Tape saturation, modulated filters, stereo imaging
    - Probability-based ornaments, adaptive dynamics
- Preset Templates: Load complete ambient configurations (Eno-style generative music)
    - All texture parameters automatable through reactive streams
    - Instruments respect current key/mode for harmonic coherence

### UI State Management ✓

- Design Svelte 5 Runes state architecture
- Create reactive audio parameter bindings
- Build component communication patterns
- Implement undo/redo functionality

### Ambient Music Player ✓

- Composition Creation UI
- Preset Player

### Data Persistence

- Add Dexie.js dependency to package.json
- Design schema for compositions, presets, and user settings
- Implement composition save/load functionality
- Create preset library management
- Add import/export for compositions (JSON format)
- Implement browser storage cleanup utilities

### Randomization System ✓

- ✓ Implement reactive randomization engine for rhythm and melody variation
- ✓ Create pattern randomizer with music theory constraints
- Add probabilistic chord progression substitutions
- Build intelligent constraint system for musical coherence
- Integrate randomization controls into player UI

### Step Sequencer (ToneMatrix inspired!)

- Build interactive grid component (4x4, 8x8, 16x16)
- Implement step pattern editing
- Add timing and synchronization with main audio engine
- Create pattern variation and randomization
- Add pattern save/load functionality
- Integrate with ambient texture system

### Visualizations

- Set up real-time audio analysis (frequency, amplitude, waveform)
- Create responsive visual components for audio feedback
- Implement particle systems for ambient visualization
- Build waveform and spectrum analyzers

## Enhancements

### Performance

- Add Web Worker support for heavy computations
- Implement efficient cleanup for disposed audio nodes

### Testing Strategy

- ✓ Set up Vitest with browser testing support
- Add comprehensive unit tests
- Add component testing
- Set up automated testing in CI/CD

### User Experience and Accessibility

- Implement keyboard shortcuts for all controls
- Add proper ARIA labels and screen reader support
- Create onboarding tutorial for new users
- Design responsive layout for mobile/tablet devices
- Add loading states and progress indicators
- Implement smooth transitions and animations

### Error Handling and Recovery

- Create error boundary components
- Implement graceful audio context recovery
    - Add user-friendly error messages and recovery actions

### Documentation and Onboarding

- Create user guide for ambient music creation
- Document all keyboard shortcuts and controls
- Add tooltips and contextual help
- Create preset library documentation
- Implement help system integration

### Deployment and Distribution

- Set up automated build and deployment pipeline
- Implement proper caching strategies
- Add PWA support for offline usage
