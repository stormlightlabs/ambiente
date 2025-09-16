import type { StereoImagingParams } from "$lib/types/audio-effects";
import { BehaviorSubject, Observable } from "rxjs";
import * as Tone from "tone";

export class StereoImagingEffect {
  private stereoWidener: Tone.StereoWidener;
  private bassMonoFilter: Tone.Filter;
  private haasDelay: Tone.Delay;
  private channelMerger: Tone.Merge;
  private channelSplitter: Tone.Split;
  private leftGain: Tone.Gain;
  private rightGain: Tone.Gain;
  private output: Tone.Gain;
  private params$: BehaviorSubject<StereoImagingParams>;

  constructor(initialParams: Partial<StereoImagingParams> = {}) {
    const defaultParams: StereoImagingParams = {
      enabled: true,
      width: 0.5,
      bassMonoFreq: 120,
      stereoEnhancement: 0.3,
      phase: 0,
      haasDelay: 0.02,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);

    this.stereoWidener = new Tone.StereoWidener(defaultParams.width);
    this.bassMonoFilter = new Tone.Filter({ frequency: defaultParams.bassMonoFreq, type: "highpass" });

    this.haasDelay = new Tone.Delay(defaultParams.haasDelay);
    this.channelSplitter = new Tone.Split();
    this.channelMerger = new Tone.Merge();
    this.leftGain = new Tone.Gain(1);
    this.rightGain = new Tone.Gain(1);
    this.output = new Tone.Gain(1);

    this.setupSignalChain();
    this.subscribeToParams();
  }

  /**
   * 1. Split stereo signal
   * 2. Apply Haas delay to right channel for stereo width
   * 3. Bass mono processing - low frequencies stay centered
   * 4. Merge channels back
   * 5. Apply stereo widening
   */
  private setupSignalChain(): void {
    this.channelSplitter.connect(this.leftGain, 0, 0);
    this.channelSplitter.connect(this.rightGain, 1, 0);

    this.rightGain.connect(this.haasDelay);

    this.leftGain.connect(this.bassMonoFilter);
    this.haasDelay.connect(this.bassMonoFilter);

    this.leftGain.connect(this.channelMerger, 0, 0);
    this.haasDelay.connect(this.channelMerger, 0, 1);

    this.channelMerger.connect(this.stereoWidener);
    this.stereoWidener.connect(this.output);
  }

  /**
   * Applies phase offset for stereo enhancement, then adjust channel gains
   */
  private subscribeToParams(): void {
    this.params$.subscribe(params => {
      this.stereoWidener.width.value = params.width;
      this.bassMonoFilter.frequency.value = params.bassMonoFreq;
      this.haasDelay.delayTime.value = params.haasDelay;

      const phaseOffset = params.phase * Math.PI / 180;
      this.rightGain.gain.value = Math.cos(phaseOffset);

      const enhancement = params.stereoEnhancement;
      this.leftGain.gain.value = 1 - enhancement * 0.2;
      this.rightGain.gain.value *= 1 + enhancement * 0.2;
    });
  }

  updateParams(newParams: Partial<StereoImagingParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<StereoImagingParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  connectInput(source: Tone.ToneAudioNode): void {
    source.connect(this.channelSplitter);
  }

  getOutput(): Tone.ToneAudioNode {
    return this.output;
  }

  dispose(): void {
    this.stereoWidener.dispose();
    this.bassMonoFilter.dispose();
    this.haasDelay.dispose();
    this.channelMerger.dispose();
    this.channelSplitter.dispose();
    this.leftGain.dispose();
    this.rightGain.dispose();
    this.output.dispose();
  }
}
