import type { GranularParams } from "$lib/types/params";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { filter, map, takeUntil } from "rxjs/operators";
import * as Tone from "tone";
import { Note, NoteUtilities } from "../theory";

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
