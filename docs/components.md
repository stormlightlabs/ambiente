# Component Architecture

## Overview

The component system follows a strict prop-based architecture pattern, eliminating the anti-pattern of passing entire state objects to child components.
Each component receives only the specific data and callbacks it needs for its functionality.

## Component Structure

### AmbientMusicPlayer

Root component that manages the overall application layout and coordinates child components.
Acts as the primary state coordinator, extracting specific data from `AppStateManager` and passing targeted props.

**Key Responsibilities**:

- Tab navigation between Player and Composer views
- State delegation to child components
- Layout and visual structure

**Props Passed Down**:

- Audio state objects with only required fields
- Specific callback functions bound to the state manager
- Status flags for UI state management

### PlayerControls

Primary playback interface providing transport controls and parameter adjustment.
Receives precisely-typed audio state and specific callback functions.

#### Props

- `audioState`: Audio playback state (tempo, volume, playback status, etc.)
- `canUndo/canRedo`: History navigation state
- `onTogglePlayback`: Playback control callback
- `onSetVolume/onSetTempo`: Parameter adjustment callbacks
- `onUndo/onRedo`: History navigation callbacks

#### Features

- Play/pause/stop transport controls
- Real-time tempo and volume adjustment
- Keyboard shortcuts for common operations
- Undo/redo history navigation
- Live status display (chord progression, instrument count)

### PresetPlayer

Preset management interface for loading and applying predefined musical configurations.
Operates on current instrument state and preset selection logic.

#### Props

- `currentInstruments`: Set of active instruments
- `onSetSelectedPreset`: Preset selection callback
- `onSetTempo/onSetKeyAndMode/onSetVolume`: Parameter callbacks
- `onToggleInstrument`: Instrument toggle callback

#### Features

- Browsable preset library with theme filtering
- Automatic configuration application (tempo, key, mode, instruments)
- Preset comparison and selection visualization
- Current preset status display

**UI Transitions**:

- Slide transition (300ms) for current preset section appearance/removal
- Fade transition (200ms) for ambient texture configuration panel

### CompositionCreator

Advanced composition interface for real-time musical parameter control.
Provides granular control over all musical aspects with live preview.

#### Props

- `audioState`: Complete audio state for real-time display
- `onSetTempo/onSetKeyAndMode/onSetVolume`: Parameter control callbacks
- `onToggleInstrument`: Instrument selection callback

#### Features

- Real-time parameter adjustment with immediate audio feedback
- Scale visualization based on current key and mode
- Instrument selection with visual feedback
- Preset application (default and ambient configurations)
- Live status monitoring (playback state, active instruments)

### ChordDisplay

Real-time chord progression visualization component that shows the current chord name and progression context.
Provides intelligent chord analysis and visual progression tracking.

#### Props

- `currentChordNotes`: Array of Note values representing the active chord
- `currentChordIndex`: Zero-based index of the current chord in the progression
- `key`: Root key of the current musical context
- `mode`: Modal context for chord analysis
- `progressionName`: Optional progression name (defaults to 'classic')

#### Features

- Automatic chord name recognition using music theory analysis
- Visual progression display with current chord highlighting
- Support for multiple chord types (major, minor, diminished, augmented, sus, 7th chords)
- Real-time updates synchronized with audio engine chord changes
- Compact display showing progression context and current position

**Integration**:

- Used within PlayerControls to replace basic chord index display
- Subscribes to audio engine chord changes through AppStateManager
- Leverages ChordAnalysis utility from theory module for intelligent naming
- Displays progression based on current key/mode and selected progression type

### PlaybackDisplay

Real-time playback monitoring component that provides live activity tracking during audio playback.
Shows current musical state and instrument activity with visual feedback.

#### Props

- `isTracking`: Boolean indicating if playback monitoring is active
- `currentPreset`: Optional string name of active preset
- `currentChord`: Array of Note values for active chord
- `activeInstrumentsList`: Array of InstrumentActivity objects with timing data
- `currentlyPlayingNotes`: Array of Note values currently sounding
- `recentEvents`: Array of PlaybackEvent objects for activity history
- `startTime`: Optional timestamp for session duration tracking

#### Features

- Live chord progression display with note visualization
- Active instrument monitoring with activity indicators
- Real-time event stream showing note and chord changes
- Session duration and event count tracking
- Visual activity indicators with color-coded timing

#### UI Transitions

These use the svelte transition API

- Slide transition (400ms) for main tracking container activation
- Fade transition (250ms) for current preset display
- Slide transitions (300ms) for chord, instruments, playing notes, and events sections
- Fade transitions (200ms) for session info and inactive state messages

## Architecture Benefits

### Prop Specificity

Each component receives exactly the data it needs:

- No unused state access
- Clear data dependencies
- Easier testing and mocking
- Reduced coupling between components

### Callback Binding

State manager methods are bound and passed as specific callbacks:

- Type-safe function signatures
- Clear action boundaries
- Easier debugging and tracing
- Consistent state update patterns

### Component Isolation

Components are self-contained with explicit interfaces:

- No hidden dependencies on global state
- Predictable data flow
- Easier refactoring and maintenance
- Clear testing boundaries

## State Flow Pattern

1. **User Interaction**: Component receives user input (clicks, keyboard, etc.)
2. **Callback Invocation**: Component calls appropriate prop callback
3. **State Update**: Callback updates state through AppStateManager
4. **Reactive Update**: Audio engine and UI state react to changes
5. **Prop Update**: Parent re-renders with new prop values
6. **Component Update**: Child components react to new props

## Testing Strategy

### Component Testing

Each component can be tested in isolation:

- Mock prop objects and callbacks
- Test UI interactions and render states
- Verify callback invocation with correct parameters
- Test keyboard shortcuts and edge cases

### Integration Testing

State flow testing through the component hierarchy:

- Verify correct prop extraction from state manager
- Test callback binding and invocation
- Validate state synchronization across components
- Test complex interaction patterns

## Best Practices

### Prop Design

Create minimal, focused prop interfaces:

- Extract only required state fields
- Use specific callback function signatures
- Avoid passing entire objects when individual fields suffice
- Document prop interfaces with TypeScript types

### State Delegation

Parent components should extract and transform state:

- Convert complex state to simple prop values
- Bind callback functions at the parent level
- Maintain consistent prop naming conventions
- Handle error states at appropriate levels

### Component Boundaries

Maintain clear component responsibilities:

- Single responsibility principle for each component
- Clear data flow patterns
- Minimal cross-component dependencies
- Consistent interaction patterns
