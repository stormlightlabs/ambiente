import { ConvolutionReverbEffect } from "$lib/effects/convolution-reverb";
import { SpectralProcessingEffect } from "$lib/effects/spectral-processing";
import { Note, NoteUtilities } from "$lib/theory";
import type { VocalPadParams } from "$lib/types/params";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { filter, map, takeUntil } from "rxjs/operators";
import * as Tone from "tone";

export class VocalPadSynth {
  private output: Tone.Gain;
  private synth: Tone.PolySynth;
  private filter: Tone.Filter;
  private chorus: Tone.Chorus;
  private vibrato: Tone.Vibrato;
  private spectralProcessor: SpectralProcessingEffect;
  private convolutionReverb: ConvolutionReverbEffect;
  private params$: BehaviorSubject<VocalPadParams>;
  private subscriptions: Subscription[] = [];
  private destroy$ = new BehaviorSubject<void>(undefined);
  private currentChord: Note[] = [];
  private activeNotes: Set<string> = new Set();
  private vibratoScheduler?: ReturnType<typeof setTimeout>;

  constructor(initialParams: Partial<VocalPadParams> = {}) {
    const defaultParams: VocalPadParams = {
      volume: 0.4,
      muted: false,
      enabled: true,
      formantFreq: 800,
      breathiness: 0.3,
      vibrato: 0.4,
      chorusDepth: 0.3,
      attack: 3,
      release: 5,
      ...initialParams,
    };

    this.params$ = new BehaviorSubject(defaultParams);
    this.output = new Tone.Gain(defaultParams.volume);

    // Use sawtooth wave for vocal-like harmonics
    this.synth = new Tone.PolySynth(Tone.Synth, {
      envelope: { attack: defaultParams.attack, decay: 0.5, sustain: 0.9, release: defaultParams.release },
      oscillator: { type: "sawtooth" },
    });

    // Formant filter for vowel-like sounds
    this.filter = new Tone.Filter({ frequency: defaultParams.formantFreq, type: "bandpass", Q: 5 });

    // Chorus for ethereal quality
    this.chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: defaultParams.chorusDepth,
      type: "sine",
      spread: 180,
    });

    // Vibrato for human-like expression
    this.vibrato = new Tone.Vibrato({ frequency: 6, depth: defaultParams.vibrato, type: "sine" });

    // Advanced effects for enhanced vocal texture
    this.spectralProcessor = new SpectralProcessingEffect({
      enabled: true,
      spectralShift: 0.1,
      harmonicEnhancement: 0.3,
      wet: 0.2,
    });

    this.convolutionReverb = new ConvolutionReverbEffect({ enabled: true, roomSize: "medium", wet: 0.4, decay: 1.2 });

    // Connect the enhanced chain: synth -> filter -> vibrato -> chorus -> spectral -> reverb -> output
    this.synth.connect(this.filter);
    this.filter.connect(this.vibrato);
    this.vibrato.connect(this.chorus);

    // Connect effects in chain
    this.spectralProcessor.connectInput(this.chorus);
    this.convolutionReverb.connectInput(this.spectralProcessor.getOutput());
    this.convolutionReverb.connect(this.output);

    this.initializeVocalPadManagement();
  }

  private initializeVocalPadManagement(): void {
    this.subscriptions.push(
      this.params$.pipe(map(params => params.enabled && !params.muted), filter(Boolean), takeUntil(this.destroy$))
        .subscribe(() => {
          this.startVocalPad();
        }),
      this.params$.pipe(map(params => !params.enabled || params.muted), filter(Boolean), takeUntil(this.destroy$))
        .subscribe(() => {
          this.stopVocalPad();
        }),
      this.params$.subscribe(params => {
        this.output.gain.value = params.muted ? 0 : params.volume;
        this.filter.frequency.value = params.formantFreq;
        this.chorus.depth = params.chorusDepth;
        this.vibrato.depth.value = params.vibrato;

        // Update envelope for breathiness
        const breathinessAttack = params.attack * (1 + params.breathiness * 0.5);
        const breathinessRelease = params.release * (1 + params.breathiness * 0.3);
        this.synth.set({
          envelope: {
            attack: breathinessAttack,
            decay: 0.5,
            sustain: 0.9 - (params.breathiness * 0.2),
            release: breathinessRelease,
          },
        });
      }),
    );
  }

  private startVocalPad(): void {
    if (this.currentChord.length > 0) {
      this.playCurrentChord();
    }
    this.startVibratoModulation();
  }

  private stopVocalPad(): void {
    this.stopAllNotes();
    this.stopVibratoModulation();
  }

  private startVibratoModulation(): void {
    this.stopVibratoModulation();

    const modulate = () => {
      const params = this.params$.value;
      if (!params.enabled || params.muted) return;

      // Subtle vibrato frequency variation for more organic feel
      const baseFreq = 6;
      const variation = baseFreq * (0.8 + Math.random() * 0.4);
      this.vibrato.frequency.rampTo(variation, 2);

      this.vibratoScheduler = setTimeout(modulate, 3000 + Math.random() * 4000);
    };

    modulate();
  }

  private stopVibratoModulation(): void {
    if (this.vibratoScheduler) {
      clearTimeout(this.vibratoScheduler);
      this.vibratoScheduler = undefined;
    }
  }

  setChord(chord: Note[]): void {
    this.currentChord = [...chord];
    const params = this.params$.value;
    if (params.enabled && !params.muted) {
      this.playCurrentChord();
    }
  }

  private playCurrentChord(): void {
    this.stopAllNotes();

    if (this.currentChord.length === 0) return;

    // Play chord across multiple octaves for rich harmonics
    const octaves = [3, 4];
    for (const octave of octaves) {
      for (const note of this.currentChord) {
        const noteString = `${NoteUtilities.toString(note)}${octave}`;
        const velocity = octave === 3 ? 0.2 : 0.3; // Lower octave quieter
        this.synth.triggerAttack(noteString, Tone.now(), velocity);
        this.activeNotes.add(noteString);
      }
    }
  }

  private stopAllNotes(): void {
    for (const noteString of this.activeNotes) {
      this.synth.triggerRelease(noteString);
    }
    this.activeNotes.clear();
  }

  updateParams(newParams: Partial<VocalPadParams>): void {
    const currentParams = this.params$.value;
    const updatedParams = { ...currentParams, ...newParams };
    this.params$.next(updatedParams);
  }

  getParams(): Observable<VocalPadParams> {
    return this.params$.asObservable();
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.output.connect(destination);
  }

  dispose(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.stopVocalPad();

    for (const sub of this.subscriptions) sub.unsubscribe();
    this.subscriptions = [];

    this.synth.dispose();
    this.filter.dispose();
    this.chorus.dispose();
    this.vibrato.dispose();
    this.spectralProcessor.dispose();
    this.convolutionReverb.dispose();
    this.output.dispose();
  }
}
