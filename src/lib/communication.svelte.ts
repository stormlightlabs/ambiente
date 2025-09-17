import { BehaviorSubject, type Observable, type Subscription } from "rxjs";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { AudioEngine, createAmbientAudioEngine } from "./engines/audio-engine";
import { playbackBridge } from "./services/playback-bridge";
import { generateProgression, generateScale, Mode, Note, PROGRESSIONS } from "./theory";
import type { AudioEngineState, AudioEvent, RandomizationParams } from "./types/audio";
import { InstrumentType } from "./types/instruments";
import type { Preset } from "./types/presets";
import type { ComponentMessage, HistoryState, Optional, UIState } from "./types/shared";

export class AppStateManager {
  private audioEngine: Optional<AudioEngine>;
  private subscriptions: Subscription[] = [];
  private currentChordSubject = new BehaviorSubject<Note[]>([]);

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
    randomization: {
      enabled: false,
      rhythmVariability: 0.3,
      melodicVariability: 0.2,
      chordProgression: 0.1,
      patternEvolution: 0.15,
      constraintStrength: 0.7,
    },
  });

  private history = $state<HistoryState<AudioEngineState>>({ past: [], present: { ...this.audioState }, future: [] });
  private events = $state<AudioEvent[]>([]);

  constructor() {
    this.updateChordProgression();
  }

  private updateChordProgression(): void {
    const scale = generateScale(this.audioState.key, this.audioState.mode);
    const progression = generateProgression(scale, [...PROGRESSIONS.emotional]);
    if (progression.length > 0) {
      this.currentChordSubject.next(progression[0]);
    }
  }

  private ensureAudioEngine(): void {
    if (!this.audioEngine) {
      this.audioEngine = createAmbientAudioEngine();
      this.initializeStateSync();
      playbackBridge.connect(this.audioEngine);
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
      this.audioEngine.getCurrentChord$().subscribe((chord: Note[]) => {
        this.currentChordSubject.next(chord);
      }),
    );

    this.uiState.isInitialized = true;
  }

  private pushToHistory(newState: AudioEngineState): void {
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

  applyPresetTexture(texture: any): void {
    this.ensureAudioEngine();
    if (this.audioEngine) {
      this.audioEngine.applyPresetTexture(texture);
    }
  }

  applyPreset(preset: Preset): void {
    this.ensureAudioEngine();
    if (!this.audioEngine) return;

    playbackBridge.setPresetName(preset.name);

    if (preset.config.key && preset.config.mode) {
      this.setKeyAndMode(preset.config.key, preset.config.mode);
    }

    if (preset.config.tempo) {
      this.setTempo(preset.config.tempo);
    }

    if (preset.config.volume !== undefined) {
      this.setVolume(preset.config.volume);
    }

    if (preset.config.instruments) {
      const targetInstruments = new SvelteSet(preset.config.instruments);
      const currentInstruments = new SvelteSet(this.audioState.instruments);

      for (const instrument of currentInstruments) {
        if (!targetInstruments.has(instrument)) {
          this.toggleInstrument(instrument);
        }
      }

      for (const instrument of targetInstruments) {
        if (!currentInstruments.has(instrument as InstrumentType)) {
          this.toggleInstrument(instrument as InstrumentType);
        }
      }
    }

    if (preset.texture) {
      this.audioEngine.applyPresetTexture(preset.texture);
    }

    if (preset.config.randomization) {
      this.setRandomization(preset.config.randomization);
    }
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
    if (this.audioEngine) {
      this.audioEngine.setTempo(tempo);
    }
    this.audioState.tempo = Math.max(40, Math.min(200, tempo));
  }

  setKeyAndMode(key: Note, mode: Mode): void {
    if (this.audioEngine) {
      this.audioEngine.setKeyAndMode(key, mode);
    }

    this.audioState.key = key;
    this.audioState.mode = mode;
    this.audioState.currentChord = 0;

    this.updateChordProgression();
  }

  setVolume(volume: number): void {
    if (this.audioEngine) {
      this.audioEngine.setVolume(volume);
    }

    this.audioState.volume = Math.max(0, Math.min(1, volume));
  }

  toggleInstrument(instrument: InstrumentType): void {
    if (this.audioEngine) {
      this.audioEngine.toggleInstrument(instrument);
    } else {
      if (this.audioState.instruments.has(instrument)) {
        this.audioState.instruments.delete(instrument);
      } else {
        this.audioState.instruments.add(instrument);
      }
    }
  }

  automateParameter(
    instrumentType: InstrumentType,
    paramPath: string,
    targetValue: number,
    duration: string = "4m",
  ): void {
    if (this.audioEngine) {
      this.audioEngine.automateParameter(instrumentType, paramPath, targetValue, duration);
    }
  }

  setRandomization(params: Partial<RandomizationParams>): void {
    if (this.audioEngine) {
      this.audioEngine.setRandomization(params);
    } else {
      Object.assign(this.audioState.randomization, params);
    }
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

  private applyHistoryState(state: AudioEngineState): void {
    this.ensureAudioEngine();
    this.audioEngine!.setTempo(state.tempo);
    this.audioEngine!.setKeyAndMode(state.key, state.mode);
    this.audioEngine!.setVolume(state.volume);
    this.audioEngine!.setRandomization(state.randomization);

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
    return this.currentChordSubject.asObservable();
  }

  dispose(): void {
    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];

    this.currentChordSubject.complete();

    playbackBridge.dispose();

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
