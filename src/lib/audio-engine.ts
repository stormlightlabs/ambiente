import { BehaviorSubject, combineLatest, Observable, Subject, timer } from "rxjs";
import { debounceTime, distinctUntilChanged, filter, map, scan, switchMap, takeUntil } from "rxjs/operators";
import * as Tone from "tone";
import {
  ambientMixer,
  createSynth,
  EffectType,
  initializeAudio,
  InstrumentType,
  noteToToneString,
  ParameterAutomation,
} from "./audio";
import { AMBIENT_PROGRESSIONS, generateProgression, generateScale, Mode, Note } from "./theory";

export interface AudioEngineState {
  isPlaying: boolean;
  tempo: number;
  key: Note;
  mode: Mode;
  currentChord: number;
  volume: number;
  instruments: Set<InstrumentType>;
}

export type AudioEventKind = "play" | "pause" | "stop" | "chord-change" | "parameter-change" | "instrument-toggle";
export interface AudioEventData {
  chord?: Note[];
  index?: number;
  instrument?: InstrumentType;
  enabled?: boolean;
  [key: string]: unknown;
}

export type AudioEvent = { type: AudioEventKind; timestamp: number; data?: AudioEventData };
export type PatternStep = { note: Note; velocity: number; duration: string; enabled: boolean };
export type InstrumentPattern = { type: InstrumentType; steps: PatternStep[]; length: number; enabled: boolean };

export class AudioEngine {
  private readonly state$: BehaviorSubject<AudioEngineState>;
  private readonly events$: Subject<AudioEvent>;
  private readonly destroy$: Subject<void>;

  private readonly synthInstances: Map<InstrumentType, Tone.PolySynth>;
  private readonly patterns$: BehaviorSubject<Map<InstrumentType, InstrumentPattern>>;

  private readonly clock$: Observable<number>;
  private readonly chordProgression$: Observable<Note[][]>;
  private readonly currentChord$: BehaviorSubject<Note[]>;

  constructor(initialState?: Partial<AudioEngineState>) {
    this.destroy$ = new Subject();
    this.events$ = new Subject();
    this.synthInstances = new Map();
    this.patterns$ = new BehaviorSubject(new Map());
    this.currentChord$ = new BehaviorSubject<Note[]>([]);

    this.state$ = new BehaviorSubject<AudioEngineState>({
      isPlaying: false,
      tempo: 80,
      key: Note.C,
      mode: Mode.Ionian,
      currentChord: 0,
      volume: 0.7,
      instruments: new Set([InstrumentType.Pad, InstrumentType.Atmosphere]),
      ...initialState,
    });

    this.clock$ = this.state$.pipe(
      map(state => state.tempo),
      distinctUntilChanged(),
      switchMap(tempo => timer(0, this.tempoToMs(tempo))),
      takeUntil(this.destroy$),
    );

    this.chordProgression$ = this.state$.pipe(
      map(state => ({ key: state.key, mode: state.mode })),
      distinctUntilChanged((a, b) => a.key === b.key && a.mode === b.mode),
      map(({ key, mode }) => {
        const scale = generateScale(key, mode);
        return generateProgression(scale, [...AMBIENT_PROGRESSIONS.emotional]);
      }),
      takeUntil(this.destroy$),
    );

    this.initializeAudioStreams();
  }

  private initializeAudioStreams(): void {
    this.state$.pipe(map(state => state.isPlaying), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(
      isPlaying => {
        if (isPlaying) {
          this.startAudioContext();
        } else {
          this.pauseAudio();
        }
      },
    );

    combineLatest([
      this.clock$.pipe(filter(() => this.state$.value.isPlaying), scan(count => count + 1, 0)),
      this.chordProgression$,
    ]).pipe(
      map(([beat, progression]) => {
        const chordIndex = Math.floor(beat / 8) % progression.length;
        return { chord: progression[chordIndex], index: chordIndex };
      }),
      distinctUntilChanged((a, b) => a.index === b.index),
      takeUntil(this.destroy$),
    ).subscribe(({ chord, index }) => {
      this.currentChord$.next(chord);
      this.updateState(state => ({ ...state, currentChord: index }));
      this.events$.next({ type: "chord-change", timestamp: Tone.now(), data: { chord, index } });
    });

    combineLatest([this.clock$, this.patterns$, this.currentChord$]).pipe(
      filter(() => this.state$.value.isPlaying),
      takeUntil(this.destroy$),
    ).subscribe(([beat, patterns, currentChord]) => {
      this.playPatternStep(beat, patterns, currentChord);
    });

    this.state$.pipe(map(state => state.volume), distinctUntilChanged(), debounceTime(50), takeUntil(this.destroy$))
      .subscribe(volume => {
        ambientMixer.setMasterVolume(volume);
      });

    this.state$.pipe(
      map(state => state.instruments),
      distinctUntilChanged((a, b) => {
        return a.size === b.size && [...a].every(x => b.has(x));
      }),
      takeUntil(this.destroy$),
    ).subscribe(instruments => {
      this.updateInstruments(instruments);
    });
  }

  private tempoToMs(tempo: number): number {
    return (60 / tempo) * 1000;
  }

  private async startAudioContext(): Promise<void> {
    await initializeAudio();
    Tone.getTransport().start();
  }

  private pauseAudio(): void {
    Tone.getTransport().pause();
  }

  private updateState(updater: (state: AudioEngineState) => AudioEngineState): void {
    this.state$.next(updater(this.state$.value));
  }

  private playPatternStep(beat: number, patterns: Map<InstrumentType, InstrumentPattern>, currentChord: Note[]): void {
    patterns.forEach((pattern, instrumentType) => {
      if (!pattern.enabled) return;

      const stepIndex = beat % pattern.length;
      const step = pattern.steps[stepIndex];

      if (step?.enabled) {
        const synth = this.synthInstances.get(instrumentType);
        if (synth) {
          const note = this.harmonizeNote(step.note, currentChord, instrumentType);
          const noteString = noteToToneString(note);

          synth.triggerAttackRelease(noteString, step.duration, Tone.now(), step.velocity);
        }
      }
    });
  }

  private harmonizeNote(note: Note, chord: Note[], instrumentType: InstrumentType): Note {
    if (instrumentType === InstrumentType.Pad || instrumentType === InstrumentType.Atmosphere) {
      const chordNote = chord[Math.floor(Math.random() * chord.length)];
      return chordNote;
    }

    return note;
  }

  private updateInstruments(instruments: Set<InstrumentType>): void {
    this.synthInstances.forEach((synth, type) => {
      if (!instruments.has(type)) {
        synth.dispose();
        this.synthInstances.delete(type);
      }
    });

    instruments.forEach(type => {
      if (!this.synthInstances.has(type)) {
        const synth = createSynth(type);
        const effects = this.getDefaultEffects(type);

        ambientMixer.connectSynth(synth, type, effects);
        this.synthInstances.set(type, synth);
      }
    });
  }

  private getDefaultEffects(type: InstrumentType): EffectType[] {
    switch (type) {
      case InstrumentType.Pad:
        return [EffectType.Reverb, EffectType.Chorus];
      case InstrumentType.Lead:
        return [EffectType.Delay, EffectType.Filter];
      case InstrumentType.Bass:
        return [EffectType.Compressor];
      case InstrumentType.Atmosphere:
        return [EffectType.Reverb, EffectType.Filter];
      case InstrumentType.Texture:
        return [EffectType.Reverb, EffectType.Delay, EffectType.Chorus];
      case InstrumentType.Percussion:
        return [EffectType.Compressor, EffectType.Reverb];
      default:
        return [EffectType.Reverb];
    }
  }

  getState$(): Observable<AudioEngineState> {
    return this.state$.asObservable();
  }

  getEvents$(): Observable<AudioEvent> {
    return this.events$.asObservable();
  }

  getChordProgression$(): Observable<Note[][]> {
    return this.chordProgression$;
  }

  getCurrentChord$(): Observable<Note[]> {
    return this.currentChord$.asObservable();
  }

  togglePlayback(): void {
    const currentState = this.state$.value;
    this.updateState(state => ({ ...state, isPlaying: !state.isPlaying }));
    this.events$.next({ type: currentState.isPlaying ? "pause" : "play", timestamp: Tone.now() });
  }

  setTempo(tempo: number): void {
    const clampedTempo = Math.max(40, Math.min(200, tempo));
    this.updateState(state => ({ ...state, tempo: clampedTempo }));
  }

  setKeyAndMode(key: Note, mode: Mode): void {
    this.updateState(state => ({ ...state, key, mode, currentChord: 0 }));
  }

  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.updateState(state => ({ ...state, volume: clampedVolume }));
  }

  toggleInstrument(instrument: InstrumentType): void {
    const currentState = this.state$.value;
    const newInstruments = new Set(currentState.instruments);

    if (newInstruments.has(instrument)) {
      newInstruments.delete(instrument);
    } else {
      newInstruments.add(instrument);
    }

    this.updateState(state => ({ ...state, instruments: newInstruments }));

    this.events$.next({
      type: "instrument-toggle",
      timestamp: Tone.now(),
      data: { instrument, enabled: newInstruments.has(instrument) },
    });
  }

  setInstrumentPattern(type: InstrumentType, pattern: InstrumentPattern): void {
    const patterns = new Map(this.patterns$.value);
    patterns.set(type, pattern);
    this.patterns$.next(patterns);
  }

  getSynth(type: InstrumentType): Tone.PolySynth | undefined {
    return this.synthInstances.get(type);
  }

  automateParameter(
    instrumentType: InstrumentType,
    paramPath: string,
    targetValue: number,
    duration: string = "4m",
  ): void {
    const synth = this.synthInstances.get(instrumentType);
    if (!synth) return;

    const param = this.getNestedParam(synth, paramPath);
    if (param) {
      ParameterAutomation.automateParameter(param, targetValue, duration);
    }
  }

  private getNestedParam(synth: Tone.PolySynth, path: string): Tone.Param | undefined {
    const parts = path.split(".");
    let current: unknown = synth.get();

    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current instanceof Tone.Param ? current : undefined;
  }

  stop(): void {
    this.updateState(state => ({ ...state, isPlaying: false }));
    Tone.getTransport().stop();

    this.events$.next({ type: "stop", timestamp: Tone.now() });
  }

  dispose(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.synthInstances.forEach(synth => synth.dispose());
    this.synthInstances.clear();

    ambientMixer.dispose();
    Tone.getTransport().dispose();
  }
}

export const createAmbientAudioEngine = (initialState?: Partial<AudioEngineState>): AudioEngine => {
  const defaultState: Partial<AudioEngineState> = {
    tempo: 72,
    key: Note.C,
    mode: Mode.Aeolian,
    volume: 0.6,
    instruments: new Set([InstrumentType.Pad, InstrumentType.Atmosphere, InstrumentType.Texture]),
  };

  return new AudioEngine({ ...defaultState, ...initialState });
};

export const createDefaultPattern = (type: InstrumentType, key: Note, mode: Mode): InstrumentPattern => {
  const scale = generateScale(key, mode);
  const steps: PatternStep[] = [];

  switch (type) {
    case InstrumentType.Pad:
      for (let i = 0; i < 16; i++) {
        steps.push({ note: scale[i % scale.length], velocity: 0.3, duration: "2m", enabled: i % 8 === 0 });
      }
      break;

    case InstrumentType.Atmosphere:
      // Very sparse, ethereal notes
      for (let i = 0; i < 32; i++) {
        steps.push({
          note: scale[Math.floor(i / 4) % scale.length],
          velocity: 0.2,
          duration: "4m",
          enabled: i % 16 === 0,
        });
      }
      break;

    case InstrumentType.Bass:
      for (let i = 0; i < 8; i++) {
        steps.push({ note: scale[0], velocity: 0.4, duration: "1m", enabled: i % 4 === 0 });
      }
      break;

    default:
      for (let i = 0; i < 16; i++) {
        steps.push({ note: scale[i % scale.length], velocity: 0.3, duration: "1m", enabled: i % 4 === 0 });
      }
  }

  return { type, steps, length: steps.length, enabled: true };
};
