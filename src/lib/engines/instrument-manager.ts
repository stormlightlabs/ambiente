import { AmbientMixer } from "$lib/audio/mixer";
import { createSynth } from "$lib/audio/synth-factory";
import { logger } from "$lib/debug/audio-logger";
import {
  createAmbientInstrument,
  createDefaultPattern,
  getDefaultEffects,
  isAmbientInstrument,
  type SynthKind,
} from "$lib/engines/utilities";
import { AmbientPadSynth } from "$lib/instruments/ambient-pad";
import { ArpeggiatorSynth } from "$lib/instruments/arpeggiator";
import { GranularSynth } from "$lib/instruments/granular-synth";
import { HarmonicDroneSynth } from "$lib/instruments/harmonic-drone-synth";
import { MelodicSynth } from "$lib/instruments/melodic-synth";
import { VocalPadSynth } from "$lib/instruments/vocal-pads";
import { Note } from "$lib/theory";
import type { AudioEngineState, AudioEvent, InstrumentPattern } from "$lib/types/audio";
import type { BaseInstrument } from "$lib/types/base";
import { InstrumentType } from "$lib/types/instruments";
import type { Params } from "$lib/types/params";
import { RhythmicPulseSynth } from "$lib/types/rhythmic-pulse-synth";
import { BehaviorSubject, Subject } from "rxjs";
import * as Tone from "tone";

export class InstrumentManager {
  private readonly state$: BehaviorSubject<AudioEngineState>;
  private readonly events$: Subject<AudioEvent>;
  private readonly patterns$: BehaviorSubject<Map<InstrumentType, InstrumentPattern>>;
  private readonly currentScale$: BehaviorSubject<Note[]>;
  private readonly currentChord$: BehaviorSubject<Note[]>;
  private readonly synthInstances: Map<InstrumentType, Tone.PolySynth>;
  private readonly ambientInstruments: Map<InstrumentType, SynthKind>;
  private readonly ambientMixer: AmbientMixer;
  private readonly PREFIX = "[InstrumentManager]";

  constructor(
    state$: BehaviorSubject<AudioEngineState>,
    events$: Subject<AudioEvent>,
    patterns$: BehaviorSubject<Map<InstrumentType, InstrumentPattern>>,
    currentScale$: BehaviorSubject<Note[]>,
    currentChord$: BehaviorSubject<Note[]>,
    synthInstances: Map<InstrumentType, Tone.PolySynth>,
    ambientInstruments: Map<InstrumentType, SynthKind>,
    ambientMixer: AmbientMixer,
  ) {
    this.state$ = state$;
    this.events$ = events$;
    this.patterns$ = patterns$;
    this.currentScale$ = currentScale$;
    this.currentChord$ = currentChord$;
    this.synthInstances = synthInstances;
    this.ambientInstruments = ambientInstruments;
    this.ambientMixer = ambientMixer;
  }

  updateInstruments(instruments: Set<InstrumentType>): void {
    this.log("updateInstruments called with:", [...instruments]);

    const synthsToRemove = [];
    for (const [type, synth] of this.synthInstances.entries()) {
      if (!instruments.has(type)) {
        this.log("Removing synth:", type);
        synth.dispose();
        this.synthInstances.delete(type);
        synthsToRemove.push(type);

        const patterns = new Map(this.patterns$.value);
        patterns.delete(type);
        this.patterns$.next(patterns);
      }
    }
    if (synthsToRemove.length > 0) {
      this.log(`Removed ${synthsToRemove.length} synths:`, synthsToRemove);
    }

    // Remove ambient instruments no longer needed
    const ambientToRemove = [];
    for (const [type, instrument] of this.ambientInstruments.entries()) {
      if (!instruments.has(type)) {
        this.log("Removing ambient instrument:", type);
        instrument.dispose();
        this.ambientInstruments.delete(type);
        ambientToRemove.push(type);
      }
    }
    if (ambientToRemove.length > 0) {
      this.log(`Removed ${ambientToRemove.length} ambient instruments:`, ambientToRemove);
    }

    const synthsAdded = [];
    const ambientAdded = [];
    for (const type of instruments) {
      if (isAmbientInstrument(type)) {
        if (!this.ambientInstruments.has(type)) {
          this.log("Creating ambient instrument:", type);
          try {
            const instrument = createAmbientInstrument(type);
            if (instrument) {
              const channel = this.ambientMixer.getChannel(type);
              if (!channel) {
                this.error("No channel found for instrument:", type);
                continue;
              }

              instrument.connect(channel);
              this.ambientInstruments.set(type, instrument);
              ambientAdded.push(type);
              this.log(`Connected ambient instrument ${type} to channel`);

              // @ts-expect-error need to extract the param type for this generic
              this.updateAmbientInstrumentContext(instrument);
            } else {
              this.error("Failed to create ambient instrument:", type);
            }
          } catch (error) {
            this.error(`Error creating ambient instrument ${type}:`, error);
          }
        }
      } else {
        if (!this.synthInstances.has(type)) {
          this.log("Creating synth:", type);
          try {
            const synth = createSynth(type);
            const effects = getDefaultEffects(type);

            this.ambientMixer.connectSynth(synth, type, effects);
            this.synthInstances.set(type, synth);
            synthsAdded.push(type);
            this.log(`Connected synth ${type} with effects:`, effects);

            const currentState = this.state$.value;
            const pattern = createDefaultPattern(type, currentState.key, currentState.mode);
            const patterns = new Map(this.patterns$.value);
            patterns.set(type, pattern);
            this.patterns$.next(patterns);
            this.log("Created default pattern for synth:", type);
          } catch (error) {
            this.error(`Error creating synth ${type}:`, error);
          }
        }
      }
    }

    if (synthsAdded.length > 0) {
      this.log(`Added ${synthsAdded.length} synths:`, synthsAdded);
    }
    if (ambientAdded.length > 0) {
      this.log(`Added ${ambientAdded.length} ambient instruments:`, ambientAdded);
    }
  }

  updateAmbientInstrumentContext<T extends Params>(instrument: BaseInstrument<T>): void {
    const currentScale = this.currentScale$.value;
    const currentChord = this.currentChord$.value;
    const instrumentName = instrument.constructor.name;

    this.log(`Updating context for ${instrumentName}`);
    this.log("Current scale:", currentScale?.map(n => Note[n]).join(", ") || "none");
    this.log("Current chord:", currentChord?.map(n => Note[n]).join(", ") || "none");

    if (instrument instanceof GranularSynth) {
      instrument.setScale(currentScale);
      this.log("Set scale for GranularSynth");
    }

    if (instrument instanceof AmbientPadSynth) {
      instrument.setChord(currentChord);
      this.log("Set chord for AmbientPadSynth");
    }

    if (instrument instanceof MelodicSynth) {
      instrument.setScale(currentScale);
      this.log("Set scale for MelodicSynth");
    }

    if (instrument instanceof HarmonicDroneSynth) {
      instrument.setChord(currentChord);
      this.log("Set chord for HarmonicDroneSynth");
    }

    if (instrument instanceof RhythmicPulseSynth) {
      instrument.setScale(currentScale);
      this.log("Set scale for RhythmicPulseSynth");
    }

    if (instrument instanceof VocalPadSynth) {
      instrument.setChord(currentChord);
      this.log("Set chord for VocalPadSynth");
    }

    if (instrument instanceof ArpeggiatorSynth) {
      instrument.setScale(currentScale);
      this.log("Set scale for ArpeggiatorSynth");
    }
  }

  toggleInstrument(kind: InstrumentType): void {
    const currentState = this.state$.value;
    const newInstruments = new Set(currentState.instruments);
    const wasEnabled = newInstruments.has(kind);

    if (wasEnabled) {
      newInstruments.delete(kind);
      this.log("Toggling OFF instrument:", kind);
    } else {
      newInstruments.add(kind);
      this.log("Toggling ON instrument:", kind);
    }

    this.updateState(state => ({ ...state, instruments: newInstruments }));

    this.events$.next({
      type: "instrument-toggle",
      timestamp: Tone.now(),
      data: { instrument: kind, enabled: newInstruments.has(kind) },
    });

    this.log(`Instrument ${kind} toggled ${wasEnabled ? "OFF" : "ON"}`);
  }

  setInstrumentPattern(kind: InstrumentType, pattern: InstrumentPattern): void {
    const patterns = new Map(this.patterns$.value);
    patterns.set(kind, pattern);
    this.patterns$.next(patterns);
  }

  private updateState(updater: (state: AudioEngineState) => AudioEngineState): void {
    this.state$.next(updater(this.state$.value));
  }

  private log(message: string, ...args: any[]) {
    logger.debug(this.PREFIX ?? "", message, ...args);
  }

  private error(message: string, error_: unknown, ...args: any[]) {
    logger.error(this.PREFIX ?? "", message, error_, args);
  }
}
