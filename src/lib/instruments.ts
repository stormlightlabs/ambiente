import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { filter, map, takeUntil } from "rxjs/operators";
import * as Tone from "tone";
import { Note, NoteUtilities } from "./theory";

export enum AmbientInstrumentType {
  AmbientPad = "ambientPad",
  Granular = "granular",
  Melodic = "melodic",
  HarmonicDrone = "harmonicDrone",
  RhythmicPulse = "rhythmicPulse",
}

export type GranularParams = {
  volume: number;
  muted: boolean;
  enabled: boolean;
  density: number;
  grainSize: number;
  pitch: number;
  spread: number;
};

export interface Params {
  volume: number;
  muted: boolean;
  enabled: boolean;
}

export interface AmbientPadParams extends Params {
  filterFreq: number;
  resonance: number;
}

export interface MelodicParams extends Params {
  octave: number;
}

export interface HarmonicDroneParams extends Params {
  changeInterval: number;
  voiceLeading: number;
  voiceCount: number;
  spread: number;
}

export interface RhythmicPulseParams extends Params {
  baseTempo: number;
  accentProb: number;
  layerCount: number;
  tempoVar: number;
  syncopation: number;
}

export interface FieldRecordingParams extends Params {
  textureType: 'rain' | 'forest' | 'urban' | 'wind' | 'ocean';
  density: number;
  filterFreq: number;
  reverb: number;
  fadeTime: number;
}

export class GranularSynth {
  private output: Tone.Gain;
  private grainSynths: { synth: Tone.PolySynth; panner: Tone.Panner }[];
  private params$: BehaviorSubject<GranularParams>;
  private scheduler?: ReturnType<typeof setTimeout>;
  private subscriptions: Subscription[] = [];
  private destroy$ = new BehaviorSubject<void>(undefined);
  private currentScale: Note[] = [];

  constructor(initialParams: Partial<GranularParams> = {}) {
    const defaultParams: GranularParams = {
      volume: 0.35,
      muted: false,
      enabled: true,
      density: 0.2,
      grainSize: 0.15,
      pitch: -1,
      spread: 300,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    this.grainSynths = Array.from({ length: 4 }, () => {
      const synth = new Tone.PolySynth(Tone.Synth, {
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2 },
        oscillator: { type: "sine" },
      });

      const filter = new Tone.Filter({ frequency: 800, type: "lowpass", Q: 1 });
      const panner = new Tone.Panner(0);

      synth.connect(filter);
      filter.connect(panner);
      panner.connect(this.output);

      return { synth, panner };
    });

    this.initializeGrainScheduling();
  }

  private initializeGrainScheduling(): void {
    this.subscriptions.push(
      this.params$.pipe(map(params => params.enabled && !params.muted), filter(Boolean), takeUntil(this.destroy$))
        .subscribe(() => {
          this.startGrainScheduling();
        }),
      this.params$.pipe(map(params => !params.enabled || params.muted), filter(Boolean), takeUntil(this.destroy$))
        .subscribe(() => {
          this.stopGrainScheduling();
        }),
      this.params$.pipe(map(params => params.volume), takeUntil(this.destroy$)).subscribe(volume => {
        this.output.gain.value = volume;
      }),
    );
  }

  private startGrainScheduling(): void {
    this.stopGrainScheduling();

    const scheduleNextGrain = () => {
      const params = this.params$.value;
      if (!params.enabled || params.muted) return;

      const avgInterval = 1000 / params.density;
      const jitter = avgInterval * 0.3;
      const nextInterval = avgInterval + (Math.random() - 0.5) * jitter;

      this.scheduler = setTimeout(() => {
        this.triggerGrain();
        scheduleNextGrain();
      }, Math.max(50, nextInterval));
    };

    scheduleNextGrain();
  }

  private stopGrainScheduling(): void {
    if (this.scheduler) {
      clearTimeout(this.scheduler);
      this.scheduler = undefined;
    }
  }

  private triggerGrain(): void {
    const params = this.params$.value;

    if (this.currentScale.length === 0) return;

    const baseNote = this.currentScale[Math.floor(Math.random() * this.currentScale.length)];
    const octave = 3 + Math.floor(Math.random() * 2);
    const pitchOffset = params.pitch + (Math.random() - 0.5) * 2;

    const noteFreq = Tone.Frequency(`${NoteUtilities.toString(baseNote)}${octave}`).toFrequency();
    const finalFreq = noteFreq * Math.pow(2, pitchOffset / 12);

    const synthIndex = Math.floor(Math.random() * this.grainSynths.length);
    const { synth, panner } = this.grainSynths[synthIndex];

    const grainDuration = params.grainSize * (0.8 + Math.random() * 0.4);

    if (params.spread > 0) {
      const pan = (Math.random() - 0.5) * (params.spread / 500);
      panner.pan.value = Math.max(-1, Math.min(1, pan));
    }

    const now = Tone.now();
    const velocity = 0.1 + Math.random() * 0.2;

    synth.triggerAttackRelease(finalFreq, grainDuration, now, velocity);
  }

  setScale(scale: Note[]): void {
    this.currentScale = [...scale];
  }

  updateParams(newParams: Partial<GranularParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<GranularParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  dispose(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.stopGrainScheduling();

    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];

    for (const { synth, panner } of this.grainSynths) {
      synth.dispose();
      panner.dispose();
    }
    this.output.dispose();
  }
}

export class AmbientPadSynth {
  private synth: Tone.PolySynth;
  private filter: Tone.Filter;
  private output: Tone.Gain;
  private params$: BehaviorSubject<AmbientPadParams>;
  private subscriptions: Subscription[] = [];
  private currentChord: Note[] = [];
  private activeNotes: Set<string> = new Set();

  constructor(initialParams: Partial<AmbientPadParams> = {}) {
    const defaultParams: AmbientPadParams = {
      volume: 0.6,
      muted: false,
      enabled: true,
      filterFreq: 400,
      resonance: 1.5,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    this.synth = new Tone.PolySynth(Tone.Synth, {
      envelope: { attack: 2, decay: 0.5, sustain: 0.8, release: 4 },
      oscillator: { type: "sawtooth" },
    });

    this.filter = new Tone.Filter({ frequency: defaultParams.filterFreq, type: "lowpass", Q: defaultParams.resonance });

    this.synth.connect(this.filter);
    this.filter.connect(this.output);

    this.initializeParameterBindings();
  }

  private initializeParameterBindings(): void {
    this.subscriptions.push(this.params$.subscribe(params => {
      this.output.gain.value = params.muted ? 0 : params.volume;
      this.filter.frequency.value = params.filterFreq;
      this.filter.Q.value = params.resonance;

      if (params.enabled && !params.muted) {
        this.playCurrentChord();
      } else {
        this.stopAllNotes();
      }
    }));
  }

  setChord(chord: Note[]): void {
    this.currentChord = [...chord];
    const params = this.params$.value;
    if (params.enabled && !params.muted) {
      this.playCurrentChord();
    }
  }

  private playCurrentChord(): void {
    this.stopAllNotes();

    if (this.currentChord.length === 0) return;

    const octave = 3;
    for (const note of this.currentChord) {
      const noteString = `${NoteUtilities.toString(note)}${octave}`;
      this.synth.triggerAttack(noteString, Tone.now(), 0.3);
      this.activeNotes.add(noteString);
    }
  }

  private stopAllNotes(): void {
    for (const noteString of this.activeNotes) {
      this.synth.triggerRelease(noteString);
    }
    this.activeNotes.clear();
  }

  updateParams(newParams: Partial<AmbientPadParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<AmbientPadParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  dispose(): void {
    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];

    this.stopAllNotes();
    this.synth.dispose();
    this.filter.dispose();
    this.output.dispose();
  }
}

export class MelodicSynth {
  private synth: Tone.PolySynth;
  private output: Tone.Gain;
  private params$: BehaviorSubject<MelodicParams>;
  private subscriptions: Subscription[] = [];
  private destroy$ = new BehaviorSubject<void>(undefined);
  private currentScale: Note[] = [];
  private scheduler?: ReturnType<typeof setTimeout>;

  constructor(initialParams: Partial<MelodicParams> = {}) {
    const defaultParams: MelodicParams = { volume: 0.5, muted: false, enabled: true, octave: 4, ...initialParams };

    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    this.synth = new Tone.PolySynth(Tone.Synth, {
      envelope: { attack: 0.1, decay: 1, sustain: 0.3, release: 2 },
      oscillator: { type: "triangle" },
    });

    this.synth.connect(this.output);
    this.initializeMelodicScheduling();
  }

  private initializeMelodicScheduling(): void {
    this.subscriptions.push(
      this.params$.pipe(map(params => params.enabled && !params.muted), filter(Boolean), takeUntil(this.destroy$))
        .subscribe(() => {
          this.startMelodicScheduling();
        }),
      this.params$.pipe(map(params => !params.enabled || params.muted), filter(Boolean), takeUntil(this.destroy$))
        .subscribe(() => {
          this.stopMelodicScheduling();
        }),
      this.params$.pipe(map(params => params.volume), takeUntil(this.destroy$)).subscribe(volume => {
        this.output.gain.value = volume;
      }),
    );
  }

  private startMelodicScheduling(): void {
    this.stopMelodicScheduling();

    const scheduleNextNote = () => {
      const params = this.params$.value;
      if (!params.enabled || params.muted || this.currentScale.length === 0) return;

      const nextInterval = 3000 + Math.random() * 5000;

      this.scheduler = setTimeout(() => {
        this.triggerMelodicNote();
        scheduleNextNote();
      }, nextInterval);
    };

    scheduleNextNote();
  }

  private stopMelodicScheduling(): void {
    if (this.scheduler) {
      clearTimeout(this.scheduler);
      this.scheduler = undefined;
    }
  }

  private triggerMelodicNote(): void {
    const params = this.params$.value;
    if (this.currentScale.length === 0) return;

    const scaleIndex = Math.floor(Math.random() * Math.random() * this.currentScale.length);
    const note = this.currentScale[scaleIndex];
    const noteString = `${NoteUtilities.toString(note)}${params.octave}`;

    const duration = 1 + Math.random() * 3;
    const velocity = 0.1 + Math.random() * 0.2;

    this.synth.triggerAttackRelease(noteString, duration, Tone.now(), velocity);
  }

  setScale(scale: Note[]): void {
    this.currentScale = [...scale];
  }

  updateParams(newParams: Partial<MelodicParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<MelodicParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  dispose(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.stopMelodicScheduling();

    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];

    this.synth.dispose();
    this.output.dispose();
  }
}

export class HarmonicDroneSynth {
  private synths: Tone.PolySynth[];
  private output: Tone.Gain;
  private params$: BehaviorSubject<HarmonicDroneParams>;
  private subscriptions: Subscription[] = [];
  private destroy$ = new BehaviorSubject<void>(undefined);
  private currentChord: Note[] = [];
  private activeNotes: Set<string> = new Set();
  private changeScheduler?: ReturnType<typeof setTimeout>;

  constructor(initialParams: Partial<HarmonicDroneParams> = {}) {
    const defaultParams: HarmonicDroneParams = {
      volume: 0.45,
      muted: false,
      enabled: true,
      changeInterval: 8,
      voiceLeading: 0.7,
      voiceCount: 4,
      spread: 1.5,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    this.synths = Array.from({ length: defaultParams.voiceCount }, (_, index) => {
      const synth = new Tone.PolySynth(Tone.Synth, {
        envelope: { attack: 8, decay: 0, sustain: 1, release: 10 },
        oscillator: { type: "sine" },
      });

      const detune = (index - defaultParams.voiceCount / 2) * defaultParams.spread;
      synth.set({ detune });

      synth.connect(this.output);
      return synth;
    });

    this.initializeDroneManagement();
  }

  private initializeDroneManagement(): void {
    this.subscriptions.push(
      this.params$.pipe(map(params => params.volume), takeUntil(this.destroy$)).subscribe(volume => {
        this.output.gain.value = volume;
      }),
      this.params$.subscribe(params => {
        if (params.enabled && !params.muted) {
          if (this.currentChord.length > 0) {
            this.updateDroneChord();
          }
        } else {
          this.stopAllNotes();
        }
      }),
    );
  }

  setChord(chord: Note[]): void {
    this.currentChord = [...chord];
    const params = this.params$.value;
    if (params.enabled && !params.muted) {
      this.updateDroneChord();
    }
  }

  private updateDroneChord(): void {
    const params = this.params$.value;
    if (this.currentChord.length === 0) return;

    for (const noteString of this.activeNotes) {
      if (Math.random() > params.voiceLeading) {
        const synthIndex = Math.floor(Math.random() * this.synths.length);
        this.synths[synthIndex].triggerRelease(noteString);
      }
    }

    this.activeNotes.clear();

    const baseOctave = 2;
    for (let octave = baseOctave; octave <= baseOctave + 1; octave++) {
      for (const note of this.currentChord) {
        const noteString = `${NoteUtilities.toString(note)}${octave}`;
        const synthIndex = Math.floor(Math.random() * this.synths.length);

        this.synths[synthIndex].triggerAttack(noteString, Tone.now(), 0.15);
        this.activeNotes.add(noteString);
      }
    }
  }

  private stopAllNotes(): void {
    for (const noteString of this.activeNotes) {
      for (const synth of this.synths) {
        synth.triggerRelease(noteString);
      }
    }
    this.activeNotes.clear();
  }

  updateParams(newParams: Partial<HarmonicDroneParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);

    if (newParams.voiceCount && newParams.voiceCount !== currentParams.voiceCount) {
      this.rebuildSynths(updatedParams);
    }
  }

  private rebuildSynths(params: HarmonicDroneParams): void {
    for (const synth of this.synths) {
      synth.dispose();
    }

    this.synths = Array.from({ length: params.voiceCount }, (_, index) => {
      const synth = new Tone.PolySynth(Tone.Synth, {
        envelope: { attack: 8, decay: 0, sustain: 1, release: 10 },
        oscillator: { type: "sine" },
      });

      const detune = (index - params.voiceCount / 2) * params.spread;
      synth.set({ detune });

      synth.connect(this.output);
      return synth;
    });
  }

  getParams(): Observable<HarmonicDroneParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  dispose(): void {
    this.destroy$.next();
    this.destroy$.complete();

    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];

    if (this.changeScheduler) {
      clearTimeout(this.changeScheduler);
    }

    for (const synth of this.synths) {
      synth.dispose();
    }
    this.output.dispose();
  }
}

export class RhythmicPulseSynth {
  private synths: Tone.PolySynth[];
  private output: Tone.Gain;
  private params$: BehaviorSubject<RhythmicPulseParams>;
  private subscriptions: Subscription[] = [];
  private destroy$ = new BehaviorSubject<void>(undefined);
  private currentScale: Note[] = [];
  private layers: ReturnType<typeof setTimeout>[] = [];

  constructor(initialParams: Partial<RhythmicPulseParams> = {}) {
    const defaultParams: RhythmicPulseParams = {
      volume: 0.4,
      muted: false,
      enabled: true,
      baseTempo: 90,
      accentProb: 0.3,
      layerCount: 3,
      tempoVar: 0.1,
      syncopation: 0.4,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    this.synths = Array.from({ length: defaultParams.layerCount }, () => {
      const synth = new Tone.PolySynth(Tone.Synth, {
        envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.3 },
        oscillator: { type: "square" },
      });

      synth.connect(this.output);
      return synth;
    });

    this.initializeRhythmicScheduling();
  }

  private initializeRhythmicScheduling(): void {
    this.subscriptions.push(
      this.params$.pipe(map(params => params.enabled && !params.muted), filter(Boolean), takeUntil(this.destroy$))
        .subscribe(() => {
          this.startRhythmicLayers();
        }),
      this.params$.pipe(map(params => !params.enabled || params.muted), filter(Boolean), takeUntil(this.destroy$))
        .subscribe(() => {
          this.stopRhythmicLayers();
        }),
      this.params$.pipe(map(params => params.volume), takeUntil(this.destroy$)).subscribe(volume => {
        this.output.gain.value = volume;
      }),
    );
  }

  private startRhythmicLayers(): void {
    this.stopRhythmicLayers();

    const params = this.params$.value;
    const baseInterval = 60_000 / params.baseTempo;

    for (let layer = 0; layer < Math.min(params.layerCount, this.synths.length); layer++) {
      const layerMultiplier = Math.pow(2, layer);
      const layerInterval = baseInterval / layerMultiplier;

      const scheduleLayer = () => {
        if (!this.params$.value.enabled || this.params$.value.muted) return;

        if (Math.random() < 0.3 / layerMultiplier) {
          this.triggerRhythmicPulse(layer);
        }

        const variance = 1 + (Math.random() - 0.5) * params.tempoVar;
        const syncopationOffset = Math.random() < params.syncopation ? layerInterval * 0.5 : 0;
        const nextInterval = layerInterval * variance + syncopationOffset;

        const timeout = setTimeout(scheduleLayer, Math.max(50, nextInterval));
        this.layers[layer] = timeout;
      };

      scheduleLayer();
    }
  }

  private stopRhythmicLayers(): void {
    for (const timeout of this.layers) {
      clearTimeout(timeout);
    }
    this.layers = [];
  }

  private triggerRhythmicPulse(layerIndex: number): void {
    const params = this.params$.value;
    if (this.currentScale.length === 0) return;

    const synth = this.synths[layerIndex];
    if (!synth) return;

    const scaleIndex = Math.floor(Math.random() * Math.min(4, this.currentScale.length));
    const note = this.currentScale[scaleIndex];
    const octave = 2 + layerIndex;

    const noteString = `${NoteUtilities.toString(note)}${octave}`;

    const velocity = Math.random() < params.accentProb ? 0.3 : 0.1;
    const duration = 0.1 + Math.random() * 0.2;

    synth.triggerAttackRelease(noteString, duration, Tone.now(), velocity);
  }

  setScale(scale: Note[]): void {
    this.currentScale = [...scale];
  }

  updateParams(newParams: Partial<RhythmicPulseParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);

    if (
      newParams.baseTempo && Math.abs(newParams.baseTempo - currentParams.baseTempo) > 5 && updatedParams.enabled
      && !updatedParams.muted
    ) {
      this.startRhythmicLayers();
    }
  }

  getParams(): Observable<RhythmicPulseParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  dispose(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.stopRhythmicLayers();

    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];

    for (const synth of this.synths) {
      synth.dispose();
    }
    this.output.dispose();
  }
}
