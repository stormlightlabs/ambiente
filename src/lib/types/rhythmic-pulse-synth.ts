import { Note, NoteUtilities } from "$lib/theory";
import type { RhythmicPulseParams } from "$lib/types/params";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { map, takeUntil } from "rxjs/operators";
import * as Tone from "tone";

export class RhythmicPulseSynth {
  private synths: Tone.PolySynth[];
  private output: Tone.Gain;
  private params$: BehaviorSubject<RhythmicPulseParams>;
  private subscriptions: Subscription[] = [];
  private destroy$ = new BehaviorSubject<void>(undefined);
  private currentScale: Note[] = [];
  private layers: { timeSinceLastPulse: number }[] = [];

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
      this.params$.pipe(map(params => params.volume), takeUntil(this.destroy$)).subscribe(volume => {
        this.output.gain.value = volume;
      }),
    );

    for (let index = 0; index < this.params$.value.layerCount; index++) {
      this.layers.push({ timeSinceLastPulse: 0 });
    }
  }

  tick(time: number, tickDuration: number): void {
    const params = this.params$.value;
    if (!params.enabled || params.muted) return;

    const baseInterval = 60 / params.baseTempo;

    for (let index = 0; index < Math.min(params.layerCount, this.synths.length); index++) {
      const layer = this.layers[index];
      if (!layer) continue;

      layer.timeSinceLastPulse += tickDuration;

      const layerMultiplier = Math.pow(2, index);
      const layerInterval = baseInterval / layerMultiplier;

      if (layer.timeSinceLastPulse >= layerInterval && Math.random() < 0.8) {
        this.triggerRhythmicPulse(index, time);
        layer.timeSinceLastPulse = 0;
      }
    }
  }

  private triggerRhythmicPulse(layerIndex: number, time: number): void {
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

    synth.triggerAttackRelease(noteString, duration, time, velocity);
  }

  setScale(scale: Note[]): void {
    this.currentScale = [...scale];
  }

  updateParams(newParams: Partial<RhythmicPulseParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
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

    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];

    for (const synth of this.synths) {
      synth.dispose();
    }
    this.output.dispose();
  }
}
