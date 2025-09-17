import { Note, NoteUtilities } from "$lib/theory";
import { BaseInstrument } from "$lib/types/base";
import type { AmbientPadParams } from "$lib/types/params";
import { BehaviorSubject, type Observable } from "rxjs";
import * as Tone from "tone";

export class AmbientPadSynth extends BaseInstrument<AmbientPadParams> {
  private synth: Tone.PolySynth;
  private filter: Tone.Filter;
  private params$: BehaviorSubject<AmbientPadParams>;
  private currentChord: Note[] = [];
  private activeNotes: Set<string> = new Set();
  private lastChordHash: string = "";
  PREFIX = "[AmbientPadSynth]";

  constructor(initialParams: Partial<AmbientPadParams> = {}) {
    super(initialParams);

    const defaultParams: AmbientPadParams = {
      volume: 0.6,
      muted: false,
      enabled: true,
      filterFreq: 400,
      resonance: 1.5,
      ...initialParams,
    };

    this.log(`Creating AmbientPadSynth with params:`, defaultParams);
    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    this.synth = new Tone.PolySynth({
      voice: Tone.Synth,
      options: { envelope: { attack: 3, decay: 1, sustain: 0.7, release: 6 }, oscillator: { type: "sine" } },
      maxPolyphony: 12,
    });

    this.filter = new Tone.Filter({ frequency: defaultParams.filterFreq, type: "lowpass", Q: defaultParams.resonance });

    this.synth.connect(this.filter);
    this.filter.connect(this.output);
    this.log(`Audio chain connected: PolySynth -> Filter -> Output`);

    this.initializeParameterBindings();
  }

  private initializeParameterBindings(): void {
    this.subscriptions.push(this.params$.subscribe(params => {
      this.output.gain.value = params.muted ? 0 : params.volume;
      this.filter.frequency.value = params.filterFreq;
      this.filter.Q.value = params.resonance;

      if (params.enabled && !params.muted) {
        // Use immediate timing for parameter changes
        this.playCurrentChord("+0");
      } else {
        this.stopAllNotes("+0");
      }
    }));
  }

  tick(_time: number, _tickDuration: number): void {
    throw new Error("not implemented");
  }

  setChord(chord: Note[], time?: string | number): void {
    const chordHash = chord.toSorted((a, b) => a - b).join(",");

    if (chordHash === this.lastChordHash) {
      this.log(`Chord unchanged, skipping trigger`);
      return;
    }

    this.log(`Setting chord:`, chord?.map(n => Note[n]).join(", ") || "none");
    this.currentChord = [...chord];
    this.lastChordHash = chordHash;

    const params = this.params$.value;
    if (params.enabled && !params.muted) {
      this.log(`Playing chord (enabled: ${params.enabled}, muted: ${params.muted})`);
      this.playCurrentChord(time);
    } else {
      this.log(`Not playing chord (enabled: ${params.enabled}, muted: ${params.muted})`);
    }
  }

  private playCurrentChord(time?: string | number): void {
    this.log(`Playing chord with ${this.currentChord.length} notes`);

    // Stop any existing notes to prevent polyphony buildup
    this.stopAllNotes(time);

    if (this.currentChord.length === 0) {
      this.log(`No chord to play`);
      return;
    }

    const octave = 3;
    const noteStrings = [];

    for (const note of this.currentChord) {
      const noteString = `${NoteUtilities.toString(note)}${octave}`;
      // Use triggerAttack for sustained notes, manage release separately
      this.synth.triggerAttack(noteString, time, 0.15);
      this.activeNotes.add(noteString);
      noteStrings.push(noteString);
    }
    this.log(`Triggered notes:`, noteStrings.join(", "));
  }

  private stopAllNotes(time?: string | number): void {
    if (this.activeNotes.size > 0) {
      this.log(`Stopping ${this.activeNotes.size} active notes`);
      for (const noteString of this.activeNotes) {
        this.synth.triggerRelease(noteString, time);
      }
      this.activeNotes.clear();
    }
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
    this.log(`Disposing AmbientPadSynth`);
    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];
    this.log(`Unsubscribed from all parameter changes`);

    // Stop all notes immediately with no timing
    this.stopAllNotesImmediately();
    this.log(`Stopped all active notes`);
    this.synth.dispose();
    this.filter.dispose();
    this.output.dispose();
    this.log(`Disposed all audio nodes`);
  }

  private stopAllNotesImmediately(): void {
    if (this.activeNotes.size > 0) {
      this.log(`Immediately stopping ${this.activeNotes.size} active notes`);
      this.synth.releaseAll();
      this.activeNotes.clear();
    }
  }
}
