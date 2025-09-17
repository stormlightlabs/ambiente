import { GranularDelayEffect } from "$lib/effects/granular-delay";
import { ModulatedFiltersEffect } from "$lib/effects/modulated-filters";
import { ProbabilityOrnamentsEffect } from "$lib/effects/probability-ornaments";
import { Note, NoteUtilities } from "$lib/theory";
import { BaseInstrument } from "$lib/types/base";
import type { ArpeggiatorParams } from "$lib/types/params";
import { BehaviorSubject, Observable } from "rxjs";
import * as Tone from "tone";

export class ArpeggiatorSynth extends BaseInstrument<ArpeggiatorParams> {
  private synth: Tone.PolySynth;
  private filter: Tone.Filter;
  private delay: Tone.FeedbackDelay;
  private granularDelay: GranularDelayEffect;
  private modulatedFilter: ModulatedFiltersEffect;
  private probabilityOrnaments: ProbabilityOrnamentsEffect;
  private params$: BehaviorSubject<ArpeggiatorParams>;
  private destroy$ = new BehaviorSubject<void>(undefined);
  private currentNoteIndex: number = 0;
  private direction: number = 1;

  constructor(initial: Partial<ArpeggiatorParams> = {}) {
    super(initial);

    const defaultParams: ArpeggiatorParams = {
      volume: 0.35,
      muted: false,
      enabled: true,
      tempo: 120,
      pattern: "up",
      octaveRange: 2,
      noteDuration: 0.3,
      probability: 0.8,
      swing: 0.1,
      ...initial,
    };

    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    // Clean, crystalline synth for arpeggiator
    this.synth = new Tone.PolySynth({
      voice: Tone.Synth,
      options: { envelope: { attack: 0.05, decay: 0.4, sustain: 0.3, release: 1 }, oscillator: { type: "triangle" } },
      maxPolyphony: 8, // Increased polyphony limit for arpeggiator patterns
    });

    // High-pass filter for sparkle
    this.filter = new Tone.Filter({ frequency: 800, type: "highpass", Q: 2 });

    // Subtle delay for flowing effect
    this.delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.3, wet: 0.2 });

    // Advanced effects for complex arpeggio textures
    this.granularDelay = new GranularDelayEffect({
      enabled: true,
      delayTime: 0.15,
      feedback: 0.4,
      grainSize: 0.08,
      grainDensity: 0.7,
      wet: 0.3,
    });

    this.modulatedFilter = new ModulatedFiltersEffect({
      enabled: true,
      filterType: "bandpass",
      frequency: 1200,
      resonance: 2,
      lfoRate: 0.3,
      lfoDepth: 300,
    });

    this.probabilityOrnaments = new ProbabilityOrnamentsEffect({
      enabled: true,
      ornamentChance: 0.15,
      ornamentTypes: ["grace", "slide"],
      dynamicRange: 0.3,
    });

    // Enhanced chain: synth -> filter -> delay -> granular -> modulated filter -> ornaments -> output
    this.synth.connect(this.filter);
    this.filter.connect(this.delay);
    this.granularDelay.connectInput(this.delay);
    this.modulatedFilter.connectInput(this.granularDelay.getOutput());
    this.probabilityOrnaments.connectInput(this.modulatedFilter.getOutput());
    this.probabilityOrnaments.connect(this.output);

    this.initializeArpeggiator();
  }

  private initializeArpeggiator(): void {
    this.subscriptions.push(this.params$.subscribe(params => {
      this.output.gain.value = params.muted ? 0 : params.volume;
      this.filter.frequency.value = 800 + (params.tempo - 120) * 2; // Higher tempo = brighter filter
      this.delay.feedback.value = Math.min(0.5, 0.2 + params.swing * 0.3);
    }));
  }

  tick(time: number, tickDuration: number): void {
    const params = this.params$.value;
    if (!params.enabled || params.muted || this.currentScale.length === 0) {
      return;
    }

    this.granularDelay.tick(time, tickDuration);
    this.probabilityOrnaments.tick(time, tickDuration);

    if (Math.random() < params.probability) {
      this.triggerArpNote(time);
    }
  }

  private triggerArpNote(time: number): void {
    const params = this.params$.value;
    if (this.currentScale.length === 0) return;

    const note = this.getNextNote();
    if (!note) return;

    const baseOctave = 4;
    const octaveOffset = Math.floor(Math.random() * params.octaveRange);
    const octave = baseOctave + octaveOffset;

    const noteString = `${NoteUtilities.toString(note)}${octave}`;
    const velocity = 0.1 + Math.random() * 0.3;

    this.synth.triggerAttackRelease(noteString, params.noteDuration, time, velocity);

    this.advanceNoteIndex();
  }

  private getNextNote(): Note | undefined {
    const params = this.params$.value;
    if (this.currentScale.length === 0) return undefined;

    switch (params.pattern) {
      case "up": {
        return this.currentScale[this.currentNoteIndex % this.currentScale.length];
      }
      case "down": {
        const index = this.currentScale.length - 1 - (this.currentNoteIndex % this.currentScale.length);
        return this.currentScale[index];
      }
      case "upDown": {
        const maxIndex = this.currentScale.length - 1;
        let index = this.currentNoteIndex % (maxIndex * 2);
        if (index > maxIndex) {
          index = maxIndex * 2 - index;
        }
        return this.currentScale[index];
      }
      case "random": {
        return this.currentScale[Math.floor(Math.random() * this.currentScale.length)];
      }
      default: {
        return this.currentScale[0];
      }
    }
  }

  private advanceNoteIndex(): void {
    const params = this.params$.value;

    if (params.pattern === "random") {
      return;
    }

    this.currentNoteIndex += this.direction;

    if (params.pattern === "upDown") {
      const maxIndex = this.currentScale.length - 1;
      if (this.currentNoteIndex >= maxIndex * 2) {
        this.currentNoteIndex = 0;
      }
    } else {
      if (this.currentNoteIndex >= this.currentScale.length) {
        this.currentNoteIndex = 0;
      }
    }
  }

  setScale(scale: Note[]): void {
    this.currentScale = [...scale];
    this.currentNoteIndex = 0;

    const scaleStrings = scale.map(note => `${NoteUtilities.toString(note)}4`);
    this.probabilityOrnaments.setScale(scaleStrings);
  }

  updateParams(newParams: Partial<ArpeggiatorParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<ArpeggiatorParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  dispose(): void {
    this.destroy$.next();
    this.destroy$.complete();

    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];

    this.synth.dispose();
    this.filter.dispose();
    this.delay.dispose();
    this.granularDelay.dispose();
    this.modulatedFilter.dispose();
    this.probabilityOrnaments.dispose();
    this.output.dispose();
  }
}
