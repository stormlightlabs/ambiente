import { BehaviorSubject, combineLatest, Observable, Subject, timer } from "rxjs";
import { debounceTime, distinctUntilChanged, filter, map, scan, switchMap, takeUntil } from "rxjs/operators";
import { SvelteSet } from "svelte/reactivity";
import * as Tone from "tone";
import { ambientMixer, createSynth, initializeAudio, noteToToneString, ParameterAutomation } from "./audio";
import { AmbientPadSynth } from "./instruments/ambient-pad";
import { ArpeggiatorSynth } from "./instruments/arpeggiator";
import { GranularSynth } from "./instruments/granular-synth";
import { HarmonicDroneSynth } from "./instruments/harmonic-drone-synth";
import { MelodicSynth } from "./instruments/melodic-synth";
import { VocalPadSynth } from "./instruments/vocal-pads";
import { AMBIENT_PROGRESSIONS, generateProgression, generateScale, Mode, Note } from "./theory";
import type { AudioEngineState, AudioEvent, InstrumentPattern, PatternStep, RandomizationParams } from "./types/audio";
import { FieldRecordingSynth } from "./types/field-recording-synth";
import { EffectType, InstrumentType } from "./types/instruments";
import { RhythmicPulseSynth } from "./types/rhythmic-pulse-synth";
import type { Optional } from "./types/shared";

class PatternRandomizer {
  private static seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10_000;
    return x - Math.floor(x);
  }

  static randomizeRhythm(pattern: InstrumentPattern, variability: number, seed = Math.random()): InstrumentPattern {
    if (variability === 0) return pattern;

    const randomizedSteps = pattern.steps.map((step, index) => {
      const stepSeed = seed + index * 0.1;
      const random = this.seededRandom(stepSeed);

      if (random < variability * 0.3) {
        return { ...step, enabled: !step.enabled };
      }

      if (random < variability * 0.5) {
        const velocityVariation = (random - 0.5) * 0.2 * variability;
        return { ...step, velocity: Math.max(0.1, Math.min(1, step.velocity + velocityVariation)) };
      }

      return step;
    });

    return { ...pattern, steps: randomizedSteps };
  }

  static randomizeMelody(
    pattern: InstrumentPattern,
    scale: Note[],
    variability: number,
    seed = Math.random(),
  ): InstrumentPattern {
    if (variability === 0 || scale.length === 0) return pattern;

    const randomizedSteps = pattern.steps.map((step, index) => {
      const stepSeed = seed + index * 0.2;
      const random = this.seededRandom(stepSeed);

      if (random < variability * 0.4 && step.enabled) {
        const currentIndex = scale.indexOf(step.note);
        if (currentIndex !== -1) {
          const maxJump = Math.ceil(scale.length * 0.3);
          const direction = random < 0.5 ? -1 : 1;
          const jump = Math.floor(random * maxJump) + 1;
          const newIndex = (currentIndex + direction * jump + scale.length) % scale.length;

          return { ...step, note: scale[newIndex] };
        }
      }

      return step;
    });

    return { ...pattern, steps: randomizedSteps };
  }

  static randomizeProgression(
    progression: Note[][],
    scale: Note[],
    variability: number,
    constraintStrength = 0.7,
    seed = Math.random(),
  ): Note[][] {
    if (variability === 0 || scale.length === 0) return progression;

    return progression.map((chord, index) => {
      const chordSeed = seed + index * 0.3;
      const random = this.seededRandom(chordSeed);

      if (random < variability * 0.3) {
        const rootIndex = scale.indexOf(chord[0]);
        if (rootIndex !== -1) {
          const maxJump = Math.max(1, Math.floor((1 - constraintStrength) * scale.length * 0.5));
          const direction = random < 0.5 ? -1 : 1;
          const jump = Math.floor(random * maxJump) + 1;
          const newRootIndex = (rootIndex + direction * jump + scale.length) % scale.length;

          return chord.map((_, chordIndex) => {
            const noteOffset = chordIndex * 2;
            return scale[(newRootIndex + noteOffset) % scale.length];
          });
        }
      }

      return chord;
    });
  }

  static evolvePattern(pattern: InstrumentPattern, evolution: number, seed = Math.random()): InstrumentPattern {
    if (evolution === 0) return pattern;

    const mutatedSteps = pattern.steps.map((step, index) => {
      const mutationSeed = seed + index * 0.4;
      const random = this.seededRandom(mutationSeed);

      if (random < evolution * 0.25) {
        const durations = ["8n", "4n", "2n", "1m"];
        const currentIndex = durations.indexOf(step.duration);
        const newIndex = Math.max(0, Math.min(durations.length - 1, currentIndex + (random < 0.5 ? -1 : 1)));

        return { ...step, duration: durations[newIndex] };
      }

      if (random < evolution * 0.15) {
        return { ...step, enabled: random < 0.7 };
      }

      return step;
    });

    return { ...pattern, steps: mutatedSteps };
  }
}

export class AudioEngine {
  private readonly state$: BehaviorSubject<AudioEngineState>;
  private readonly events$: Subject<AudioEvent>;
  private readonly destroy$: Subject<void>;

  private readonly synthInstances: Map<InstrumentType, Tone.PolySynth>;
  private readonly patterns$: BehaviorSubject<Map<InstrumentType, InstrumentPattern>>;
  private readonly randomizedPatterns$: Observable<Map<InstrumentType, InstrumentPattern>>;

  private readonly ambientInstruments: Map<
    InstrumentType,
    | GranularSynth
    | AmbientPadSynth
    | MelodicSynth
    | HarmonicDroneSynth
    | RhythmicPulseSynth
    | FieldRecordingSynth
    | VocalPadSynth
    | ArpeggiatorSynth
  >;
  private readonly currentScale$: BehaviorSubject<Note[]>;

  private readonly clock$: Observable<number>;
  private readonly chordProgression$: Observable<Note[][]>;
  private readonly currentChord$: BehaviorSubject<Note[]>;

  constructor(initialState?: Partial<AudioEngineState>) {
    this.destroy$ = new Subject();
    this.events$ = new Subject();
    this.synthInstances = new Map();
    this.patterns$ = new BehaviorSubject(new Map());
    this.currentChord$ = new BehaviorSubject<Note[]>([]);

    this.ambientInstruments = new Map();
    this.currentScale$ = new BehaviorSubject<Note[]>([]);

    this.state$ = new BehaviorSubject<AudioEngineState>({
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
      ...initialState,
    });

    this.clock$ = this.state$.pipe(
      map(state => state.tempo),
      distinctUntilChanged(),
      switchMap(tempo => timer(0, this.tempoToMs(tempo))),
      takeUntil(this.destroy$),
    );

    this.chordProgression$ = this.state$.pipe(
      map(state => ({ key: state.key, mode: state.mode, randomization: state.randomization })),
      distinctUntilChanged((a, b) =>
        a.key === b.key && a.mode === b.mode && a.randomization.chordProgression === b.randomization.chordProgression
      ),
      map(({ key, mode, randomization }) => {
        const scale = generateScale(key, mode);
        this.currentScale$.next(scale);
        const baseProgression = generateProgression(scale, [...AMBIENT_PROGRESSIONS.emotional]);

        if (randomization.enabled && randomization.chordProgression > 0) {
          return PatternRandomizer.randomizeProgression(
            baseProgression,
            scale,
            randomization.chordProgression,
            randomization.constraintStrength,
            randomization.seed,
          );
        }
        return baseProgression;
      }),
      takeUntil(this.destroy$),
    );

    this.randomizedPatterns$ = combineLatest([
      this.patterns$,
      this.currentScale$,
      this.state$.pipe(map(state => state.randomization)),
    ]).pipe(
      map(([patterns, scale, randomization]) => {
        if (!randomization.enabled) return patterns;

        const randomizedMap = new Map<InstrumentType, InstrumentPattern>();
        for (const [type, pattern] of patterns.entries()) {
          let randomizedPattern = pattern;

          if (randomization.rhythmVariability > 0) {
            randomizedPattern = PatternRandomizer.randomizeRhythm(
              randomizedPattern,
              randomization.rhythmVariability,
              randomization.seed,
            );
          }

          if (randomization.melodicVariability > 0) {
            randomizedPattern = PatternRandomizer.randomizeMelody(
              randomizedPattern,
              scale,
              randomization.melodicVariability,
              randomization.seed,
            );
          }

          if (randomization.patternEvolution > 0) {
            randomizedPattern = PatternRandomizer.evolvePattern(
              randomizedPattern,
              randomization.patternEvolution,
              randomization.seed,
            );
          }

          randomizedMap.set(type, randomizedPattern);
        }
        return randomizedMap;
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

    combineLatest([this.clock$, this.randomizedPatterns$, this.currentChord$]).pipe(
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

    this.currentScale$.pipe(takeUntil(this.destroy$)).subscribe(scale => {
      for (const [, instrument] of this.ambientInstruments.entries()) {
        if (instrument instanceof GranularSynth) {
          instrument.setScale(scale);
        }
        if (instrument instanceof MelodicSynth) {
          instrument.setScale(scale);
        }
        if (instrument instanceof RhythmicPulseSynth) {
          instrument.setScale(scale);
        }
        if (instrument instanceof ArpeggiatorSynth) {
          instrument.setScale(scale);
        }
      }
    });

    this.currentChord$.pipe(takeUntil(this.destroy$)).subscribe(chord => {
      for (const [, instrument] of this.ambientInstruments.entries()) {
        if (instrument instanceof AmbientPadSynth) {
          instrument.setChord(chord);
        }
        if (instrument instanceof HarmonicDroneSynth) {
          instrument.setChord(chord);
        }
        if (instrument instanceof VocalPadSynth) {
          instrument.setChord(chord);
        }
      }
    });
  }

  private tempoToMs(tempo: number): number {
    return (60 / tempo) * 1000;
  }

  private startAudioContext(): void {
    Tone.getTransport().start();
  }

  private pauseAudio(): void {
    Tone.getTransport().pause();
  }

  private updateState(updater: (state: AudioEngineState) => AudioEngineState): void {
    this.state$.next(updater(this.state$.value));
  }

  private playPatternStep(beat: number, patterns: Map<InstrumentType, InstrumentPattern>, currentChord: Note[]): void {
    for (const [instrumentType, pattern] of patterns.entries()) {
      if (!pattern.enabled) {
        continue;
      }

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
    }
  }

  private harmonizeNote(note: Note, chord: Note[], instrumentType: InstrumentType): Note {
    if (instrumentType === InstrumentType.Pad || instrumentType === InstrumentType.Atmosphere) {
      const chordNote = chord[Math.floor(Math.random() * chord.length)];
      return chordNote;
    }

    return note;
  }

  private updateInstruments(instruments: Set<InstrumentType>): void {
    for (const [type, synth] of this.synthInstances.entries()) {
      if (!instruments.has(type)) {
        synth.dispose();
        this.synthInstances.delete(type);

        const patterns = new Map(this.patterns$.value);
        patterns.delete(type);
        this.patterns$.next(patterns);
      }
    }

    for (const [type, instrument] of this.ambientInstruments.entries()) {
      if (!instruments.has(type)) {
        instrument.dispose();
        this.ambientInstruments.delete(type);
      }
    }

    for (const type of instruments) {
      if (this.isAmbientInstrument(type)) {
        if (!this.ambientInstruments.has(type)) {
          const instrument = this.createAmbientInstrument(type);
          if (instrument) {
            const channel = ambientMixer.getChannel(type);
            if (!channel) {
              console.error("🎵 No channel found for instrument type:", type);
              return;
            }
            instrument.connect(channel);
            this.ambientInstruments.set(type, instrument);

            this.updateAmbientInstrumentContext(instrument);
          }
        }
      } else {
        if (!this.synthInstances.has(type)) {
          const synth = createSynth(type);
          const effects = this.getDefaultEffects(type);

          ambientMixer.connectSynth(synth, type, effects);
          this.synthInstances.set(type, synth);

          const currentState = this.state$.value;
          const pattern = createDefaultPattern(type, currentState.key, currentState.mode);
          const patterns = new Map(this.patterns$.value);
          patterns.set(type, pattern);
          this.patterns$.next(patterns);
        }
      }
    }
  }

  private isAmbientInstrument(type: InstrumentType): boolean {
    return [
      InstrumentType.AmbientPad,
      InstrumentType.Granular,
      InstrumentType.Melodic,
      InstrumentType.HarmonicDrone,
      InstrumentType.RhythmicPulse,
      InstrumentType.FieldRecording,
      InstrumentType.VocalPad,
      InstrumentType.Arpeggiator,
    ].includes(type);
  }

  private createAmbientInstrument(
    type: InstrumentType,
  ): Optional<
    | GranularSynth
    | AmbientPadSynth
    | MelodicSynth
    | HarmonicDroneSynth
    | RhythmicPulseSynth
    | FieldRecordingSynth
    | VocalPadSynth
    | ArpeggiatorSynth
  > {
    switch (type) {
      case InstrumentType.Granular: {
        return new GranularSynth();
      }
      case InstrumentType.AmbientPad: {
        return new AmbientPadSynth();
      }
      case InstrumentType.Melodic: {
        return new MelodicSynth();
      }
      case InstrumentType.HarmonicDrone: {
        return new HarmonicDroneSynth();
      }
      case InstrumentType.RhythmicPulse: {
        return new RhythmicPulseSynth();
      }
      case InstrumentType.FieldRecording: {
        return new FieldRecordingSynth();
      }
      case InstrumentType.VocalPad: {
        return new VocalPadSynth();
      }
      case InstrumentType.Arpeggiator: {
        return new ArpeggiatorSynth();
      }
      default: {
        return void 0;
      }
    }
  }

  private updateAmbientInstrumentContext(
    instrument:
      | GranularSynth
      | AmbientPadSynth
      | MelodicSynth
      | HarmonicDroneSynth
      | RhythmicPulseSynth
      | FieldRecordingSynth
      | VocalPadSynth
      | ArpeggiatorSynth,
  ): void {
    const currentScale = this.currentScale$.value;
    const currentChord = this.currentChord$.value;

    if (instrument instanceof GranularSynth) {
      instrument.setScale(currentScale);
    }

    if (instrument instanceof AmbientPadSynth) {
      instrument.setChord(currentChord);
    }

    if (instrument instanceof MelodicSynth) {
      instrument.setScale(currentScale);
    }

    if (instrument instanceof HarmonicDroneSynth) {
      instrument.setChord(currentChord);
    }

    if (instrument instanceof RhythmicPulseSynth) {
      instrument.setScale(currentScale);
    }

    if (instrument instanceof VocalPadSynth) {
      instrument.setChord(currentChord);
    }

    if (instrument instanceof ArpeggiatorSynth) {
      instrument.setScale(currentScale);
    }
  }

  private getDefaultEffects(type: InstrumentType): EffectType[] {
    switch (type) {
      case InstrumentType.Pad: {
        return [EffectType.Reverb, EffectType.Chorus];
      }
      case InstrumentType.Lead: {
        return [EffectType.Delay, EffectType.Filter];
      }
      case InstrumentType.Bass: {
        return [EffectType.Compressor];
      }
      case InstrumentType.Atmosphere: {
        return [EffectType.Reverb, EffectType.Filter];
      }
      case InstrumentType.Texture: {
        return [EffectType.Reverb, EffectType.Delay, EffectType.Chorus];
      }
      case InstrumentType.Percussion: {
        return [EffectType.Compressor, EffectType.Reverb];
      }
      case InstrumentType.AmbientPad:
      case InstrumentType.Granular:
      case InstrumentType.Melodic:
      case InstrumentType.HarmonicDrone:
      case InstrumentType.RhythmicPulse: {
        return [];
      }
      default: {
        return [EffectType.Reverb];
      }
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

  async togglePlayback(): Promise<void> {
    const currentState = this.state$.value;

    // eslint-disable-next-line unicorn/no-negated-condition
    if (!currentState.isPlaying) {
      await initializeAudio();
      Tone.getTransport().start();

      // Enable all active ambient instruments
      for (const [type, instrument] of this.ambientInstruments.entries()) {
        if (currentState.instruments.has(type)) {
          instrument.updateParams({ enabled: true });
        }
      }

      this.updateState(state => ({ ...state, isPlaying: true }));
      this.events$.next({ type: "play", timestamp: Tone.now() });
    } else {
      this.stop();
    }
  }

  setTempo(tempo: number): void {
    const clampedTempo = Math.max(40, Math.min(200, tempo));
    this.updateState(state => ({ ...state, tempo: clampedTempo }));
  }

  setKeyAndMode(key: Note, mode: Mode): void {
    this.updateState(state => ({ ...state, key, mode, currentChord: 0 }));

    const patterns = new Map(this.patterns$.value);
    let patternsUpdated = false;

    for (const [instrumentType] of this.synthInstances.entries()) {
      const newPattern = createDefaultPattern(instrumentType, key, mode);
      patterns.set(instrumentType, newPattern);
      patternsUpdated = true;
    }

    if (patternsUpdated) {
      this.patterns$.next(patterns);
    }

    const scale = generateScale(key, mode);
    this.currentScale$.next(scale);
    const newProgression = generateProgression(scale, [...AMBIENT_PROGRESSIONS.emotional]);
    if (newProgression.length > 0) {
      this.currentChord$.next(newProgression[0]);
    }
  }

  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.updateState(state => ({ ...state, volume: clampedVolume }));
  }

  toggleInstrument(instrument: InstrumentType): void {
    const currentState = this.state$.value;
    const newInstruments = new SvelteSet(currentState.instruments);

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

  setRandomization(params: Partial<RandomizationParams>): void {
    const currentState = this.state$.value;
    const updatedRandomization = { ...currentState.randomization, ...params };

    if (
      (params.enabled && !currentState.randomization.enabled)
      || Math.abs((params.rhythmVariability || 0) - currentState.randomization.rhythmVariability) > 0.1
      || Math.abs((params.melodicVariability || 0) - currentState.randomization.melodicVariability) > 0.1
      || Math.abs((params.chordProgression || 0) - currentState.randomization.chordProgression) > 0.05
      || Math.abs((params.patternEvolution || 0) - currentState.randomization.patternEvolution) > 0.1
    ) {
      updatedRandomization.seed = Math.random();
    }

    this.updateState(state => ({ ...state, randomization: updatedRandomization }));
  }

  getRandomization(): RandomizationParams {
    return this.state$.value.randomization;
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

    for (const instrument of this.ambientInstruments.values()) {
      if (instrument instanceof GranularSynth) {
        instrument.updateParams({ enabled: false });
      } else if (instrument instanceof AmbientPadSynth) {
        instrument.updateParams({ enabled: false });
      } else if (instrument instanceof MelodicSynth) {
        instrument.updateParams({ enabled: false });
      } else if (instrument instanceof HarmonicDroneSynth) {
        instrument.updateParams({ enabled: false });
      } else if (instrument instanceof RhythmicPulseSynth) {
        instrument.updateParams({ enabled: false });
      } else if (instrument instanceof FieldRecordingSynth) {
        instrument.updateParams({ enabled: false });
      } else if (instrument instanceof VocalPadSynth) {
        instrument.updateParams({ enabled: false });
      } else if (instrument instanceof ArpeggiatorSynth) {
        instrument.updateParams({ enabled: false });
      }
    }

    for (const synth of this.synthInstances.values()) {
      synth.releaseAll();
    }

    this.events$.next({ type: "stop", timestamp: Tone.now() });
  }

  dispose(): void {
    this.destroy$.next();
    this.destroy$.complete();

    for (const [, synth] of this.synthInstances.entries()) synth.dispose();
    this.synthInstances.clear();

    for (const [, instrument] of this.ambientInstruments.entries()) instrument.dispose();
    this.ambientInstruments.clear();

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
    instruments: new SvelteSet([InstrumentType.AmbientPad, InstrumentType.Granular]),
    randomization: {
      enabled: false,
      rhythmVariability: 0.2,
      melodicVariability: 0.15,
      chordProgression: 0.05,
      patternEvolution: 0.1,
      constraintStrength: 0.8,
    },
  };

  const finalState = { ...defaultState, ...initialState };
  const engine = new AudioEngine(finalState);

  if (finalState.instruments) {
    for (const instrumentType of finalState.instruments) {
      const isAmbient = [
        InstrumentType.AmbientPad,
        InstrumentType.Granular,
        InstrumentType.Melodic,
        InstrumentType.HarmonicDrone,
        InstrumentType.RhythmicPulse,
        InstrumentType.FieldRecording,
        InstrumentType.VocalPad,
        InstrumentType.Arpeggiator,
      ].includes(instrumentType);

      if (!isAmbient) {
        const pattern = createDefaultPattern(instrumentType, finalState.key || Note.C, finalState.mode || Mode.Aeolian);
        engine.setInstrumentPattern(instrumentType, pattern);
      }
    }
  }

  return engine;
};

export const createDefaultPattern = (type: InstrumentType, key: Note, mode: Mode): InstrumentPattern => {
  const scale = generateScale(key, mode);
  const steps: PatternStep[] = [];

  switch (type) {
    case InstrumentType.Pad: {
      for (let index = 0; index < 16; index++) {
        steps.push({ note: scale[index % scale.length], velocity: 0.3, duration: "2m", enabled: index % 8 === 0 });
      }
      break;
    }

    case InstrumentType.Atmosphere: {
      for (let index = 0; index < 32; index++) {
        steps.push({
          note: scale[Math.floor(index / 4) % scale.length],
          velocity: 0.2,
          duration: "4m",
          enabled: index % 16 === 0,
        });
      }
      break;
    }

    case InstrumentType.Bass: {
      for (let index = 0; index < 8; index++) {
        steps.push({ note: scale[0], velocity: 0.4, duration: "1m", enabled: index % 4 === 0 });
      }
      break;
    }

    default: {
      for (let index = 0; index < 16; index++) {
        steps.push({ note: scale[index % scale.length], velocity: 0.3, duration: "1m", enabled: index % 4 === 0 });
      }
    }
  }

  return { type, steps, length: steps.length, enabled: true };
};
