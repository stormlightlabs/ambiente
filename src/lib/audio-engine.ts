import { BehaviorSubject, combineLatest, Observable, Subject } from "rxjs";
import { debounceTime, distinctUntilChanged, map, take, takeUntil } from "rxjs/operators";
import { SvelteSet } from "svelte/reactivity";
import * as Tone from "tone";
import { ambientMixer, createSynth, initializeAudio, noteToToneString, ParameterAutomation } from "./audio";
import { AMBIENT_TO_ENGINE_MAPPING } from "./data/presets";
import { AmbientPadSynth } from "./instruments/ambient-pad";
import { ArpeggiatorSynth } from "./instruments/arpeggiator";
import { GranularSynth } from "./instruments/granular-synth";
import { HarmonicDroneSynth } from "./instruments/harmonic-drone-synth";
import { MelodicSynth } from "./instruments/melodic-synth";
import { VocalPadSynth } from "./instruments/vocal-pads";
import { PatternRandomizer } from "./seed/pattern-randomizer";
import { AMBIENT_PROGRESSIONS, generateProgression, generateScale, Mode, Note, NoteUtilities } from "./theory";
import type { AudioEngineState, AudioEvent, InstrumentPattern, PatternStep, RandomizationParams } from "./types/audio";
import { FieldRecordingSynth } from "./types/field-recording-synth";
import { EffectType, InstrumentType } from "./types/instruments";
import { RhythmicPulseSynth } from "./types/rhythmic-pulse-synth";
import type { Optional } from "./types/shared";

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

  tempoToMs(tempo: number): number {
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
          const note = this.harmonizeNote(step.note, currentChord, instrumentType);
          const noteString = noteToToneString(note);

          synth.triggerAttackRelease(noteString, step.duration, time, step.velocity);
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

  applyPresetTexture(texture: any): void {
    // Apply global tempo if specified in texture
    if (texture.tempo) {
      this.setTempo(texture.tempo);
    }

    // Apply global volume from mix settings
    if (texture.mix?.volume !== undefined) {
      let volume = texture.mix.volume;
      // Convert negative dB values to 0-1 range
      if (volume < 0) {
        volume = Math.pow(10, volume / 20); // Convert dB to linear
      }
      this.setVolume(Math.max(0, Math.min(1, volume)));
    }

    // Apply key/mode from scale if specified
    if (texture.scale && texture.scale.length > 0) {
      const scaleNotes = this.scaleToNotes(texture.scale);
      if (scaleNotes.length > 0) {
        const key = scaleNotes[0];
        // Use current mode if not specified in texture
        const currentState = this.state$.value;
        this.setKeyAndMode(key, currentState.mode);
      }
    }

    // Apply individual instrument parameters
    if (texture.instruments) {
      for (const [textureKey, params] of Object.entries(texture.instruments)) {
        const instrumentType = AMBIENT_TO_ENGINE_MAPPING[textureKey as keyof typeof AMBIENT_TO_ENGINE_MAPPING];
        if (instrumentType && typeof params === "object" && params !== null) {
          const instrument = this.ambientInstruments.get(instrumentType);
          if (instrument) {
            // Convert volume parameters if they're in dB
            const convertedParams = { ...params } as any;
            if (convertedParams.volume !== undefined && convertedParams.volume < 0) {
              convertedParams.volume = Math.pow(10, convertedParams.volume / 20);
            }

            instrument.updateParams(convertedParams);
          }
        }
      }
    }

    // Apply processing effects to ambient mixer
    this.applyTextureProcessing(texture);

    // Apply structural layering settings
    this.applyTextureLayering(texture);
  }

  private scaleToNotes(scaleNames: string[]): Note[] {
    return scaleNames.map(name =>
      NoteUtilities.Map[name.replace(/[♭♯]/, match => match === "♭" ? "b" : "#")] ?? Note.C
    );
  }

  private applyTextureProcessing(texture: any): void {
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

    // Apply voice-specific synthesis configurations
    this.applyVoiceConfigurations(texture);
  }

  private applyVoiceConfigurations(texture: any): void {
    if (!texture.voices || !Array.isArray(texture.voices)) return;

    const currentState = this.state$.value;

    for (const voice of texture.voices) {
      const { type, count = 1, envelope, oscillator } = voice;

      // Apply voice configurations to corresponding instrument types
      for (const instrumentType of currentState.instruments) {
        if (this.shouldApplyVoiceToInstrument(type, instrumentType)) {
          this.configureInstrumentVoice(instrumentType, {
            type,
            count,
            envelope: envelope || {},
            oscillator: oscillator || {},
          });
        }
      }
    }
  }

  private shouldApplyVoiceToInstrument(voiceType: string, instrumentType: InstrumentType): boolean {
    // Map voice types to instrument types
    switch (voiceType) {
      case "piano": {
        return instrumentType === InstrumentType.Melodic || instrumentType === InstrumentType.AmbientPad;
      }
      case "drone": {
        return instrumentType === InstrumentType.HarmonicDrone || instrumentType === InstrumentType.Pad;
      }
      case "granular": {
        return instrumentType === InstrumentType.Granular || instrumentType === InstrumentType.Atmosphere;
      }
      case "synth": {
        return instrumentType === InstrumentType.AmbientPad || instrumentType === InstrumentType.Lead;
      }
      default: {
        return false;
      }
    }
  }

  private configureInstrumentVoice(instrumentType: InstrumentType, voiceConfig: any): void {
    const synth = this.synthInstances.get(instrumentType);
    if (!synth) return;

    // Apply envelope settings if provided
    if (voiceConfig.envelope) {
      const envelope = voiceConfig.envelope;
      synth.set({
        envelope: {
          attack: envelope.attack,
          decay: envelope.decay,
          sustain: envelope.sustain,
          release: envelope.release,
        },
      });
    }

    // Apply oscillator settings if provided
    if (voiceConfig.oscillator) {
      const oscillator = voiceConfig.oscillator;

      if (oscillator.type) {
        synth.set({ oscillator: { type: oscillator.type } });
      }
    }

    // Apply voice character through additional effects based on voice type
    this.applyVoiceCharacteristics(synth, voiceConfig);
  }

  private applyVoiceCharacteristics(synth: Tone.PolySynth, voiceConfig: any): void {
    // Apply voice-specific characteristics to create authentic sounds
    switch (voiceConfig.type) {
      case "piano": {
        // Piano-like characteristics: sharp attack, quick decay
        synth.set({
          envelope: {
            attack: 0.001,
            decay: voiceConfig.envelope?.decay || 2,
            sustain: voiceConfig.envelope?.sustain || 0.1,
            release: voiceConfig.envelope?.release || 3,
          },
          oscillator: {
            type: "triangle", // More piano-like than sine
          },
        });
        break;
      }
      case "drone": {
        // Drone characteristics: very slow attack, long sustain
        synth.set({
          envelope: {
            attack: voiceConfig.envelope?.attack || 8,
            decay: 0,
            sustain: 1,
            release: voiceConfig.envelope?.release || 12,
          },
          oscillator: {
            type: "sawtooth", // Rich harmonic content for drones
          },
        });
        break;
      }
      case "granular": {
        // Granular synthesis simulation with choppy envelope
        synth.set({
          envelope: {
            attack: 0.01,
            decay: voiceConfig.envelope?.decay || 0.1,
            sustain: voiceConfig.envelope?.sustain || 0.3,
            release: voiceConfig.envelope?.release || 0.2,
          },
          oscillator: { type: "square" },
        });
        break;
      }
      default: {
        synth.set({ oscillator: { type: voiceConfig.oscillator?.type || "sine" } });
        break;
      }
    }

    if (voiceConfig.count > 1 && voiceConfig.oscillator?.detuneRange) {
      this.applyVoiceDetuning(synth, voiceConfig.count, voiceConfig.oscillator.detuneRange);
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

  private applyTextureLayering(texture: any): void {
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

    // Apply generative patterns if specified
    this.applyGenerativePatterns(texture);
  }

  private applyGenerativePatterns(texture: any): void {
    if (!texture.structure?.generativePattern) return;

    const patternType = texture.structure.generativePattern as "random-walk" | "euclidean" | "static-drone" | "markov";
    const density = texture.structure.density || 0.5;
    const randomness = texture.structure.randomness || 0.3;
    const currentState = this.state$.value;
    const scale = this.currentScale$.value;
    const seed = currentState.randomization.seed || Math.random();

    // Generate new patterns for non-ambient instruments using the specified pattern type
    const patterns = new Map(this.patterns$.value);
    let patternsUpdated = false;

    for (const instrumentType of currentState.instruments) {
      if (!this.isAmbientInstrument(instrumentType)) {
        const patternLength = this.getPatternLengthForType(instrumentType, patternType);
        const newPattern = PatternRandomizer.generatePatternByType(
          patternType,
          instrumentType,
          patternLength,
          scale,
          density,
          randomness,
          seed + Object.values(InstrumentType).indexOf(instrumentType), // Use instrument type as additional seed variation
        );

        patterns.set(instrumentType, newPattern);
        patternsUpdated = true;
      }
    }

    if (patternsUpdated) {
      this.patterns$.next(patterns);
    }
  }

  private getPatternLengthForType(
    instrumentType: InstrumentType,
    patternType: "random-walk" | "euclidean" | "static-drone" | "markov",
  ): number {
    // Different pattern types work better with different lengths
    switch (patternType) {
      case "static-drone": {
        return 4;
      } // Short patterns for sustained drone notes
      case "euclidean": {
        return 16;
      } // Medium length for rhythmic patterns
      case "random-walk": {
        return 12;
      } // Medium length for melodic wandering
      case "markov": {
        return 8;
      } // Shorter for more coherent musical phrases
      default: {
        return 16;
      }
    }
  }

  // setInstruments(instruments: Set<InstrumentType>): void {
  //   const currentState = this.state$.value;

  //   this.updateState(state => ({ ...state, instruments: new SvelteSet(instruments) }));
  //   this.events$.next({ type: "instruments-set", timestamp: Tone.now(), data: { instruments: [...instruments] } });
  // }

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
