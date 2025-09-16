import type { GranularDelayParams } from "$lib/types/audio-effects";
import { BehaviorSubject, Observable } from "rxjs";
import * as Tone from "tone";

export class GranularDelayEffect {
  private delays: Tone.Delay[];
  private grains: Tone.Gain[];
  private feedback: Tone.FeedbackDelay;
  private output: Tone.Gain;
  private wet: Tone.CrossFade;
  private params$: BehaviorSubject<GranularDelayParams>;
  private grainSchedulers: ReturnType<typeof setTimeout>[] = [];

  constructor(initialParams: Partial<GranularDelayParams> = {}) {
    const defaultParams: GranularDelayParams = {
      enabled: true,
      delayTime: 0.25,
      feedback: 0.3,
      grainSize: 0.1,
      grainDensity: 0.6,
      grainPitch: 0,
      grainSpread: 0.05,
      wet: 0.4,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);

    this.delays = [];
    this.grains = [];
    this.feedback = new Tone.FeedbackDelay(defaultParams.delayTime, defaultParams.feedback);
    this.output = new Tone.Gain(1);
    this.wet = new Tone.CrossFade(defaultParams.wet);

    this.setupGrainDelays();
    this.subscribeToParams();
  }

  private setupGrainDelays(): void {
    const grainCount = 8;

    for (let index = 0; index < grainCount; index++) {
      const delay = new Tone.Delay(0.1 + (index * 0.05));
      const grain = new Tone.Gain(0);

      delay.connect(grain);
      grain.connect(this.feedback);

      this.delays.push(delay);
      this.grains.push(grain);
    }

    this.feedback.connect(this.wet.b);
    this.wet.connect(this.output);
  }

  private subscribeToParams(): void {
    this.params$.subscribe(params => {
      this.feedback.delayTime.value = params.delayTime;
      this.feedback.feedback.value = params.feedback;
      this.wet.fade.value = params.wet;

      if (params.enabled) {
        this.startGranularScheduling();
      } else {
        this.stopGranularScheduling();
      }
    });
  }

  private startGranularScheduling(): void {
    this.stopGranularScheduling();

    const scheduleGrains = () => {
      const params = this.params$.value;
      if (!params.enabled) return;

      for (const [index, delay] of this.delays.entries()) {
        const grain = this.grains[index];

        if (Math.random() < params.grainDensity) {
          const pitchShift = params.grainPitch + (Math.random() - 0.5) * 0.2;
          const delayTime = params.delayTime + (Math.random() - 0.5) * params.grainSpread;
          const grainLength = params.grainSize * (0.8 + Math.random() * 0.4);

          delay.delayTime.value = Math.max(0.01, delayTime);

          grain.gain.setValueAtTime(0, Tone.now());
          grain.gain.linearRampToValueAtTime(0.3, Tone.now() + grainLength * 0.1);
          grain.gain.linearRampToValueAtTime(0.3, Tone.now() + grainLength * 0.9);
          grain.gain.linearRampToValueAtTime(0, Tone.now() + grainLength);
        }
      }

      const nextInterval = (1000 / params.grainDensity) * (0.5 + Math.random());
      const scheduler = setTimeout(scheduleGrains, nextInterval);
      this.grainSchedulers.push(scheduler);
    };

    scheduleGrains();
  }

  private stopGranularScheduling(): void {
    for (const scheduler of this.grainSchedulers) {
      clearTimeout(scheduler);
    }
    this.grainSchedulers = [];
  }

  updateParams(newParams: Partial<GranularDelayParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<GranularDelayParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  connectInput(source: Tone.ToneAudioNode): void {
    // Dry path
    source.connect(this.wet.a);
    // Wet path - connect to all grain delays
    for (const delay of this.delays) {
      source.connect(delay);
    }
  }

  getOutput(): Tone.ToneAudioNode {
    return this.output;
  }

  dispose(): void {
    this.stopGranularScheduling();

    for (const delay of this.delays) delay.dispose();
    for (const grain of this.grains) grain.dispose();

    this.feedback.dispose();
    this.output.dispose();
    this.wet.dispose();
  }
}
