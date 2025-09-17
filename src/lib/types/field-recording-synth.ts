import { StereoImagingEffect } from "$lib/effects/stereo-imaging";
import { TapeSaturationEffect } from "$lib/effects/tape-saturation";
import type { FieldRecordingParams } from "$lib/types/params";
import { BehaviorSubject, Observable } from "rxjs";
import { filter, map, takeUntil } from "rxjs/operators";
import * as Tone from "tone";
import { BaseInstrument } from "./base";

export class FieldRecordingSynth extends BaseInstrument<FieldRecordingParams> {
  private noiseSource: Tone.Noise;
  private filter: Tone.Filter;
  private reverb: Tone.Reverb;
  private tapeSaturation: TapeSaturationEffect;
  private stereoImaging: StereoImagingEffect;
  private params$: BehaviorSubject<FieldRecordingParams>;
  private destroy$ = new BehaviorSubject<void>(undefined);
  private textureSchedulerId?: number;

  constructor(initial: Partial<FieldRecordingParams> = {}) {
    super(initial);
    const defaultParams: FieldRecordingParams = {
      volume: 0.3,
      muted: false,
      enabled: true,
      textureType: "rain",
      density: 0.6,
      filterFreq: 800,
      reverb: 0.4,
      fadeTime: 3,
      ...initial,
    };

    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    this.noiseSource = new Tone.Noise({ type: "pink" });
    this.filter = new Tone.Filter({ frequency: defaultParams.filterFreq, type: "lowpass", Q: 1 });
    this.reverb = new Tone.Reverb({ decay: 4, wet: defaultParams.reverb });

    this.tapeSaturation = new TapeSaturationEffect({
      enabled: true,
      drive: 0.2,
      warmth: 0.6,
      hiss: 0.15,
      flutter: 0.3,
      wet: 0.7,
    });

    this.stereoImaging = new StereoImagingEffect({
      enabled: true,
      width: 0.8,
      bassMonoFreq: 100,
      stereoEnhancement: 0.4,
    });

    // Enhanced chain: noise -> filter -> reverb -> tape -> stereo -> output
    this.noiseSource.connect(this.filter);
    this.filter.connect(this.reverb);
    this.tapeSaturation.connectInput(this.reverb);
    this.stereoImaging.connectInput(this.tapeSaturation.getOutput());
    this.stereoImaging.connect(this.output);

    this.initializeTextureGeneration();
  }

  private initializeTextureGeneration(): void {
    this.subscriptions.push(
      this.params$.pipe(map(params => params.enabled && !params.muted), filter(Boolean), takeUntil(this.destroy$))
        .subscribe(() => {
          this.startTextureGeneration();
        }),
      this.params$.pipe(map(params => !params.enabled || params.muted), filter(Boolean), takeUntil(this.destroy$))
        .subscribe(() => {
          this.stopTextureGeneration();
        }),
      this.params$.subscribe(params => {
        this.output.gain.value = params.muted ? 0 : params.volume;
        this.filter.frequency.value = params.filterFreq;
        this.reverb.wet.value = params.reverb;
        this.configureTextureType(params.textureType);
      }),
    );
  }

  private configureTextureType(type: FieldRecordingParams["textureType"]): void {
    switch (type) {
      case "rain": {
        this.noiseSource.type = "pink";
        this.filter.frequency.value = 1200;
        this.filter.Q.value = 0.5;
        break;
      }
      case "forest": {
        this.noiseSource.type = "brown";
        this.filter.frequency.value = 600;
        this.filter.Q.value = 2;
        break;
      }
      case "urban": {
        this.noiseSource.type = "white";
        this.filter.frequency.value = 400;
        this.filter.Q.value = 0.3;
        break;
      }
      case "wind": {
        this.noiseSource.type = "pink";
        this.filter.frequency.value = 800;
        this.filter.Q.value = 0.8;
        break;
      }
      case "ocean": {
        this.noiseSource.type = "brown";
        this.filter.frequency.value = 300;
        this.filter.Q.value = 0.7;
        break;
      }
    }
  }

  private startTextureGeneration(): void {
    this.stopTextureGeneration();

    const params = this.params$.value;
    if (!params.enabled || params.muted) return;

    this.noiseSource.start();

    const scheduleTexture = (_time: number) => {
      if (!this.params$.value.enabled || this.params$.value.muted) return;

      const currentParams = this.params$.value;
      const intervalSeconds = (1 / currentParams.density) * (0.8 + Math.random() * 0.4);

      const freqVariation = currentParams.filterFreq * (0.9 + Math.random() * 0.2);
      this.filter.frequency.rampTo(freqVariation, currentParams.fadeTime);

      this.textureSchedulerId = Tone.getTransport().schedule(scheduleTexture, `+${intervalSeconds}`);
    };

    this.textureSchedulerId = Tone.getTransport().schedule(scheduleTexture, "+0.1");
  }

  private stopTextureGeneration(): void {
    if (this.textureSchedulerId !== undefined) {
      Tone.getTransport().clear(this.textureSchedulerId);
      this.textureSchedulerId = undefined;
    }

    this.noiseSource.stop();
  }

  updateParams(newParams: Partial<FieldRecordingParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<FieldRecordingParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  dispose(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.stopTextureGeneration();

    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];

    this.noiseSource.dispose();
    this.filter.dispose();
    this.reverb.dispose();
    this.tapeSaturation.dispose();
    this.stereoImaging.dispose();
    this.output.dispose();
  }

  tick(_time: number, _tickDuration: number): void {
    throw new Error("not implemented");
  }
}
