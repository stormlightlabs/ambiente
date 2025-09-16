import type { TapeSaturationParams } from "$lib/types/audio-effects";
import { BehaviorSubject, Observable } from "rxjs";
import * as Tone from "tone";

export class TapeSaturationEffect {
  private waveshaper: Tone.WaveShaper;
  private preGain: Tone.Gain;
  private postGain: Tone.Gain;
  private lowpass: Tone.Filter;
  private noise: Tone.Noise;
  private noiseGain: Tone.Gain;
  private flutter: Tone.LFO;
  private output: Tone.Gain;
  private wet: Tone.CrossFade;
  private params$: BehaviorSubject<TapeSaturationParams>;

  constructor(initialParams: Partial<TapeSaturationParams> = {}) {
    const defaultParams: TapeSaturationParams = {
      enabled: true,
      drive: 0.3,
      warmth: 0.4,
      hiss: 0.1,
      flutter: 0.2,
      bias: 0,
      wet: 0.8,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);

    this.preGain = new Tone.Gain(1 + defaultParams.drive);
    this.waveshaper = new Tone.WaveShaper();
    this.postGain = new Tone.Gain(0.7);
    this.lowpass = new Tone.Filter({ frequency: 8000, type: "lowpass", Q: 0.7 });
    this.noise = new Tone.Noise({ type: "pink" });
    this.noiseGain = new Tone.Gain(defaultParams.hiss);
    this.flutter = new Tone.LFO({ frequency: 0.5 + defaultParams.flutter * 2, type: "sine" });
    this.output = new Tone.Gain(1);
    this.wet = new Tone.CrossFade(defaultParams.wet);

    this.setupSignalChain();
    this.createTapeResponse();
    this.subscribeToParams();
  }

  /**
   * Main signal path: input -> preGain -> waveshaper -> postGain -> lowpass -> wet.b
   *
   * Adds tape hiss + flutter modulation
   */
  private setupSignalChain(): void {
    this.preGain.connect(this.waveshaper);
    this.waveshaper.connect(this.postGain);
    this.postGain.connect(this.lowpass);

    // Add tape hiss
    this.noise.connect(this.noiseGain);
    this.noiseGain.connect(this.lowpass);
    this.noise.start();

    this.flutter.connect(this.postGain.gain);
    this.flutter.start();

    this.lowpass.connect(this.wet.b);
    this.wet.connect(this.output);
  }

  private createTapeResponse(): void {
    const length = 8192;
    const curve = new Float32Array(length);

    for (let index = 0; index < length; index++) {
      const x = (index / length) * 2 - 1;
      const params = this.params$.value;

      // Tape saturation curve - soft clipping with bias
      const biasedX = x + params.bias;
      let y = Math.tanh(biasedX * (1 + params.drive * 2));

      // Add some even harmonic distortion for warmth
      if (params.warmth > 0) {
        y += Math.sin(biasedX * Math.PI) * params.warmth * 0.1;
      }

      // Scale down to prevent clipping
      curve[index] = y * 0.8;
    }

    this.waveshaper.curve = curve;
  }

  /**
   * 1. Adjust lowpass frequency based on warmth
   * 2. Update flutter depth
   * 3. Recreate curve when drive, warmth, or bias changes
   */
  private subscribeToParams(): void {
    this.params$.subscribe(params => {
      this.preGain.gain.value = 1 + params.drive;
      this.wet.fade.value = params.wet;
      this.noiseGain.gain.value = params.hiss * 0.02;
      this.flutter.frequency.value = 0.3 + params.flutter * 1.5;

      const cutoff = 8000 - (params.warmth * 3000);
      this.lowpass.frequency.value = Math.max(2000, cutoff);

      this.flutter.amplitude.value = params.flutter * 0.05;

      this.createTapeResponse();
    });
  }

  updateParams(newParams: Partial<TapeSaturationParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<TapeSaturationParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  connectInput(source: Tone.ToneAudioNode): void {
    // Dry path
    source.connect(this.wet.a);
    // Wet path
    source.connect(this.preGain);
  }

  getOutput(): Tone.ToneAudioNode {
    return this.output;
  }

  dispose(): void {
    this.noise.stop();
    this.flutter.stop();

    this.waveshaper.dispose();
    this.preGain.dispose();
    this.postGain.dispose();
    this.lowpass.dispose();
    this.noise.dispose();
    this.noiseGain.dispose();
    this.flutter.dispose();
    this.output.dispose();
    this.wet.dispose();
  }
}
