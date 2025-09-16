# Ambiente Roadmap

## Architecture Stack

- **Music Theory**: Core primitives for scales, chords, progressions
- **Audio Engine**: RxJS + Tone.js for reactive audio logic
- **UI Framework**: Svelte 5 Runes for reactive state management
- **Persistence**: Dexie.js for browser-based data storage
- **Patterns**: Functional programming throughout

## Core Tasks

### Music Theory Foundation

- Implement scale and mode generation
- Create chord progression algorithms
- Build note relationship mappings
- Develop harmonic analysis utilities

### Audio Engine

- Set up Tone.js reactive streams
- Create instrument synthesis modules
- Build audio effect processing chains
- Implement real-time parameter automation

### Ambient Texture System

- Continuous Texture Generation
    - Replace step-sequencer patterns with organic, evolving ambient textures
- Five Core Instruments:
    - `ambientPad`: Sustained harmonic layers with filter automation
    - `granular`: Textural grains with density/size/pitch modulation
    - `melodic`: Sparse melodic elements based on scale relationships
    - `harmonicDrone`: Static harmonic foundation with voice leading
    - `rhythmicPulse`: Subtle probability-based rhythmic textures
- Preset Templates: Load complete ambient configurations (Eno-style generative music)
    - All texture parameters automatable through reactive streams
    - Instruments respect current key/mode for harmonic coherence

### UI State Management

- Design Svelte 5 Runes state architecture
- Create reactive audio parameter bindings
- Build component communication patterns
- Implement undo/redo functionality

### Ambient Music Player

- Composition Creation UI
- Preset Player

### Data Persistence

- Design Dexie.js schema for tracks and presets
- Implement CRUD operations for user compositions
- Create import/export functionality
- Build preset management system

### Step Sequencer (ToneMatrix inspired!)

- Create pattern-based sequencing instrument on 4x4, 8x8 & 16x16 grids
- Implement timing and synchronization
- Add pattern variation algorithms

### Visualizations

- Set up real-time audio analysis
- Create responsive visual components
- Implement performance optimization
- Build themeable visualization system
