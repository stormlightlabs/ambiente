import type { Observable, Subscription } from "rxjs";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { InstrumentType } from "./audio";
import { AudioEngine, type AudioEngineState, type AudioEvent, createAmbientAudioEngine } from "./audio-engine";
import { Mode, Note } from "./theory";
import type { Optional } from "./types";

type ComponentMessage = { type: string; source: string; data?: unknown; timestamp: number };
type HistoryState<T> = { past: T[]; present: T; future: T[] };
type UndoableState = AudioEngineState;
type View = "composer" | "player" | "sequencer" | "visualizer";
type UIState = {
  isInitialized: boolean;
  selectedPreset?: string;
  activeView: View;
  isRecording: boolean;
  showSettings: boolean;
};

export class AppStateManager {
  private audioEngine: Optional<AudioEngine>;
  private subscriptions: Subscription[] = [];

  private uiState = $state<UIState>({
    isInitialized: false,
    selectedPreset: undefined,
    activeView: "player",
    isRecording: false,
    showSettings: false,
  });

  private audioState = $state<AudioEngineState>({
    isPlaying: false,
    tempo: 80,
    key: Note.C,
    mode: Mode.Ionian,
    currentChord: 0,
    volume: 0.7,
    instruments: new SvelteSet([InstrumentType.Pad, InstrumentType.Atmosphere]),
  });

  private history = $state<HistoryState<UndoableState>>({ past: [], present: { ...this.audioState }, future: [] });
  private events = $state<AudioEvent[]>([]);

  constructor() {
  }

  private ensureAudioEngine(): void {
    if (!this.audioEngine) {
      this.audioEngine = createAmbientAudioEngine();
      this.initializeStateSync();
    }
  }

  private initializeStateSync(): void {
    if (!this.audioEngine) return;

    this.subscriptions.push(
      this.audioEngine.getState$().subscribe((state: AudioEngineState) => {
        Object.assign(this.audioState, state);
        this.pushToHistory(state);
      }),
      this.audioEngine.getEvents$().subscribe((event: AudioEvent) => {
        this.events.push(event);
        if (this.events.length > 50) {
          this.events.shift();
        }
      }),
    );

    this.uiState.isInitialized = true;
  }

  private pushToHistory(newState: UndoableState): void {
    this.history.past.push(this.history.present);
    this.history.present = { ...newState };
    this.history.future = [];

    if (this.history.past.length > 50) {
      this.history.past.shift();
    }
  }

  get ui() {
    return this.uiState;
  }

  get audio() {
    return this.audioState;
  }

  get canUndo(): boolean {
    return this.history.past.length > 0;
  }

  get canRedo(): boolean {
    return this.history.future.length > 0;
  }

  get recentEvents(): AudioEvent[] {
    return this.events.slice(-10);
  }

  setActiveView(view: UIState["activeView"]): void {
    this.uiState.activeView = view;
  }

  setSelectedPreset(preset?: string): void {
    this.uiState.selectedPreset = preset;
  }

  toggleRecording(): void {
    this.uiState.isRecording = !this.uiState.isRecording;
  }

  toggleSettings(): void {
    this.uiState.showSettings = !this.uiState.showSettings;
  }

  async togglePlayback(): Promise<void> {
    this.ensureAudioEngine();
    await this.audioEngine!.togglePlayback();
  }

  setTempo(tempo: number): void {
    this.ensureAudioEngine();
    this.audioEngine!.setTempo(tempo);
  }

  setKeyAndMode(key: Note, mode: Mode): void {
    this.ensureAudioEngine();
    this.audioEngine!.setKeyAndMode(key, mode);
  }

  setVolume(volume: number): void {
    this.ensureAudioEngine();
    this.audioEngine!.setVolume(volume);
  }

  toggleInstrument(instrument: InstrumentType): void {
    this.ensureAudioEngine();
    this.audioEngine!.toggleInstrument(instrument);
  }

  automateParameter(
    instrumentType: InstrumentType,
    paramPath: string,
    targetValue: number,
    duration: string = "4m",
  ): void {
    this.ensureAudioEngine();
    this.audioEngine!.automateParameter(instrumentType, paramPath, targetValue, duration);
  }

  undo(): void {
    if (this.history.past.length === 0) return;

    const previous = this.history.past.pop()!;
    this.history.future.push(this.history.present);
    this.history.present = previous;

    this.applyHistoryState(previous);
  }

  redo(): void {
    if (this.history.future.length === 0) return;

    const next = this.history.future.pop()!;
    this.history.past.push(this.history.present);
    this.history.present = next;

    this.applyHistoryState(next);
  }

  private applyHistoryState(state: UndoableState): void {
    this.ensureAudioEngine();
    this.audioEngine!.setTempo(state.tempo);
    this.audioEngine!.setKeyAndMode(state.key, state.mode);
    this.audioEngine!.setVolume(state.volume);

    const currentInstruments = new SvelteSet(this.audioState.instruments);
    for (const instrument of state.instruments) {
      if (!currentInstruments.has(instrument)) {
        this.audioEngine!.toggleInstrument(instrument);
      }
    }

    for (const instrument of currentInstruments) {
      if (!state.instruments.has(instrument)) {
        this.audioEngine!.toggleInstrument(instrument);
      }
    }
  }

  getAudioState$(): Observable<AudioEngineState> {
    this.ensureAudioEngine();
    return this.audioEngine!.getState$();
  }

  getAudioEvents$(): Observable<AudioEvent> {
    this.ensureAudioEngine();
    return this.audioEngine!.getEvents$();
  }

  getCurrentChord$(): Observable<Note[]> {
    this.ensureAudioEngine();
    return this.audioEngine!.getCurrentChord$();
  }

  dispose(): void {
    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];

    if (this.audioEngine) {
      this.audioEngine.dispose();
    }
  }
}

export class ComponentCommunicator {
  private messages = $state<ComponentMessage[]>([]);
  private subscribers = new SvelteMap<string, Set<(message: ComponentMessage) => void>>();

  publish(type: string, source: string, data?: unknown): void {
    const message: ComponentMessage = { type, source, data, timestamp: Date.now() };

    this.messages.push(message);
    if (this.messages.length > 100) {
      this.messages = this.messages.slice(-100);
    }

    const typeSubscribers = this.subscribers.get(type) || new SvelteSet();
    for (const callback of typeSubscribers) callback(message);
  }

  subscribe(type: string, callback: (message: ComponentMessage) => void): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new SvelteSet());
    }

    this.subscribers.get(type)!.add(callback);

    return () => {
      this.subscribers.get(type)?.delete(callback);
    };
  }

  get recentMessages(): ComponentMessage[] {
    return this.messages.slice(-20);
  }
}

export const createParameterBinding = (
  appState: AppStateManager,
  paramPath: string,
  instrumentType: InstrumentType,
  initialValue: number,
) => {
  let value = $state(initialValue);

  const bind = {
    get value() {
      return value;
    },
    set value(newValue: number) {
      value = newValue;
      appState.automateParameter(instrumentType, paramPath, newValue);
    },
  };

  return bind;
};

export const createDerivedAudioState = <T>(
  appState: AppStateManager,
  selector: (state: AudioEngineState) => T,
): { readonly value: T } => {
  const derivedValue = $derived(selector(appState.audio));

  return {
    get value() {
      return derivedValue;
    },
  };
};
