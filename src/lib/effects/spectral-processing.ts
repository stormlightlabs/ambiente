import type { SpectralProcessingParams } from "$lib/types/audio-effects";
import { BehaviorSubject, Observable } from "rxjs";
import * as Tone from "tone";

export class SpectralProcessingEffect {
  private analyser: Tone.Analyser;
  private convolver: Tone.Convolver;
  private filter: Tone.Filter;
  private output: Tone.Gain;
  private wet: Tone.CrossFade;
  private params$: BehaviorSubject<SpectralProcessingParams>;
  private animationFrame?: number;

  constructor(initialParams: Partial<SpectralProcessingParams> = {}) {
    const defaultParams: SpectralProcessingParams = {
      enabled: true,
      fftSize: 1024,
      windowType: "hann",
      spectralShift: 0,
      harmonicEnhancement: 0.2,
      noiseGate: -40,
      wet: 0.3,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);

    this.analyser = new Tone.Analyser("fft", defaultParams.fftSize);
    this.convolver = new Tone.Convolver();
    this.filter = new Tone.Filter({ frequency: 20_000, type: "lowpass" });
    this.output = new Tone.Gain(1);
    this.wet = new Tone.CrossFade(defaultParams.wet);

    this.setupSignalChain();
    this.startSpectralProcessing();
    this.subscribeToParams();
  }

  private setupSignalChain(): void {
    this.analyser.connect(this.filter);
    this.filter.connect(this.convolver);

    this.analyser.connect(this.wet.a); // Dry
    this.convolver.connect(this.wet.b); // Wet
    this.wet.connect(this.output);
  }

  private subscribeToParams(): void {
    this.params$.subscribe(params => {
      this.wet.fade.value = params.wet;
      this.filter.frequency.value = params.harmonicEnhancement * 10_000 + 1000;

      if (params.enabled && !this.animationFrame) {
        this.startSpectralProcessing();
      } else if (!params.enabled && this.animationFrame) {
        this.stopSpectralProcessing();
      }
    });
  }

  private startSpectralProcessing(): void {
    const process = () => {
      const params = this.params$.value;
      if (!params.enabled) return;

      const data = this.analyser.getValue() as Float32Array;
      this.processSpectralData(data, params);

      this.animationFrame = requestAnimationFrame(process);
    };

    process();
  }

  private processSpectralData(data: Float32Array, params: SpectralProcessingParams): void {
    for (let index = 0; index < data.length; index++) {
      const magnitude = Math.abs(data[index]);

      // Noise gate
      if (magnitude < Tone.dbToGain(params.noiseGate)) {
        data[index] *= 0.1;
      }

      // Harmonic enhancement
      if (index % 2 === 0) {
        data[index] *= 1 + params.harmonicEnhancement;
      }
    }
  }

  private stopSpectralProcessing(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
  }

  updateParams(newParams: Partial<SpectralProcessingParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<SpectralProcessingParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  connectInput(source: Tone.ToneAudioNode): void {
    source.connect(this.analyser);
  }

  getOutput(): Tone.ToneAudioNode {
    return this.output;
  }

  dispose(): void {
    this.stopSpectralProcessing();
    this.analyser.dispose();
    this.convolver.dispose();
    this.filter.dispose();
    this.output.dispose();
    this.wet.dispose();
  }
}
