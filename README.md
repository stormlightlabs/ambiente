# Ambiente

Reactive ambient music generator built with SvelteKit 5, RxJS, and Tone.js. Creates generative ambient music through reactive audio programming and real-time parameter automation.

## Features

### Generative Music System

- Real-time ambient music generation with multiple instrument types
- Reactive (rxjs + runes) chord progressions with automatic harmonic movement
- Pattern-based and continuous texture instruments
- Advanced audio effects including convolution reverb and granular processing

### Controls

- Real-time parameter adjustment with immediate audio feedback
- Preset library with thematic categorization and instant loading
- Live playback monitoring with visual chord and instrument tracking
- Intuitive transport controls with keyboard shortcuts

### Reactive Architecture

- RxJS-powered audio engine with declarative stream programming
- Modular instrument system supporting both sequenced and ambient textures
- Comprehensive music theory integration for intelligent harmonic content
- Component-based UI with prop-specific state management

### Audio Processing

- Web Audio synthesis using Tone.js with custom effect chains
- Advanced signal routing through AmbientMixer architecture
- Real-time parameter automation and smooth transitions
- Professional audio effects including tape saturation and spectral processing

## System Design

### UI Architecture

```mermaid
graph TB
    subgraph "Component Hierarchy"
        AMP[AmbientMusicPlayer]
        PC[PlayerControls]
        PP[PresetPlayer]
        CC[CompositionCreator]
        PD[PlaybackDisplay]
        CD[ChordDisplay]
    end

    subgraph "State Management"
        ASM[AppStateManager]
        History[Undo/Redo History]
    end

    Data[Data Layer]
    AE[Audio Engine]

    AMP --> PC
    AMP --> PP
    AMP --> CC
    PC --> PD
    PC --> CD

    PC --> ASM
    PP --> ASM
    CC --> ASM

    ASM --> History
    ASM -.->|State Changes| AE

    PP --> Data
    ASM --> Data

    classDef componentClass fill:#a499e9,stroke:#4b3f7a,stroke-width:2px,color:#1a1451
    classDef stateClass fill:#d96db0,stroke:#8e2968,stroke-width:2px,color:#1a1451
    classDef dataClass fill:#f18291,stroke:#c24d5c,stroke-width:2px,color:#1a1451
    classDef audioClass fill:#7dd3d3,stroke:#2d7a7a,stroke-width:2px,color:#1a1451

    class AMP,PC,PP,CC,PD,CD componentClass
    class ASM,History stateClass
    class Data dataClass
    class AE audioClass
```

### Audio Engine Architecture

```mermaid
graph TB
    UI[UI Layer]

    subgraph "Audio Engine Core"
        AE[AudioEngine]
        AS[AudioStreams]
        IM[InstrumentManager]
        PP_Proc[PresetProcessor]
        Utils[Utilities]
    end

    subgraph "Audio Processing"
        AM[AmbientMixer]
        SF[SynthFactory]
        Effects[Audio Effects]
        Instruments[Ambient Instruments]
    end

    subgraph "Music Theory"
        Theory[Music Theory]
        Patterns[Pattern Generation]
        Harmony[Harmonic Analysis]
    end

    UI -.->|State Changes| AE

    AE --> AS
    AE --> IM
    AE --> PP_Proc
    AE --> Utils

    IM --> AM
    IM --> Instruments
    AM --> SF
    AM --> Effects

    Utils --> Theory
    Utils --> Patterns
    PP_Proc --> Harmony

    AS -.->|RxJS Streams| AE
    AS -.->|Timing| IM

    classDef uiClass fill:#a499e9,stroke:#4b3f7a,stroke-width:2px,color:#1a1451
    classDef engineClass fill:#7dd3d3,stroke:#2d7a7a,stroke-width:2px,color:#1a1451
    classDef audioClass fill:#f4c430,stroke:#b5872e,stroke-width:2px,color:#1a1451
    classDef theoryClass fill:#d96db0,stroke:#8e2968,stroke-width:2px,color:#1a1451

    class UI uiClass
    class AE,AS,IM,PP_Proc,Utils engineClass
    class AM,SF,Effects,Instruments audioClass
    class Theory,Patterns,Harmony theoryClass
```

### Core Architecture

Built on reactive programming principles using RxJS streams for audio timing and state management. The modular audio engine coordinates specialized components while maintaining clean separation of concerns.

### Component Hierarchy

Prop-based component architecture eliminates state object passing anti-patterns. Each component receives specific data and callbacks, ensuring clear data flow and easy testing.

### Audio Engine

Modular reactive system combining pattern-based instruments with continuous ambient textures. Supports real-time parameter changes and automatic harmonic adaptation.

### State Management

AppStateManager coordinates application state with undo/redo history. Audio engine reacts to state changes via RxJS streams while components receive targeted props.

## Development

### Prerequisites

```sh
pnpm install
```

### Development Commands

```sh
pnpm dev          # Start development server
pnpm check        # Type checking
pnpm lint         # ESLint linting
pnpm test         # Run tests
```

### Production Build

```sh
pnpm build        # Build for production
pnpm preview      # Preview production build
```

## Stack

### Core

- SvelteKit 5 with static adapter (SPA mode) and runes-based reactivity
- TypeScript
- Tailwind 4

### Audio & Reactive Programming

- Tone.js 15
- RxJS 7
