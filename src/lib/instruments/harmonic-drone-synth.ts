import type { HarmonicDroneParams } from "$lib/types/params";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { map, takeUntil } from "rxjs/operators";
import * as Tone from "tone";
import { Note, NoteUtilities } from "../theory";

export class HarmonicDroneSynth {
  private synths: Tone.PolySynth[];
  private output: Tone.Gain;
  private params$: BehaviorSubject<HarmonicDroneParams>;
  private subscriptions: Subscription[] = [];
  private destroy$ = new BehaviorSubject<void>(undefined);
  private currentChord: Note[] = [];
  private activeNotes: Set<string> = new Set();

  constructor(initialParams: Partial<HarmonicDroneParams> = {}) {
    const defaultParams: HarmonicDroneParams = {
      volume: 0.45,
      muted: false,
      enabled: true,
      changeInterval: 8,
      voiceLeading: 0.7,
      voiceCount: 4,
      spread: 1.5,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    this.synths = Array.from({ length: defaultParams.voiceCount }, (_, index) => {
      const synth = new Tone.PolySynth(Tone.Synth, {
        envelope: { attack: 8, decay: 0, sustain: 1, release: 10 },
        oscillator: { type: "sine" },
      });

      const detune = (index - defaultParams.voiceCount / 2) * defaultParams.spread;
      synth.set({ detune });

      synth.connect(this.output);
      return synth;
    });

    this.initializeDroneManagement();
  }

  private initializeDroneManagement(): void {
    this.subscriptions.push(
      this.params$.pipe(map(params => params.volume), takeUntil(this.destroy$)).subscribe(volume => {
        this.output.gain.value = volume;
      }),
      this.params$.subscribe(params => {
        if (params.enabled && !params.muted) {
          if (this.currentChord.length > 0) {
            this.updateDroneChord();
          }
        } else {
          this.stopAllNotes();
        }
      }),
    );
  }

  setChord(chord: Note[], time?: number): void {
    this.currentChord = [...chord];
    const params = this.params$.value;
    if (params.enabled && !params.muted) {
      this.updateDroneChord(time);
    }
  }

  private updateDroneChord(time?: number): void {
    const params = this.params$.value;
    if (this.currentChord.length === 0) return;

    for (const noteString of this.activeNotes) {
      if (Math.random() > params.voiceLeading) {
        const synthIndex = Math.floor(Math.random() * this.synths.length);
        this.synths[synthIndex].triggerRelease(noteString, time);
      }
    }

    this.activeNotes.clear();

    const baseOctave = 2;
    for (let octave = baseOctave; octave <= baseOctave + 1; octave++) {
      for (const note of this.currentChord) {
        const noteString = `${NoteUtilities.toString(note)}${octave}`;
        const synthIndex = Math.floor(Math.random() * this.synths.length);

        this.synths[synthIndex].triggerAttack(noteString, time, 0.15);
        this.activeNotes.add(noteString);
      }
    }
  }

  private stopAllNotes(time?: number): void {
    for (const noteString of this.activeNotes) {
      for (const synth of this.synths) {
        synth.triggerRelease(noteString, time);
      }
    }
    this.activeNotes.clear();
  }

  updateParams(newParams: Partial<HarmonicDroneParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);

    if (newParams.voiceCount && newParams.voiceCount !== currentParams.voiceCount) {
      this.rebuildSynths(updatedParams);
    }
  }

  private rebuildSynths(params: HarmonicDroneParams): void {
    for (const synth of this.synths) {
      synth.dispose();
    }

    this.synths = Array.from({ length: params.voiceCount }, (_, index) => {
      const synth = new Tone.PolySynth(Tone.Synth, {
        envelope: { attack: 8, decay: 0, sustain: 1, release: 10 },
        oscillator: { type: "sine" },
      });

      const detune = (index - params.voiceCount / 2) * params.spread;
      synth.set({ detune });

      synth.connect(this.output);
      return synth;
    });
  }

  getParams(): Observable<HarmonicDroneParams> {
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

    for (const synth of this.synths) {
      synth.dispose();
    }
    this.output.dispose();
  }
}
