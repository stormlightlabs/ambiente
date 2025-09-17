import type { ProbabilityOrnamentsParams } from "$lib/types/audio-effects";
import { BehaviorSubject, Observable } from "rxjs";
import * as Tone from "tone";

export class ProbabilityOrnamentsEffect {
  private synth: Tone.PolySynth;
  private output: Tone.Gain;
  private params$: BehaviorSubject<ProbabilityOrnamentsParams>;
  private tickCounter = 0;
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

    this.synth = new Tone.PolySynth({
      voice: Tone.Synth,
      options: { envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.3 }, oscillator: { type: "sine" } },
      maxPolyphony: 4,
    });

    this.output = new Tone.Gain(0.3);

    this.setupSignalChain();
  }

  private setupSignalChain(): void {
    this.synth.connect(this.output);
  }

  tick(time: number, tickDuration: number): void {
    const params = this.params$.value;
    if (!params.enabled) return;

    this.tickCounter += tickDuration;
    const baseInterval = 2; // seconds
    const variation = baseInterval * params.timingVariation;

    if (this.tickCounter >= baseInterval - variation) {
      if (Math.random() < params.ornamentChance) {
        const ornamentType = params.ornamentTypes[Math.floor(Math.random() * params.ornamentTypes.length)];
        this.triggerOrnament(ornamentType, time);
      }
      this.tickCounter = 0;
    }
  }

  private triggerOrnament(type: string, time: number): void {
    const params = this.params$.value;
    const baseNote = this.currentScale[Math.floor(Math.random() * this.currentScale.length)];
    const baseVelocity = 0.2 + Math.random() * params.dynamicRange;

    switch (type) {
      case "trill": {
        this.playTrill(baseNote, baseVelocity, time);
        break;
      }
      case "mordent": {
        this.playMordent(baseNote, baseVelocity, time);
        break;
      }
      case "turn": {
        this.playTurn(baseNote, baseVelocity, time);
        break;
      }
      case "grace": {
        this.playGraceNote(baseNote, baseVelocity, time);
        break;
      }
      case "slide": {
        this.playSlide(baseNote, baseVelocity, time);
        break;
      }
    }
  }

  private playTrill(baseNote: string, velocity: number, time: number): void {
    const upperNote = this.getAdjacentNote(baseNote, 1);
    const trillDuration = 0.4 + Math.random() * 0.4;
    const trillRate = 8 + Math.random() * 8; // Hz

    const noteDuration = 1 / trillRate;
    for (let index = 0; index < trillDuration / noteDuration; index++) {
      const note = index % 2 === 0 ? baseNote : upperNote;
      this.synth.triggerAttackRelease(note, "32n", time + index * noteDuration, velocity);
    }
  }

  private playMordent(baseNote: string, velocity: number, time: number): void {
    const lowerNote = this.getAdjacentNote(baseNote, -1);

    this.synth.triggerAttackRelease(baseNote, "32n", time, velocity);
    this.synth.triggerAttackRelease(lowerNote, "32n", time + 0.05, velocity * 0.8);
    this.synth.triggerAttackRelease(baseNote, "16n", time + 0.1, velocity);
  }

  private playTurn(baseNote: string, velocity: number, time: number): void {
    const upperNote = this.getAdjacentNote(baseNote, 1);
    const lowerNote = this.getAdjacentNote(baseNote, -1);

    this.synth.triggerAttackRelease(upperNote, "32n", time, velocity * 0.7);
    this.synth.triggerAttackRelease(baseNote, "32n", time + 0.05, velocity);
    this.synth.triggerAttackRelease(lowerNote, "32n", time + 0.1, velocity * 0.7);
    this.synth.triggerAttackRelease(baseNote, "16n", time + 0.15, velocity);
  }

  private playGraceNote(baseNote: string, velocity: number, time: number): void {
    const graceNote = this.getAdjacentNote(baseNote, Math.random() < 0.5 ? -1 : 1);

    this.synth.triggerAttackRelease(graceNote, "32n", time, velocity * 0.6);
    this.synth.triggerAttackRelease(baseNote, "8n", time + 0.05, velocity);
  }

  private playSlide(baseNote: string, velocity: number, time: number): void {
    const targetNote = this.getAdjacentNote(baseNote, Math.random() < 0.5 ? -2 : 2);

    // Since PolySynth manages voices, we can't easily ramp a specific voice's frequency.
    // We'll approximate by triggering the start and end notes of the slide.
    this.synth.triggerAttackRelease(baseNote, "16n", time, velocity * 0.8);
    this.synth.triggerAttackRelease(targetNote, "8n", time + 0.05, velocity);
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

  /** This effect is additive (generates ornaments), so input just passes through */
  connectInput(source: Tone.ToneAudioNode): void {
    source.connect(this.output);
  }

  getOutput(): Tone.ToneAudioNode {
    return this.output;
  }

  dispose(): void {
    this.synth.dispose();
    this.output.dispose();
  }
}
