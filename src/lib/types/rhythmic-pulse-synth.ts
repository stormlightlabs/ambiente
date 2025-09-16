import type { RhythmicPulseParams } from "$lib/types/params";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { filter, map, takeUntil } from "rxjs/operators";
import * as Tone from "tone";
import { Note, NoteUtilities } from "../theory";

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
