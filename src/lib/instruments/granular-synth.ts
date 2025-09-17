import { Note, NoteUtilities } from "$lib/theory";
import { BaseInstrument } from "$lib/types/base";
import type { GranularParams } from "$lib/types/params";
import { BehaviorSubject, Observable } from "rxjs";
import { map, takeUntil } from "rxjs/operators";
import * as Tone from "tone";

export class GranularSynth extends BaseInstrument<GranularParams> {
  private grainSynths: { synth: Tone.PolySynth; panner: Tone.Panner }[];
  private params$: BehaviorSubject<GranularParams>;
  private destroy$ = new BehaviorSubject<void>(undefined);
  private timeSinceLastGrain = 0;

  PREFIX = "[GranularSynth]";

  constructor(initial: Partial<GranularParams> = {}) {
    super(initial);
    const defaultParams: GranularParams = {
      volume: 0.35,
      muted: false,
      enabled: true,
      density: 0.2,
      grainSize: 0.15,
      pitch: -1,
      spread: 300,
      ...initial,
    };

    this.log(`Creating GranularSynth with params:`, defaultParams);
    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    this.grainSynths = Array.from({ length: 4 }, () => {
      const synth = new Tone.PolySynth({
        voice: Tone.Synth,
        options: { envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2 }, oscillator: { type: "sine" } },
        maxPolyphony: 4,
      });

      const filter = new Tone.Filter({ frequency: 800, type: "lowpass", Q: 1 });
      const panner = new Tone.Panner(0);

      synth.connect(filter);
      filter.connect(panner);
      panner.connect(this.output);

      return { synth, panner };
    });
    this.log(`Created ${this.grainSynths.length} grain synths with audio chain`);

    this.initializeGrainScheduling();
  }

  private initializeGrainScheduling(): void {
    this.subscriptions.push(
      this.params$.pipe(map(params => params.volume), takeUntil(this.destroy$)).subscribe(volume => {
        this.output.gain.value = volume;
      }),
    );
  }

  tick(time: number, tickDuration: number): void {
    const params = this.params$.value;
    if (!params.enabled || params.muted) return;

    this.timeSinceLastGrain += tickDuration;
    const avgInterval = 1 / params.density;
    const jitter = avgInterval * 0.3;

    if (this.timeSinceLastGrain >= avgInterval - jitter) {
      this.triggerGrain(time);
      this.timeSinceLastGrain = 0; // Reset
    }
  }

  private triggerGrain(time: number): void {
    const params = this.params$.value;

    if (this.currentScale.length === 0) {
      return;
    }

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

    const velocity = 0.1 + Math.random() * 0.2;

    synth.triggerAttackRelease(finalFreq, grainDuration, time, velocity);
  }

  setScale(scale: Note[]): void {
    this.log(`Setting scale:`, scale?.map(n => Note[n]).join(", ") || "none");
    this.currentScale = [...scale];
  }

  updateParams(newParams: Partial<GranularParams>): void {
    this.log(`Updating params:`, newParams);
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
    this.log(`Disposing GranularSynth`);
    this.destroy$.next();
    this.destroy$.complete();

    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];
    this.log(`Unsubscribed from all parameter changes`);

    this.log(`Disposing ${this.grainSynths.length} grain synths`);
    for (const { synth, panner } of this.grainSynths) {
      synth.dispose();
      panner.dispose();
    }
    this.output.dispose();
    this.log(`Disposed all audio nodes`);
  }
}
