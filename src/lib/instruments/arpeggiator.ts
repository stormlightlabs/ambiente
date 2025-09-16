import { GranularDelayEffect } from "$lib/effects/granular-delay";
import { ModulatedFiltersEffect } from "$lib/effects/modulated-filters";
import { ProbabilityOrnamentsEffect } from "$lib/effects/probability-ornaments";
import type { ArpeggiatorParams } from "$lib/types/params";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { filter, map, takeUntil } from "rxjs/operators";
import * as Tone from "tone";
import { Note, NoteUtilities } from "../theory";

export class ArpeggiatorSynth {
  private output: Tone.Gain;
  private synth: Tone.PolySynth;
  private filter: Tone.Filter;
  private delay: Tone.FeedbackDelay;
  private granularDelay: GranularDelayEffect;
  private modulatedFilter: ModulatedFiltersEffect;
  private probabilityOrnaments: ProbabilityOrnamentsEffect;
  private params$: BehaviorSubject<ArpeggiatorParams>;
  private subscriptions: Subscription[] = [];
  private destroy$ = new BehaviorSubject<void>(undefined);
  private currentScale: Note[] = [];
  private arpScheduler?: ReturnType<typeof setTimeout>;
  private currentNoteIndex: number = 0;
  private direction: number = 1;

  constructor(initialParams: Partial<ArpeggiatorParams> = {}) {
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
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    // Clean, crystalline synth for arpeggiator
    this.synth = new Tone.PolySynth(Tone.Synth, {
      envelope: { attack: 0.05, decay: 0.4, sustain: 0.3, release: 1 },
      oscillator: { type: "triangle" },
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
    this.subscriptions.push(
      this.params$.pipe(map(params => params.enabled && !params.muted), filter(Boolean), takeUntil(this.destroy$))
        .subscribe(() => {
          this.startArpeggiator();
        }),
      this.params$.pipe(map(params => !params.enabled || params.muted), filter(Boolean), takeUntil(this.destroy$))
        .subscribe(() => {
          this.stopArpeggiator();
        }),
      this.params$.subscribe(params => {
        this.output.gain.value = params.muted ? 0 : params.volume;
        this.filter.frequency.value = 800 + (params.tempo - 120) * 2; // Higher tempo = brighter filter
        this.delay.feedback.value = Math.min(0.5, 0.2 + params.swing * 0.3);
      }),
    );
  }

  private startArpeggiator(): void {
    this.stopArpeggiator();

    const scheduleNext = () => {
      const params = this.params$.value;
      if (!params.enabled || params.muted || this.currentScale.length === 0) return;

      if (Math.random() < params.probability) {
        this.triggerArpNote();
      }

      // Calculate next interval with swing
      const baseInterval = (60 / params.tempo) * 1000 * 0.25; // 16th notes
      const swingOffset = (this.currentNoteIndex % 2 === 1) ? baseInterval * params.swing : 0;
      const nextInterval = baseInterval + swingOffset + (Math.random() - 0.5) * 20;

      this.arpScheduler = setTimeout(scheduleNext, Math.max(50, nextInterval));
    };

    scheduleNext();
  }

  private stopArpeggiator(): void {
    if (this.arpScheduler) {
      clearTimeout(this.arpScheduler);
      this.arpScheduler = undefined;
    }
  }

  private triggerArpNote(): void {
    const params = this.params$.value;
    if (this.currentScale.length === 0) return;

    const note = this.getNextNote();
    if (!note) return;

    // Generate octave variations
    const baseOctave = 4;
    const octaveOffset = Math.floor(Math.random() * params.octaveRange);
    const octave = baseOctave + octaveOffset;

    const noteString = `${NoteUtilities.toString(note)}${octave}`;
    const velocity = 0.1 + Math.random() * 0.3;

    this.synth.triggerAttackRelease(noteString, params.noteDuration, Tone.now(), velocity);

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
      // Don't advance for random pattern
      return;
    }

    this.currentNoteIndex += this.direction;

    // Handle direction changes for upDown pattern
    if (params.pattern === "upDown") {
      const maxIndex = this.currentScale.length - 1;
      if (this.currentNoteIndex >= maxIndex * 2) {
        this.currentNoteIndex = 0;
      }
    } else {
      // Reset for up/down patterns
      if (this.currentNoteIndex >= this.currentScale.length) {
        this.currentNoteIndex = 0;
      }
    }
  }

  setScale(scale: Note[]): void {
    this.currentScale = [...scale];
    this.currentNoteIndex = 0; // Reset position when scale changes

    // Convert scale to string format for ornaments effect
    const scaleStrings = scale.map(note => `${NoteUtilities.toString(note)}4`);
    this.probabilityOrnaments.setScale(scaleStrings);
  }

  updateParams(newParams: Partial<ArpeggiatorParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);

    // Restart if tempo changed significantly
    if (
      newParams.tempo && Math.abs(newParams.tempo - currentParams.tempo) > 10 && updatedParams.enabled
      && !updatedParams.muted
    ) {
      this.startArpeggiator();
    }
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

    this.stopArpeggiator();

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
