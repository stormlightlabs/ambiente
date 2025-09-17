import { noteToToneString } from "$lib/audio";
import { AmbientMixer } from "$lib/audio/mixer";
import { harmonizeNote, type SynthKind } from "$lib/engines/utilities";
import { AmbientPadSynth } from "$lib/instruments/ambient-pad";
import { ArpeggiatorSynth } from "$lib/instruments/arpeggiator";
import { GranularSynth } from "$lib/instruments/granular-synth";
import { HarmonicDroneSynth } from "$lib/instruments/harmonic-drone-synth";
import { MelodicSynth } from "$lib/instruments/melodic-synth";
import { VocalPadSynth } from "$lib/instruments/vocal-pads";
import { PatternRandomizer } from "$lib/seed/pattern-randomizer";
import { generateProgression, generateScale, Note, PROGRESSIONS } from "$lib/theory";
import type { AudioEngineState, AudioEvent, InstrumentPattern } from "$lib/types/audio";
import { InstrumentType } from "$lib/types/instruments";
import { RhythmicPulseSynth } from "$lib/types/rhythmic-pulse-synth";
import { BehaviorSubject, combineLatest, Observable, Subject } from "rxjs";
import { debounceTime, distinctUntilChanged, map, take, takeUntil } from "rxjs/operators";
import * as Tone from "tone";

export class AudioStreams {
  private readonly destroy$: Subject<void>;
  private readonly state$: BehaviorSubject<AudioEngineState>;
  private readonly events$: Subject<AudioEvent>;
  private readonly patterns$: BehaviorSubject<Map<InstrumentType, InstrumentPattern>>;
  private readonly randomizedPatterns$: Observable<Map<InstrumentType, InstrumentPattern>>;
  private readonly currentScale$: BehaviorSubject<Note[]>;
  private readonly chordProgression$: Observable<Note[][]>;
  private readonly currentChord$: BehaviorSubject<Note[]>;
  private readonly synthInstances: Map<InstrumentType, Tone.PolySynth>;
  private readonly ambientInstruments: Map<InstrumentType, SynthKind>;
  private readonly ambientMixer: AmbientMixer;

  constructor(
    state$: BehaviorSubject<AudioEngineState>,
    events$: Subject<AudioEvent>,
    destroy$: Subject<void>,
    patterns$: BehaviorSubject<Map<InstrumentType, InstrumentPattern>>,
    currentScale$: BehaviorSubject<Note[]>,
    currentChord$: BehaviorSubject<Note[]>,
    synthInstances: Map<InstrumentType, Tone.PolySynth>,
    ambientInstruments: Map<InstrumentType, SynthKind>,
    ambientMixer: AmbientMixer,
  ) {
    this.state$ = state$;
    this.events$ = events$;
    this.destroy$ = destroy$;
    this.patterns$ = patterns$;
    this.currentScale$ = currentScale$;
    this.currentChord$ = currentChord$;
    this.synthInstances = synthInstances;
    this.ambientInstruments = ambientInstruments;
    this.ambientMixer = ambientMixer;

    this.chordProgression$ = this.state$.pipe(
      map(state => ({ key: state.key, mode: state.mode, randomization: state.randomization })),
      distinctUntilChanged((a, b) =>
        a.key === b.key && a.mode === b.mode && a.randomization.chordProgression === b.randomization.chordProgression
      ),
      map(({ key, mode, randomization }) => {
        const scale = generateScale(key, mode);
        this.currentScale$.next(scale);
        const baseProgression = generateProgression(scale, [...PROGRESSIONS.emotional]);

        if (randomization.enabled && randomization.chordProgression > 0) {
          return PatternRandomizer.randomizeProgression(
            baseProgression,
            scale,
            randomization.chordProgression,
            randomization.constraintStrength,
            randomization.seed,
          );
        }
        return baseProgression;
      }),
      takeUntil(this.destroy$),
    );

    this.randomizedPatterns$ = combineLatest([
      this.patterns$,
      this.currentScale$,
      this.state$.pipe(map(state => state.randomization)),
    ]).pipe(
      map(([patterns, scale, randomization]) => {
        if (!randomization.enabled) return patterns;

        const randomizedMap = new Map<InstrumentType, InstrumentPattern>();
        for (const [type, pattern] of patterns.entries()) {
          let randomizedPattern = pattern;

          if (randomization.rhythmVariability > 0) {
            randomizedPattern = PatternRandomizer.randomizeRhythm(
              randomizedPattern,
              randomization.rhythmVariability,
              randomization.seed,
            );
          }

          if (randomization.melodicVariability > 0) {
            randomizedPattern = PatternRandomizer.randomizeMelody(
              randomizedPattern,
              scale,
              randomization.melodicVariability,
              randomization.seed,
            );
          }

          if (randomization.patternEvolution > 0) {
            randomizedPattern = PatternRandomizer.evolvePattern(
              randomizedPattern,
              randomization.patternEvolution,
              randomization.seed,
            );
          }

          randomizedMap.set(type, randomizedPattern);
        }
        return randomizedMap;
      }),
      takeUntil(this.destroy$),
    );
  }

  initializeStreams(): void {
    this.setupPlaybackStreams();
    this.setupTempoStreams();
    this.setupVolumeStreams();
    this.setupInstrumentStreams();
    this.setupScaleStreams();
    this.setupMainTransportLoop();
  }

  private setupPlaybackStreams(): void {
    this.state$.pipe(map(state => state.isPlaying), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(
      isPlaying => {
        if (isPlaying) {
          Tone.getTransport().start();
        } else {
          Tone.getTransport().pause();
        }
      },
    );
  }

  private setupTempoStreams(): void {
    this.state$.pipe(map(s => s.tempo), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(tempo => {
      Tone.getTransport().bpm.value = tempo;
    });
  }

  private setupVolumeStreams(): void {
    this.state$.pipe(map(state => state.volume), distinctUntilChanged(), debounceTime(50), takeUntil(this.destroy$))
      .subscribe(volume => this.ambientMixer.setMasterVolume(volume));
  }

  private setupInstrumentStreams(): void {
    this.state$.pipe(
      map(state => state.instruments),
      distinctUntilChanged((a, b) => {
        return a.size === b.size && [...a].every(x => b.has(x));
      }),
      takeUntil(this.destroy$),
    ).subscribe(instruments => {
      this.events$.next({ type: "instruments-changed", timestamp: Tone.now(), data: { instruments } } as any);
    });
  }

  private setupScaleStreams(): void {
    this.currentScale$.pipe(takeUntil(this.destroy$)).subscribe(scale => {
      for (const [, instrument] of this.ambientInstruments.entries()) {
        if (instrument instanceof GranularSynth) {
          instrument.setScale(scale);
        }
        if (instrument instanceof MelodicSynth) {
          instrument.setScale(scale);
        }
        if (instrument instanceof RhythmicPulseSynth) {
          instrument.setScale(scale);
        }
        if (instrument instanceof ArpeggiatorSynth) {
          instrument.setScale(scale);
        }
      }
    });
  }

  private setupMainTransportLoop(): void {
    Tone.getTransport().scheduleRepeat(time => {
      if (!this.state$.value.isPlaying) return;

      const totalTicks = Tone.getTransport().ticks;
      const sixteenthNotes = Math.round(totalTicks / (Tone.getTransport().PPQ / 4));

      combineLatest([this.chordProgression$, this.randomizedPatterns$]).pipe(take(1)).subscribe(
        ([progression, patterns]) => {
          if (progression.length === 0) {
            return;
          }

          const chordIndex = Math.floor(sixteenthNotes / 8) % progression.length;
          let chord = this.currentChord$.value;

          if (this.state$.value.currentChord !== chordIndex) {
            chord = progression[chordIndex];
            this.currentChord$.next(chord);
            this.updateState(state => ({ ...state, currentChord: chordIndex }));
            this.events$.next({ type: "chord-change", timestamp: time, data: { chord, index: chordIndex } });

            for (const [, instrument] of this.ambientInstruments.entries()) {
              if (
                instrument instanceof AmbientPadSynth
                || instrument instanceof HarmonicDroneSynth
                || instrument instanceof VocalPadSynth
              ) {
                instrument.setChord(chord, time);
              }
            }
          }

          const tickDuration = 60 / this.state$.value.tempo / 4;
          this.playPatternStep(sixteenthNotes, patterns, chord, time);

          for (const [instrumentType, instrument] of this.ambientInstruments.entries()) {
            if (
              instrument instanceof ArpeggiatorSynth
              || instrument instanceof MelodicSynth
              || instrument instanceof GranularSynth
              || instrument instanceof VocalPadSynth
              || instrument instanceof RhythmicPulseSynth
            ) {
              instrument.tick(time, tickDuration);

              // Emit instrument tick event for tracking
              this.events$.next({ type: "instrument-tick", timestamp: time, data: { instrument: instrumentType } });
            }
          }
        },
      );
    }, "16n");
  }

  private playPatternStep(
    beat: number,
    patterns: Map<InstrumentType, InstrumentPattern>,
    currentChord: Note[],
    time: number,
  ): void {
    for (const [instrumentType, pattern] of patterns.entries()) {
      if (!pattern.enabled) {
        continue;
      }

      const stepIndex = beat % pattern.length;
      const step = pattern.steps[stepIndex];

      if (step?.enabled) {
        const synth = this.synthInstances.get(instrumentType);
        if (synth) {
          const note = harmonizeNote(step.note, currentChord, instrumentType);
          const noteString = noteToToneString(note);

          synth.triggerAttackRelease(noteString, step.duration, time, step.velocity);

          // Emit playback event for tracking
          this.events$.next({
            type: "note-played",
            timestamp: time,
            data: { instrument: instrumentType, notes: [note], velocity: step.velocity, duration: step.duration },
          });
        }
      }
    }
  }

  private updateState(updater: (state: AudioEngineState) => AudioEngineState): void {
    this.state$.next(updater(this.state$.value));
  }

  getChordProgression$(): Observable<Note[][]> {
    return this.chordProgression$;
  }

  getRandomizedPatterns$(): Observable<Map<InstrumentType, InstrumentPattern>> {
    return this.randomizedPatterns$;
  }
}
