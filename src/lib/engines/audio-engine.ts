import { ambientMixer, createSynth, initializeAudio, noteToToneString, ParameterAutomation } from "$lib/audio";
import { AMBIENT_TO_ENGINE_MAPPING } from "$lib/data/presets";
import { AmbientPadSynth } from "$lib/instruments/ambient-pad";
import { ArpeggiatorSynth } from "$lib/instruments/arpeggiator";
import { GranularSynth } from "$lib/instruments/granular-synth";
import { HarmonicDroneSynth } from "$lib/instruments/harmonic-drone-synth";
import { MelodicSynth } from "$lib/instruments/melodic-synth";
import { VocalPadSynth } from "$lib/instruments/vocal-pads";
import { PatternRandomizer } from "$lib/seed/pattern-randomizer";
import { AMBIENT_PROGRESSIONS, generateProgression, generateScale, Mode, Note } from "$lib/theory";
import type { AudioEngineState, AudioEvent, InstrumentPattern, RandomizationParams } from "$lib/types/audio";
import { FieldRecordingSynth } from "$lib/types/field-recording-synth";
import { InstrumentType } from "$lib/types/instruments";
import type { Texture, Voice } from "$lib/types/presets";
import { RhythmicPulseSynth } from "$lib/types/rhythmic-pulse-synth";
import type { Optional } from "$lib/types/shared";
import { BehaviorSubject, combineLatest, Observable, Subject } from "rxjs";
import { debounceTime, distinctUntilChanged, map, take, takeUntil } from "rxjs/operators";
import { SvelteSet } from "svelte/reactivity";
import * as Tone from "tone";
import {
  createAmbientInstrument,
  createDefaultPattern,
  getDefaultEffects,
  getNestedParam,
  getPatternLengthForType,
  harmonizeNote,
  isAmbientInstrument,
  scaleToNotes,
  shouldApplyVoiceToInstrument,
  type SynthKind,
} from "./utilities";

export class AudioEngine {
  private readonly state$: BehaviorSubject<AudioEngineState>;
  private readonly events$: Subject<AudioEvent>;
  private readonly destroy$: Subject<void>;
  private readonly synthInstances: Map<InstrumentType, Tone.PolySynth>;
  private readonly patterns$: BehaviorSubject<Map<InstrumentType, InstrumentPattern>>;
  private readonly randomizedPatterns$: Observable<Map<InstrumentType, InstrumentPattern>>;
  private readonly currentScale$: BehaviorSubject<Note[]>;
  private readonly chordProgression$: Observable<Note[][]>;
  private readonly currentChord$: BehaviorSubject<Note[]>;

  private readonly ambientInstruments: Map<InstrumentType, SynthKind>;

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
      currentChord: -1, // Initialize to -1 to ensure first chord is always processed
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

    this.state$.pipe(map(s => s.tempo), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(tempo => {
      Tone.getTransport().bpm.value = tempo;
    });

    Tone.getTransport().scheduleRepeat(time => {
      if (!this.state$.value.isPlaying) return;

      const totalTicks = Tone.getTransport().ticks;
      const sixteenthNotes = Math.round(totalTicks / (Tone.getTransport().PPQ / 4));

      combineLatest([this.chordProgression$, this.randomizedPatterns$]).pipe(take(1)).subscribe(
        ([progression, patterns]) => {
          if (progression.length === 0) {
            return;
          }

          const chordIndex = Math.floor(sixteenthNotes / 8) % progression.length;
          let chord = this.currentChord$.value;

          if (this.state$.value.currentChord !== chordIndex) {
            chord = progression[chordIndex];
            this.currentChord$.next(chord);
            this.updateState(state => ({ ...state, currentChord: chordIndex }));
            this.events$.next({ type: "chord-change", timestamp: time, data: { chord, index: chordIndex } });

            for (const [, instrument] of this.ambientInstruments.entries()) {
              if (
                instrument instanceof AmbientPadSynth
                || instrument instanceof HarmonicDroneSynth
                || instrument instanceof VocalPadSynth
              ) {
                instrument.setChord(chord, time);
              }
            }
          }

          const tickDuration = 60 / this.state$.value.tempo / 4;
          this.playPatternStep(sixteenthNotes, patterns, chord, time);

          for (const [, instrument] of this.ambientInstruments.entries()) {
            if (
              instrument instanceof ArpeggiatorSynth
              || instrument instanceof MelodicSynth
              || instrument instanceof GranularSynth
              || instrument instanceof VocalPadSynth
              || instrument instanceof RhythmicPulseSynth
            ) {
              instrument.tick(time, tickDuration);
            }
          }
        },
      );
    }, "16n");

    this.state$.pipe(map(state => state.volume), distinctUntilChanged(), debounceTime(50), takeUntil(this.destroy$))
      .subscribe(volume => ambientMixer.setMasterVolume(volume));

    this.state$.pipe(
      map(state => state.instruments),
      distinctUntilChanged((a, b) => {
        return a.size === b.size && [...a].every(x => b.has(x));
      }),
      takeUntil(this.destroy$),
    ).subscribe(instruments => this.updateInstruments(instruments));

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

  private playPatternStep(
    beat: number,
    patterns: Map<InstrumentType, InstrumentPattern>,
    currentChord: Note[],
    time: number,
  ): void {
    for (const [instrumentType, pattern] of patterns.entries()) {
      if (!pattern.enabled) {
        continue;
      }

      const stepIndex = beat % pattern.length;
      const step = pattern.steps[stepIndex];

      if (step?.enabled) {
        const synth = this.synthInstances.get(instrumentType);
        if (synth) {
          const note = harmonizeNote(step.note, currentChord, instrumentType);
          const noteString = noteToToneString(note);

          synth.triggerAttackRelease(noteString, step.duration, time, step.velocity);
        }
      }
    }
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
      if (isAmbientInstrument(type)) {
        if (!this.ambientInstruments.has(type)) {
          const instrument = createAmbientInstrument(type);
          if (instrument) {
            const channel = ambientMixer.getChannel(type);
            if (!channel) {
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
          const effects = getDefaultEffects(type);

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
    this.updateState(state => ({ ...state, tempo: Math.max(40, Math.min(200, tempo)) }));
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
    this.updateState(state => ({ ...state, volume: Math.max(0, Math.min(1, volume)) }));
  }

  applyPresetTexture(texture: Texture): void {
    if (texture.tempo) {
      this.setTempo(texture.tempo);
    }

    if (texture.mix?.volume !== undefined) {
      let volume = texture.mix.volume;
      if (volume < 0) {
        volume = Math.pow(10, volume / 20);
      }
      this.setVolume(Math.max(0, Math.min(1, volume)));
    }

    if (texture.scale && texture.scale.length > 0) {
      const scaleNotes = scaleToNotes(texture.scale);
      if (scaleNotes.length > 0) {
        this.setKeyAndMode(scaleNotes[0], this.state$.value.mode);
      }
    }

    if (texture.instruments) {
      for (const [textureKey, params] of Object.entries(texture.instruments)) {
        const kind = AMBIENT_TO_ENGINE_MAPPING[textureKey as keyof typeof AMBIENT_TO_ENGINE_MAPPING];
        if (kind && typeof params === "object" && params !== null) {
          const instrument = this.ambientInstruments.get(kind);
          if (instrument) {
            const converted = { ...params } as any;
            if (converted.volume !== undefined && converted.volume < 0) {
              converted.volume = Math.pow(10, converted.volume / 20);
            }

            instrument.updateParams(converted);
          }
        }
      }
    }

    this.applyTextureProcessing(texture);
    this.applyTextureLayering(texture);
  }

  private applyTextureProcessing(texture: Texture): void {
    if (!texture.processing) return;

    if (texture.processing.reverb) {
      ambientMixer.setGlobalReverb(texture.processing.reverb);
    }

    if (texture.processing.delay) {
      ambientMixer.setGlobalDelay(texture.processing.delay);
    }

    if (texture.processing.filter) {
      ambientMixer.setGlobalFilter(texture.processing.filter);
    }

    if (texture.processing.chorus) {
      ambientMixer.setGlobalChorus(texture.processing.chorus);
    }

    this.applyVoiceConfigurations(texture);
  }

  private applyVoiceConfigurations(texture: any): void {
    if (!texture.voices || !Array.isArray(texture.voices)) return;

    const currentState = this.state$.value;

    for (const voice of texture.voices) {
      const { type, count = 1, envelope, oscillator } = voice;

      for (const kind of currentState.instruments) {
        if (shouldApplyVoiceToInstrument(type, kind)) {
          this.configureInstrumentVoice(kind, { type, count, envelope: envelope || {}, oscillator: oscillator || {} });
        }
      }
    }
  }

  private configureInstrumentVoice(kind: InstrumentType, voice: Voice): void {
    const synth = this.synthInstances.get(kind);
    if (!synth) return;

    if (voice.envelope) {
      const envelope = voice.envelope;
      synth.set({
        envelope: {
          attack: envelope.attack,
          decay: envelope.decay,
          sustain: envelope.sustain,
          release: envelope.release,
        },
      });
    }

    if (voice.oscillator) {
      const oscillator = voice.oscillator;

      if (oscillator.type) {
        synth.set({ oscillator: { type: oscillator.type } });
      }
    }

    this.applyVoiceCharacteristics(synth, voice);
  }

  private applyVoiceCharacteristics(synth: Tone.PolySynth, voice: Voice): void {
    switch (voice.type) {
      // Piano-like characteristics: sharp attack, quick decay
      case "piano": {
        synth.set({
          envelope: {
            attack: 0.001,
            decay: voice.envelope?.decay || 2,
            sustain: voice.envelope?.sustain || 0.1,
            release: voice.envelope?.release || 3,
          },
          // More piano-like than sine
          oscillator: { type: "triangle" },
        });
        break;
      }
      case "drone": {
        // Drone characteristics: very slow attack, long sustain
        synth.set({
          envelope: {
            attack: voice.envelope?.attack || 8,
            decay: 0,
            sustain: 1,
            release: voice.envelope?.release || 12,
          },
          // Rich harmonic content for drones
          oscillator: { type: "sawtooth" },
        });
        break;
      }
      case "granular": {
        // Granular synthesis simulation with choppy envelope
        synth.set({
          envelope: {
            attack: 0.01,
            decay: voice.envelope?.decay || 0.1,
            sustain: voice.envelope?.sustain || 0.3,
            release: voice.envelope?.release || 0.2,
          },
          oscillator: { type: "square" },
        });
        break;
      }
      default: {
        synth.set({ oscillator: { type: voice.oscillator?.type || "sine" } });
        break;
      }
    }

    if (voice.count > 1 && voice.oscillator?.detuneRange) {
      this.applyVoiceDetuning(synth, voice.count, voice.oscillator.detuneRange);
    }
  }

  private applyVoiceDetuning(synth: Tone.PolySynth, voiceCount: number, detuneRange: number): void {
    // Create slight pitch variations for richer sound when multiple voices are specified
    // This simulates the effect of multiple slightly detuned oscillators
    const currentVolume = synth.volume.value;
    // Slightly reduce volume to compensate for multiple voices
    synth.volume.value = currentVolume - 3;

    // Store detune information for potential future use
    (synth as any)._voiceDetune = detuneRange;
    (synth as any)._voiceCount = voiceCount;
  }

  private applyTextureLayering(texture: Texture): void {
    if (!texture.structure?.layering) return;

    const layering = texture.structure.layering;
    const density = texture.structure.density || 1;

    for (const [type, instrument] of this.ambientInstruments.entries()) {
      if (this.state$.value.instruments.has(type)) {
        let volumeMultiplier = 1;

        switch (layering) {
          case "minimal": {
            volumeMultiplier = 0.8;
            break;
          }
          case "medium": {
            volumeMultiplier = 0.9;
            break;
          }
          case "dense": {
            volumeMultiplier = 0.7;
            break;
          }
        }

        const densityMultiplier = Math.max(0.3, 1 - (density * 0.05));
        const finalMultiplier = volumeMultiplier * densityMultiplier;

        if ("updateParams" in instrument) {
          // @ts-expect-error Different instrument types have different param structures
          instrument.updateParams({ volumeMultiplier: finalMultiplier });
        }
      }
    }

    this.applyGenerativePatterns(texture);
  }

  private applyGenerativePatterns(texture: Texture): void {
    if (!texture.structure?.generativePattern) return;

    const patternType = texture.structure.generativePattern as "random-walk" | "euclidean" | "static-drone" | "markov";
    const density = texture.structure.density || 0.5;
    const randomness = texture.structure.randomness || 0.3;
    const currentState = this.state$.value;
    const scale = this.currentScale$.value;
    const seed = currentState.randomization.seed || Math.random();

    const patterns = new Map(this.patterns$.value);
    let patternsUpdated = false;

    for (const kind of currentState.instruments) {
      if (!isAmbientInstrument(kind)) {
        const patternLength = getPatternLengthForType(kind, patternType);
        const newPattern = PatternRandomizer.generatePatternByType(
          patternType,
          kind,
          patternLength,
          scale,
          density,
          randomness,
          // Use instrument type as additional seed variation
          seed + Object.values(InstrumentType).indexOf(kind),
        );

        patterns.set(kind, newPattern);
        patternsUpdated = true;
      }
    }

    if (patternsUpdated) {
      this.patterns$.next(patterns);
    }
  }

  toggleInstrument(kind: InstrumentType): void {
    const currentState = this.state$.value;
    const newInstruments = new SvelteSet(currentState.instruments);

    if (newInstruments.has(kind)) {
      newInstruments.delete(kind);
    } else {
      newInstruments.add(kind);
    }

    this.updateState(state => ({ ...state, instruments: newInstruments }));

    this.events$.next({
      type: "instrument-toggle",
      timestamp: Tone.now(),
      data: { instrument: kind, enabled: newInstruments.has(kind) },
    });
  }

  setInstrumentPattern(kind: InstrumentType, pattern: InstrumentPattern): void {
    const patterns = new Map(this.patterns$.value);
    patterns.set(kind, pattern);
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

  getSynth(type: InstrumentType): Optional<Tone.PolySynth> {
    return this.synthInstances.get(type);
  }

  automateParameter(kind: InstrumentType, paramPath: string, targetValue: number, duration: string = "4m"): void {
    const synth = this.synthInstances.get(kind);
    if (!synth) return;

    const param = getNestedParam(synth, paramPath);
    if (param) {
      ParameterAutomation.automateParameter(param, targetValue, duration);
    }
  }

  stop(): void {
    this.updateState(state => ({ ...state, isPlaying: false }));
    Tone.getTransport().stop();

    for (const instrument of this.ambientInstruments.values()) {
      if (
        [
          GranularSynth,
          AmbientPadSynth,
          HarmonicDroneSynth,
          MelodicSynth,
          RhythmicPulseSynth,
          FieldRecordingSynth,
          VocalPadSynth,
          ArpeggiatorSynth,
        ].some(c => instrument instanceof c)
      ) {
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

export const createAmbientAudioEngine = (initial?: Partial<AudioEngineState>): AudioEngine => {
  const final = {
    tempo: 72,
    key: Note.C,
    mode: Mode.Aeolian,
    volume: 0.6,
    instruments: new SvelteSet([
      InstrumentType.AmbientPad,
      InstrumentType.Granular,
      InstrumentType.Melodic,
      InstrumentType.Arpeggiator,
    ]),
    randomization: {
      enabled: false,
      rhythmVariability: 0.2,
      melodicVariability: 0.15,
      chordProgression: 0.05,
      patternEvolution: 0.1,
      constraintStrength: 0.8,
    },
    ...initial,
  };

  const engine = new AudioEngine(final);

  if (final.instruments) {
    for (const kind of final.instruments) {
      if (!isAmbientInstrument(kind)) {
        const pattern = createDefaultPattern(kind, final.key || Note.C, final.mode || Mode.Aeolian);
        engine.setInstrumentPattern(kind, pattern);
      }
    }
  }

  return engine;
};
