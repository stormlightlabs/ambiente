import type { MelodicParams } from "$lib/types/params";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { filter, map, takeUntil } from "rxjs/operators";
import * as Tone from "tone";
import { Note, NoteUtilities } from "../theory";

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
