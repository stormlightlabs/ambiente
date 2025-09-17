import { initializeAudio, ParameterAutomation } from "$lib/audio";
import { AmbientMixer } from "$lib/audio/mixer";
import { logger } from "$lib/debug/audio-logger";
import { AmbientPadSynth } from "$lib/instruments/ambient-pad";
import { ArpeggiatorSynth } from "$lib/instruments/arpeggiator";
import { GranularSynth } from "$lib/instruments/granular-synth";
import { HarmonicDroneSynth } from "$lib/instruments/harmonic-drone-synth";
import { MelodicSynth } from "$lib/instruments/melodic-synth";
import { VocalPadSynth } from "$lib/instruments/vocal-pads";
import { generateScale, Mode, Note } from "$lib/theory";
import type { AudioEngineState, AudioEvent, InstrumentPattern, RandomizationParams } from "$lib/types/audio";
import { FieldRecordingSynth } from "$lib/types/field-recording-synth";
import { InstrumentType } from "$lib/types/instruments";
import type { Texture } from "$lib/types/presets";
import { RhythmicPulseSynth } from "$lib/types/rhythmic-pulse-synth";
import type { Optional } from "$lib/types/shared";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import { distinctUntilChanged, map } from "rxjs/operators";
import * as Tone from "tone";
import { AudioStreams } from "./audio-streams";
import { InstrumentManager } from "./instrument-manager";
import { PresetProcessor } from "./preset-processor";
import { createDefaultPattern, getNestedParam, isAmbientInstrument, type SynthKind } from "./utilities";

export class AudioEngine {
  private readonly state$: BehaviorSubject<AudioEngineState>;
  private readonly events$: Subject<AudioEvent>;
  private readonly destroy$: Subject<void>;
  private readonly synthInstances: Map<InstrumentType, Tone.PolySynth>;
  private readonly patterns$: BehaviorSubject<Map<InstrumentType, InstrumentPattern>>;
  private readonly currentScale$: BehaviorSubject<Note[]>;
  private readonly currentChord$: BehaviorSubject<Note[]>;
  private readonly ambientInstruments: Map<InstrumentType, SynthKind>;
  PREFIX = "[AudioEngine]";

  private readonly ambientMixer: AmbientMixer;
  private readonly audioStreams: AudioStreams;
  private readonly presetProcessor: PresetProcessor;
  private readonly instrumentManager: InstrumentManager;

  constructor(initialState?: Partial<AudioEngineState>) {
    this.destroy$ = new Subject();
    this.events$ = new Subject();
    this.synthInstances = new Map();
    this.patterns$ = new BehaviorSubject(new Map());
    this.currentChord$ = new BehaviorSubject<Note[]>([]);
    this.ambientInstruments = new Map();
    this.currentScale$ = new BehaviorSubject<Note[]>([]);
    this.ambientMixer = new AmbientMixer();

    this.state$ = new BehaviorSubject<AudioEngineState>({
      isPlaying: false,
      tempo: 80,
      key: Note.C,
      mode: Mode.Ionian,
      currentChord: -1,
      volume: 0.7,
      instruments: new Set([InstrumentType.Pad, InstrumentType.Atmosphere]),
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

    this.audioStreams = new AudioStreams(
      this.state$,
      this.events$,
      this.destroy$,
      this.patterns$,
      this.currentScale$,
      this.currentChord$,
      this.synthInstances,
      this.ambientInstruments,
      this.ambientMixer,
    );

    this.presetProcessor = new PresetProcessor(
      this.state$,
      this.patterns$,
      this.currentScale$,
      this.synthInstances,
      this.ambientInstruments,
      this.ambientMixer,
    );

    this.instrumentManager = new InstrumentManager(
      this.state$,
      this.events$,
      this.patterns$,
      this.currentScale$,
      this.currentChord$,
      this.synthInstances,
      this.ambientInstruments,
      this.ambientMixer,
    );

    this.initializeAudioStreams();
  }

  private initializeAudioStreams(): void {
    this.audioStreams.initializeStreams();

    this.state$.pipe(
      map(state => state.instruments),
      distinctUntilChanged((a, b) => a.size === b.size && [...a].every(x => b.has(x))),
    ).subscribe(instruments => this.instrumentManager.updateInstruments(instruments));
  }

  private updateState(updater: (state: AudioEngineState) => AudioEngineState): void {
    this.state$.next(updater(this.state$.value));
  }

  private getNextMeasureBoundary(): string {
    const transport = Tone.getTransport();
    const positionString = transport.position.toString();
    this.log("Current transport position:", positionString);

    // Parse current position (format: "bars:quarters:sixteenths")
    const [bars] = positionString.split(":").map(Number);
    const nextMeasure = `${bars + 1}:0:0`;
    this.log("Next measure boundary:", nextMeasure);
    return nextMeasure;
  }

  private async initializeAudioWithTimeout(timeoutMs: number = 5000): Promise<void> {
    this.log("Initializing audio with timeout:", timeoutMs + "ms");

    const initPromise = initializeAudio();
    const timeoutPromise = new Promise((_, reject) => {
      const timeoutId = Tone.getTransport().schedule(() => {
        reject(new Error("Audio initialization timeout"));
      }, `+${timeoutMs / 1000}`);

      initPromise.finally(() => Tone.getTransport().clear(timeoutId));
    });

    await Promise.race([initPromise, timeoutPromise]);
    this.log("Audio initialization completed");
  }

  private async validateAudioContextState(): Promise<void> {
    const context = Tone.getContext();
    this.log("Validating audio context state:", context.state);

    if (context.state === "suspended") {
      this.log("Audio context suspended, attempting to resume...");
      try {
        await context.resume();
        this.log("Audio context resumed successfully");
      } catch (error) {
        throw new Error(`Failed to resume audio context: ${error}`);
      }
    }

    if (context.state !== "running") {
      throw new Error(`Audio context in invalid state: ${context.state}`);
    }

    const transport = Tone.getTransport();
    if (!transport) {
      throw new Error("Tone transport not available");
    }

    this.log("Audio context validation completed successfully");
  }

  getState$(): Observable<AudioEngineState> {
    return this.state$.asObservable();
  }

  getEvents$(): Observable<AudioEvent> {
    return this.events$.asObservable();
  }

  getChordProgression$(): Observable<Note[][]> {
    return this.audioStreams.getChordProgression$();
  }

  getCurrentChord$(): Observable<Note[]> {
    return this.currentChord$.asObservable();
  }

  async togglePlayback(): Promise<void> {
    const currentState = this.state$.value;
    this.log("togglePlayback - currentState.isPlaying:", currentState.isPlaying);

    // eslint-disable-next-line unicorn/no-negated-condition
    if (!currentState.isPlaying) {
      this.log("Starting playback - initializing audio...");

      try {
        await this.initializeAudioWithTimeout();
        await this.validateAudioContextState();
      } catch (error) {
        this.error("Failed to initialize audio:", error);
        return;
      }

      Tone.getTransport().start();
      this.log("Transport started");

      const nextTime = this.getNextMeasureBoundary();
      const enabled: Array<InstrumentType> = [];

      for (const [type, instrument] of this.ambientInstruments.entries()) {
        if (currentState.instruments.has(type)) {
          this.log("Scheduling ambient instrument to enable at:", nextTime, "type:", type);
          Tone.getTransport().schedule(() => {
            instrument.updateParams({ enabled: true });
          }, nextTime);
          enabled.push(type);
        }
      }
      this.log(`Scheduled ${enabled.length} ambient instruments for enablement:`, enabled);

      this.updateState(state => ({ ...state, isPlaying: true }));
      this.events$.next({ type: "play", timestamp: Tone.now() });
      this.log("Playback started successfully");
    } else {
      this.log("Stopping playback...");
      this.stop();
    }
  }

  setTempo(tempo: number): void {
    this.updateState(state => ({ ...state, tempo: Math.max(40, Math.min(200, tempo)) }));
  }

  setKeyAndMode(key: Note, mode: Mode): void {
    this.updateState(state => ({ ...state, key, mode, currentChord: 0 }));

    const scale = generateScale(key, mode);
    this.currentScale$.next(scale);
  }

  setVolume(volume: number): void {
    this.updateState(state => ({ ...state, volume: Math.max(0, Math.min(1, volume)) }));
  }

  applyPresetTexture(texture: Texture): void {
    this.presetProcessor.applyPresetTexture(
      texture,
      (tempo) => this.setTempo(tempo),
      (volume) => this.setVolume(volume),
      (key, mode) => this.setKeyAndMode(key, mode),
    );
  }

  toggleInstrument(kind: InstrumentType): void {
    this.instrumentManager.toggleInstrument(kind);
  }

  setInstrumentPattern(kind: InstrumentType, pattern: InstrumentPattern): void {
    this.instrumentManager.setInstrumentPattern(kind, pattern);
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
    this.log("Stopping audio engine...");
    this.updateState(state => ({ ...state, isPlaying: false }));

    let disabledCount = 0;
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
        this.log("Disabling ambient instrument:", instrument.constructor.name);
        instrument.updateParams({ enabled: false });
        disabledCount++;
      }
    }
    this.log(`Disabled ${disabledCount} ambient instruments`);

    let releasedCount = 0;
    for (const [type, synth] of this.synthInstances.entries()) {
      this.log("Releasing synth:", type);
      synth.releaseAll();
      releasedCount++;
    }

    this.log(`Released ${releasedCount} synths`);

    Tone.getTransport().stop();
    this.log("Transport stopped");

    this.events$.next({ type: "stop", timestamp: Tone.now() });
    this.log("Stop complete");
  }

  dispose(): void {
    this.log("Disposing audio engine...");
    this.destroy$.next();
    this.destroy$.complete();
    this.log("Destroy signal sent");

    if (this.state$.value.isPlaying) {
      this.stop();
    }

    this.log("Clearing scheduled transport events...");
    Tone.getTransport().cancel();

    this.log(`Disposing ${this.synthInstances.size} synths...`);
    for (const [type, synth] of this.synthInstances.entries()) {
      this.log("Disposing synth:", type);
      synth.dispose();
    }
    this.synthInstances.clear();

    this.log(`Disposing ${this.ambientInstruments.size} ambient instruments...`);
    for (const [type, instrument] of this.ambientInstruments.entries()) {
      this.log("Disposing ambient instrument:", type);
      instrument.dispose();
    }
    this.ambientInstruments.clear();

    this.log("Disposing mixer...");
    this.ambientMixer.dispose();

    this.log("Disposing transport...");
    Tone.getTransport().dispose();
    this.log("Disposal complete");
  }

  private log(message: string, ...args: any[]) {
    logger.debug(this.PREFIX, message, ...args);
  }

  private error(message: string, error_: unknown, ...args: any[]) {
    logger.error(this.PREFIX, message, error_, args);
  }
}

export const createAmbientAudioEngine = (initial?: Partial<AudioEngineState>): AudioEngine => {
  const final = {
    tempo: 72,
    key: Note.C,
    mode: Mode.Aeolian,
    volume: 0.6,
    instruments: new Set([
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
