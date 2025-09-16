import type { ProbabilityOrnamentsParams } from "$lib/types/audio-effects";
import { BehaviorSubject, Observable } from "rxjs";
import * as Tone from "tone";

export class ProbabilityOrnamentsEffect {
  private synth: Tone.PolySynth;
  private output: Tone.Gain;
  private params$: BehaviorSubject<ProbabilityOrnamentsParams>;
  private ornamentSchedulers: ReturnType<typeof setTimeout>[] = [];
  private currentScale: string[] = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"];

  constructor(initialParams: Partial<ProbabilityOrnamentsParams> = {}) {
    const defaultParams: ProbabilityOrnamentsParams = {
      enabled: true,
      ornamentChance: 0.3,
      ornamentTypes: ["trill", "grace", "slide"],
      dynamicRange: 0.4,
      timingVariation: 0.2,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);

    this.synth = new Tone.PolySynth(Tone.Synth, {
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.3 },
      oscillator: { type: "sine" },
    });

    this.output = new Tone.Gain(0.3);

    this.setupSignalChain();
    this.subscribeToParams();
  }

  private setupSignalChain(): void {
    this.synth.connect(this.output);
  }

  private subscribeToParams(): void {
    this.params$.subscribe(params => {
      if (params.enabled) {
        this.startOrnamentation();
      } else {
        this.stopOrnamentation();
      }
    });
  }

  private startOrnamentation(): void {
    this.stopOrnamentation();

    const scheduleOrnaments = () => {
      const params = this.params$.value;
      if (!params.enabled) return;

      if (Math.random() < params.ornamentChance) {
        const ornamentType = params.ornamentTypes[Math.floor(Math.random() * params.ornamentTypes.length)];
        this.triggerOrnament(ornamentType);
      }

      const baseInterval = 2000;
      const variation = baseInterval * params.timingVariation;
      const nextInterval = baseInterval + (Math.random() - 0.5) * variation;

      const scheduler = setTimeout(scheduleOrnaments, nextInterval);
      this.ornamentSchedulers.push(scheduler);
    };

    scheduleOrnaments();
  }

  private stopOrnamentation(): void {
    for (const scheduler of this.ornamentSchedulers) {
      clearTimeout(scheduler);
    }
    this.ornamentSchedulers = [];
  }

  private triggerOrnament(type: string): void {
    const params = this.params$.value;
    const baseNote = this.currentScale[Math.floor(Math.random() * this.currentScale.length)];
    const baseVelocity = 0.2 + Math.random() * params.dynamicRange;

    switch (type) {
      case "trill": {
        this.playTrill(baseNote, baseVelocity);
        break;
      }
      case "mordent": {
        this.playMordent(baseNote, baseVelocity);
        break;
      }
      case "turn": {
        this.playTurn(baseNote, baseVelocity);
        break;
      }
      case "grace": {
        this.playGraceNote(baseNote, baseVelocity);
        break;
      }
      case "slide": {
        this.playSlide(baseNote, baseVelocity);
        break;
      }
    }
  }

  private playTrill(baseNote: string, velocity: number): void {
    const upperNote = this.getAdjacentNote(baseNote, 1);
    const trillDuration = 0.4 + Math.random() * 0.4;
    const trillRate = 8 + Math.random() * 8; // Hz

    let isUpper = false;
    const trillInterval = setInterval(() => {
      const note = isUpper ? upperNote : baseNote;
      this.synth.triggerAttackRelease(note, "32n", Tone.now(), velocity);
      isUpper = !isUpper;
    }, 1000 / trillRate);

    setTimeout(() => clearInterval(trillInterval), trillDuration * 1000);
  }

  private playMordent(baseNote: string, velocity: number): void {
    const lowerNote = this.getAdjacentNote(baseNote, -1);

    this.synth.triggerAttackRelease(baseNote, "32n", Tone.now(), velocity);
    this.synth.triggerAttackRelease(lowerNote, "32n", Tone.now() + 0.05, velocity * 0.8);
    this.synth.triggerAttackRelease(baseNote, "16n", Tone.now() + 0.1, velocity);
  }

  private playTurn(baseNote: string, velocity: number): void {
    const upperNote = this.getAdjacentNote(baseNote, 1);
    const lowerNote = this.getAdjacentNote(baseNote, -1);

    this.synth.triggerAttackRelease(upperNote, "32n", Tone.now(), velocity * 0.7);
    this.synth.triggerAttackRelease(baseNote, "32n", Tone.now() + 0.05, velocity);
    this.synth.triggerAttackRelease(lowerNote, "32n", Tone.now() + 0.1, velocity * 0.7);
    this.synth.triggerAttackRelease(baseNote, "16n", Tone.now() + 0.15, velocity);
  }

  private playGraceNote(baseNote: string, velocity: number): void {
    const graceNote = this.getAdjacentNote(baseNote, Math.random() < 0.5 ? -1 : 1);

    this.synth.triggerAttackRelease(graceNote, "32n", Tone.now(), velocity * 0.6);
    this.synth.triggerAttackRelease(baseNote, "8n", Tone.now() + 0.05, velocity);
  }

  private playSlide(baseNote: string, velocity: number): void {
    const targetNote = this.getAdjacentNote(baseNote, Math.random() < 0.5 ? -2 : 2);

    // Simple slide approximation using frequency ramping
    this.synth.triggerAttack(baseNote, Tone.now(), velocity);

    // Ramp frequency over time (simplified slide)
    setTimeout(() => {
      this.synth.triggerRelease(baseNote, Tone.now());
      this.synth.triggerAttackRelease(targetNote, "4n", Tone.now(), velocity);
    }, 200);
  }

  private getAdjacentNote(note: string, semitones: number): string {
    const noteIndex = this.currentScale.indexOf(note);
    if (noteIndex === -1) return note;

    const newIndex = Math.max(0, Math.min(this.currentScale.length - 1, noteIndex + semitones));
    return this.currentScale[newIndex];
  }

  setScale(scale: string[]): void {
    this.currentScale = [...scale];
  }

  updateParams(newParams: Partial<ProbabilityOrnamentsParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<ProbabilityOrnamentsParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  connectInput(source: Tone.ToneAudioNode): void {
    // This effect is additive (generates ornaments), so input just passes through
    source.connect(this.output);
  }

  getOutput(): Tone.ToneAudioNode {
    return this.output;
  }

  dispose(): void {
    this.stopOrnamentation();
    this.synth.dispose();
    this.output.dispose();
  }
}
