import type { AdaptiveDynamicsParams } from "$lib/types/audio-effects";
import { BehaviorSubject, Observable } from "rxjs";
import * as Tone from "tone";

export class AdaptiveDynamicsEffect {
  private compressor: Tone.Compressor;
  private analyser: Tone.Analyser;
  private limiter: Tone.Limiter;
  private adaptiveGain: Tone.Gain;
  private output: Tone.Gain;
  private params$: BehaviorSubject<AdaptiveDynamicsParams>;
  private analysisSchedulerId?: number;
  private levelHistory: number[] = [];

  constructor(initialParams: Partial<AdaptiveDynamicsParams> = {}) {
    const defaultParams = {
      enabled: true,
      analysisWindow: 100,
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.1,
      lookAhead: 0.005,
      adaptiveGain: true,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);

    this.analyser = new Tone.Analyser("waveform", 256);
    this.compressor = new Tone.Compressor({
      threshold: defaultParams.threshold,
      ratio: defaultParams.ratio,
      attack: defaultParams.attack,
      release: defaultParams.release,
    });

    this.limiter = new Tone.Limiter(-1);
    this.adaptiveGain = new Tone.Gain(1);
    this.output = new Tone.Gain(1);

    this.setupSignalChain();
    this.subscribeToParams();
  }

  private setupSignalChain(): void {
    this.analyser.connect(this.compressor);
    this.compressor.connect(this.adaptiveGain);
    this.adaptiveGain.connect(this.limiter);
    this.limiter.connect(this.output);
  }

  private subscribeToParams(): void {
    this.params$.subscribe(params => {
      this.compressor.threshold.value = params.threshold;
      this.compressor.ratio.value = params.ratio;
      this.compressor.attack.value = params.attack;
      this.compressor.release.value = params.release;

      if (params.enabled && params.adaptiveGain) {
        this.startAdaptiveAnalysis();
      } else {
        this.stopAdaptiveAnalysis();
      }
    });
  }

  private startAdaptiveAnalysis(): void {
    this.stopAdaptiveAnalysis();

    const params = this.params$.value;
    const intervalSeconds = params.analysisWindow / 1000;

    const scheduleAnalysis = () => {
      this.analyzeAndAdapt();
      this.analysisSchedulerId = Tone.getTransport().schedule(scheduleAnalysis, `+${intervalSeconds}`);
    };

    this.analysisSchedulerId = Tone.getTransport().schedule(scheduleAnalysis, `+${intervalSeconds}`);
  }

  private stopAdaptiveAnalysis(): void {
    if (this.analysisSchedulerId !== undefined) {
      Tone.getTransport().clear(this.analysisSchedulerId);
      this.analysisSchedulerId = undefined;
    }
  }

  private analyzeAndAdapt(): void {
    const params = this.params$.value;
    const waveform = this.analyser.getValue() as Float32Array;

    // Calculate RMS level + add small value to avoid log(0)
    let sum = 0;
    for (const element of waveform) {
      sum += element * element;
    }
    const rms = Math.sqrt(sum / waveform.length);
    const databaseLevel = 20 * Math.log10(rms + 1e-10);

    this.levelHistory.push(databaseLevel);
    if (this.levelHistory.length > 50) {
      this.levelHistory.shift();
    }

    if (this.levelHistory.length >= 3) {
      this.adaptGainBasedOnTrend(databaseLevel, params);
    }
  }

  private adaptGainBasedOnTrend(currentLevel: number, params: AdaptiveDynamicsParams): void {
    const recentLevels = this.levelHistory.slice(-5);
    const avgRecent = recentLevels.reduce((a, b) => a + b, 0) / recentLevels.length;
    const trend = currentLevel - avgRecent;

    let gainAdjustment = 1;

    if (trend < -3 && currentLevel < params.threshold + 6) {
      gainAdjustment = Math.min(2, 1 + (-trend * 0.05));
    } else if (trend > 3 && currentLevel > params.threshold - 3) {
      gainAdjustment = Math.max(0.5, 1 - (trend * 0.03));
    }

    const currentGain = this.adaptiveGain.gain.value;
    const targetGain = currentGain * gainAdjustment;
    const smoothTime = params.lookAhead * 10;

    this.adaptiveGain.gain.rampTo(Math.max(0.1, Math.min(3, targetGain)), smoothTime);
  }

  updateParams(newParams: Partial<AdaptiveDynamicsParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<AdaptiveDynamicsParams> {
    return this.params$.asObservable();
  }

  getCurrentLevel(): number {
    return this.levelHistory.length > 0 ? this.levelHistory.at(-1) ?? -60 : -60;
  }

  getReduction(): number {
    return this.compressor.reduction;
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  connectInput(source: Tone.ToneAudioNode): void {
    source.connect(this.analyser);
  }

  dispose(): void {
    this.stopAdaptiveAnalysis();

    this.compressor.dispose();
    this.analyser.dispose();
    this.limiter.dispose();
    this.adaptiveGain.dispose();
    this.output.dispose();
  }
}
