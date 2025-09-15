# Music Theory Foundation

The music theory system provides core primitives for generating ambient music with proper harmonic relationships and theoretical foundations.

## Core Components

### Note System

`Note` enum defines chromatic notes from C (0) to B (11) using semitone values.
The system uses enharmonic equivalents focusing on sharps rather than flats for computational simplicity.

### Modes and Scales

Seven church modes are supported through the `Mode` enum, each with distinct interval patterns stored in `SCALE_PATTERNS`.
The `generateScale()` function creates scales from any root note and mode combination.

Mode characteristics for ambient music:

- **Ionian** (Major): Bright, resolved feeling
- **Dorian**: Minor with raised 6th, medieval quality
- **Aeolian** (Natural Minor): Dark, melancholic
- **Lydian**: Major with raised 4th, dreamy/ethereal
- **Mixolydian**: Dominant character, folk-like

### Chord Generation

Nine chord types cover basic triads through seventh chords. The `generateChord()` function builds chords using interval patterns from `CHORD_PATTERNS`.
Diatonic chord generation creates harmonic relationships within scales.

### Chord Progressions

Pre-defined progressions in `AMBIENT_PROGRESSIONS` provide common harmonic movements:

- Classic I-vi-IV-V for resolution
- Emotional vi-IV-I-V for tension/release
- Modal I-bVII-IV-I for ambient textures

## Functional Architecture

### Note Relationships

`NoteRelations` provides interval calculations, consonance checking, and relative note finding.
The `isConsonant()` function identifies stable intervals for ambient harmony.

### Harmonic Analysis

`HarmonicAnalysis` offers key detection from note collections, chord function analysis, and tension mapping for progressions.
The tension analysis helps create dynamic ambient arrangements.

### Utility Functions

`NoteUtilities` handles conversions between different note representations:

- String names to enum values
- MIDI note numbers with octave handling
- Display formatting for UI components

## Usage Patterns

The system follows functional programming principles with pure functions returning immutable data structures.
All functions accept simple parameters and return predictable results without side effects.

Scale generation feeds into chord progression creation, which can be analyzed for harmonic content and tension curves.
This pipeline supports the reactive audio architecture using RxJS streams.

## Integration Points

- **Audio Engine**: Note enums map directly to Tone.js frequency values
- **UI Components**: Scale and chord data drives parameter controls
- **Preset System**: Harmonic analysis determines mood-based mappings
- **Step Sequencer**: Diatonic relationships guide pattern generation
