# Svelte Component Communication

## Overview

The communication system bridges RxJS audio streams with Svelte 5 runes for reactive UI state management.
Core implementation in `src/lib/communication.svelte.ts`.

## Architecture

### AppStateManager

Central state manager using Svelte 5 runes pattern:

- **UI State**: View switching, recording status, preset selection
- **Audio State**: Synchronized from RxJS observables via subscription management
- **History State**: Undo/redo with command pattern implementation
- **Event Stream**: Real-time audio events for component reactivity

### ComponentCommunicator

Publish-subscribe messaging system for cross-component communication:

- Type-based message routing
- Automatic message history management (last 100 messages)
- Subscription cleanup handling

## State Management Patterns

### Reactive Bindings

Pure runes approach eliminates mixed paradigms:

- `$state` for all reactive data
- Direct RxJS subscription management via `Subscription[]`
- Explicit cleanup in `dispose()` methods

### Parameter Automation

`createParameterBinding()` provides two-way binding between UI controls and audio parameters:

- Immediate UI updates via runes
- Automated parameter changes via audio engine delegation
- Type-safe instrument and parameter path targeting

### Derived State

`createDerivedAudioState()` creates computed values from audio state:

- Reactive selectors using `$derived`
- Automatic updates when source state changes
- Read-only interface prevents accidental mutations

## Component Integration

### Global State Access

Singleton exports provide app-wide state access:

- `appState` - Main application state manager
- `componentBus` - Cross-component messaging system

### Memory Management

Proper cleanup prevents memory leaks:

- RxJS subscription tracking and disposal
- Event history size limits
- Component lifecycle integration via `dispose()`

### Undo/Redo System

Command pattern implementation:

- 50-item history buffer
- State restoration via audio engine synchronization
- Instrument toggle reconciliation for complex state

## Integration Points

### Audio Engine Bridge

Synchronizes `AudioEngineState` from RxJS streams:

- Real-time tempo, key, mode, and instrument changes
- Volume automation and effect parameter updates
- Chord progression and pattern sequence events

### UI Component Binding

Components access reactive state via:

- `appState.ui` - UI-specific state and actions
- `appState.audio` - Current audio engine state
- `appState.canUndo/canRedo` - History navigation state
- `appState.recentEvents` - Latest audio events for visualization

## Best Practices

### State Updates

All audio state changes go through audio engine methods, not direct state mutation. This ensures proper RxJS stream propagation and event emission.

### Component Messaging

Use ComponentCommunicator for loose coupling between unrelated components. Direct prop passing preferred for parent-child relationships.

### Parameter Binding

Create parameter bindings at component initialization, not in reactive blocks. This prevents subscription churn and maintains stable references.
