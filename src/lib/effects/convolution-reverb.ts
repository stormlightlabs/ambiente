import type { ConvolutionReverbParams } from "$lib/types/audio-effects";
import { BehaviorSubject, Observable } from "rxjs";
import * as Tone from "tone";

export class ConvolutionReverbEffect {
  private convolver: Tone.Convolver;
  private preDelay: Tone.Delay;
  private filter: Tone.Filter;
  private output: Tone.Gain;
  private wet: Tone.CrossFade;
  private params$: BehaviorSubject<ConvolutionReverbParams>;

  /**
   * Free impulse response sources:
   * - OpenAIR: http://www.openairlib.net/ (university project with cathedral/hall IRs)
   * - Freesound: https://freesound.org (search "impulse response" or "room tone")
   * - EchoThief: Free impulse responses from various spaces
   */
  private impulseResponses: Record<string, string> = {
    small: "/impulses/small-room.wav",
    medium: "/impulses/medium-hall.wav",
    large: "/impulses/large-hall.wav",
    cathedral: "/impulses/cathedral.wav",
    hall: "/impulses/concert-hall.wav",
  };

  constructor(initialParams: Partial<ConvolutionReverbParams> = {}) {
    const defaultParams: ConvolutionReverbParams = {
      enabled: true,
      impulseUrl: "",
      roomSize: "medium",
      wet: 0.3,
      decay: 1,
      preDelay: 0.02,
      ...initialParams,
    };

    if (!defaultParams.impulseUrl) {
      defaultParams.impulseUrl = this.impulseResponses[defaultParams.roomSize];
    }

    this.params$ = new BehaviorSubject(defaultParams);

    this.convolver = new Tone.Convolver();
    this.preDelay = new Tone.Delay(defaultParams.preDelay);
    this.filter = new Tone.Filter({ frequency: 8000, type: "lowpass" });
    this.output = new Tone.Gain(1);
    this.wet = new Tone.CrossFade(defaultParams.wet);

    this.setupSignalChain();
    this.loadImpulseResponse(defaultParams.impulseUrl);
    this.subscribeToParams();
  }

  /** Wet path: input -> preDelay -> convolver -> filter -> wet.b  */
  private setupSignalChain(): void {
    this.preDelay.connect(this.convolver);
    this.convolver.connect(this.filter);
    this.filter.connect(this.wet.b);

    this.wet.connect(this.output);
  }

  /** @todo: We're using synthetic impulses for now - can be replaced with real files later  */
  private async loadImpulseResponse(_url: string): Promise<void> {
    this.createSyntheticImpulse();
  }

  private createSyntheticImpulse(): void {
    const params = this.params$.value;
    const length = this.getRoomLength(params.roomSize);
    const sampleRate = Tone.getContext().sampleRate;
    const impulse = Tone.getContext().createBuffer(2, length * sampleRate, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let index = 0; index < channelData.length; index++) {
        const t = index / sampleRate;
        const decay = Math.exp(-t * (3 / params.decay));
        const noise = (Math.random() * 2 - 1) * decay;
        channelData[index] = noise * (1 - t / length); // Linear decay envelope
      }
    }

    this.convolver.buffer = new Tone.ToneAudioBuffer(impulse);
  }

  private getRoomLength(roomSize: string): number {
    switch (roomSize) {
      case "small": {
        return 1.2;
      }
      case "medium": {
        return 2.5;
      }
      case "large": {
        return 4;
      }
      case "cathedral": {
        return 8;
      }
      case "hall": {
        return 6;
      }
      default: {
        return 2.5;
      }
    }
  }

  private subscribeToParams(): void {
    this.params$.subscribe(async params => {
      this.wet.fade.value = params.wet;
      this.preDelay.delayTime.value = params.preDelay;

      // longer decay = darker sound
      const filterFreq = 8000 * (2 - params.decay);
      this.filter.frequency.value = Math.max(1000, Math.min(12_000, filterFreq));

      const newUrl = params.impulseUrl || this.impulseResponses[params.roomSize];
      if (newUrl !== this.getCurrentImpulseUrl()) {
        await this.loadImpulseResponse(newUrl);
      }
    });
  }

  private getCurrentImpulseUrl(): string {
    const params = this.params$.value;
    return params.impulseUrl || this.impulseResponses[params.roomSize];
  }

  updateParams(newParams: Partial<ConvolutionReverbParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<ConvolutionReverbParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  connectInput(source: Tone.ToneAudioNode): void {
    // Dry path
    source.connect(this.wet.a);
    // Wet path
    source.connect(this.preDelay);
  }

  dispose(): void {
    this.convolver.dispose();
    this.preDelay.dispose();
    this.filter.dispose();
    this.output.dispose();
    this.wet.dispose();
  }
}
