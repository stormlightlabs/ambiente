import { Note, NoteUtilities } from "$lib/theory";
import type { AmbientPadParams } from "$lib/types/params";
import { BehaviorSubject, type Observable, type Subscription } from "rxjs";
import * as Tone from "tone";

export class AmbientPadSynth {
  private synth: Tone.PolySynth;
  private filter: Tone.Filter;
  private output: Tone.Gain;
  private params$: BehaviorSubject<AmbientPadParams>;
  private subscriptions: Subscription[] = [];
  private currentChord: Note[] = [];
  private activeNotes: Set<string> = new Set();

  constructor(initialParams: Partial<AmbientPadParams> = {}) {
    const defaultParams: AmbientPadParams = {
      volume: 0.6,
      muted: false,
      enabled: true,
      filterFreq: 400,
      resonance: 1.5,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    this.synth = new Tone.PolySynth(Tone.Synth, {
      envelope: { attack: 2, decay: 0.5, sustain: 0.8, release: 4 },
      oscillator: { type: "sawtooth" },
    });

    this.filter = new Tone.Filter({ frequency: defaultParams.filterFreq, type: "lowpass", Q: defaultParams.resonance });

    this.synth.connect(this.filter);
    this.filter.connect(this.output);

    this.initializeParameterBindings();
  }

  private initializeParameterBindings(): void {
    this.subscriptions.push(this.params$.subscribe(params => {
      this.output.gain.value = params.muted ? 0 : params.volume;
      this.filter.frequency.value = params.filterFreq;
      this.filter.Q.value = params.resonance;

      if (params.enabled && !params.muted) {
        this.playCurrentChord();
      } else {
        this.stopAllNotes();
      }
    }));
  }

  setChord(chord: Note[], time?: number): void {
    this.currentChord = [...chord];
    const params = this.params$.value;
    if (params.enabled && !params.muted) {
      this.playCurrentChord(time);
    }
  }

  private playCurrentChord(time?: number): void {
    this.stopAllNotes(time);

    if (this.currentChord.length === 0) {
      return;
    }

    const octave = 3;
    for (const note of this.currentChord) {
      const noteString = `${NoteUtilities.toString(note)}${octave}`;
      this.synth.triggerAttack(noteString, time, 0.3);
      this.activeNotes.add(noteString);
    }
  }

  private stopAllNotes(time?: number): void {
    for (const noteString of this.activeNotes) {
      this.synth.triggerRelease(noteString, time);
    }
    this.activeNotes.clear();
  }

  updateParams(newParams: Partial<AmbientPadParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<AmbientPadParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  dispose(): void {
    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];

    this.stopAllNotes();
    this.synth.dispose();
    this.filter.dispose();
    this.output.dispose();
  }
}
