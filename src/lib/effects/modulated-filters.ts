import type { ModulatedFiltersParams } from "$lib/types/audio-effects";
import { BehaviorSubject, Observable } from "rxjs";
import * as Tone from "tone";

export class ModulatedFiltersEffect {
  private filter: Tone.Filter;
  private lfo: Tone.LFO;
  private envelope?: Tone.Envelope;
  private output: Tone.Gain;
  private params$: BehaviorSubject<ModulatedFiltersParams>;

  constructor(initialParams: Partial<ModulatedFiltersParams> = {}) {
    const defaultParams: ModulatedFiltersParams = {
      enabled: true,
      filterType: "lowpass",
      frequency: 1000,
      resonance: 1,
      lfoRate: 0.5,
      lfoDepth: 200,
      lfoWave: "sine",
      envelope: false,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);

    this.filter = new Tone.Filter({
      frequency: defaultParams.frequency,
      type: defaultParams.filterType,
      Q: defaultParams.resonance,
    });

    this.lfo = new Tone.LFO({ frequency: defaultParams.lfoRate, type: defaultParams.lfoWave });

    this.lfo.min = -defaultParams.lfoDepth / 2;
    this.lfo.max = defaultParams.lfoDepth / 2;

    this.output = new Tone.Gain(1);

    this.setupSignalChain();
    this.subscribeToParams();
  }

  private setupSignalChain(): void {
    this.filter.connect(this.output);
    this.lfo.connect(this.filter.frequency);
    this.lfo.start();
  }

  private subscribeToParams(): void {
    this.params$.subscribe(params => {
      this.filter.type = params.filterType;
      this.filter.frequency.value = params.frequency;
      this.filter.Q.value = params.resonance;

      this.lfo.frequency.value = params.lfoRate;
      this.lfo.type = params.lfoWave;
      this.lfo.min = -params.lfoDepth / 2;
      this.lfo.max = params.lfoDepth / 2;

      if (params.envelope && !this.envelope) {
        this.createEnvelope();
      } else if (!params.envelope && this.envelope) {
        this.removeEnvelope();
      }
    });
  }

  private createEnvelope(): void {
    this.envelope = new Tone.Envelope({ attack: 0.1, decay: 0.2, sustain: 0.8, release: 1 });

    this.envelope.connect(this.filter.frequency);
  }

  private removeEnvelope(): void {
    if (this.envelope) {
      this.envelope.dispose();
      this.envelope = undefined;
    }
  }

  triggerEnvelope(): void {
    if (this.envelope) {
      this.envelope.triggerAttackRelease("4n");
    }
  }

  updateParams(newParams: Partial<ModulatedFiltersParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<ModulatedFiltersParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  connectInput(source: Tone.ToneAudioNode): void {
    source.connect(this.filter);
  }

  getOutput(): Tone.ToneAudioNode {
    return this.output;
  }

  dispose(): void {
    this.lfo.stop();
    this.removeEnvelope();

    this.filter.dispose();
    this.lfo.dispose();
    this.output.dispose();
  }
}
