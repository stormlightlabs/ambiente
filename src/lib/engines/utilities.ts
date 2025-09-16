import { AmbientPadSynth } from "$lib/instruments/ambient-pad";
import { ArpeggiatorSynth } from "$lib/instruments/arpeggiator";
import { GranularSynth } from "$lib/instruments/granular-synth";
import { HarmonicDroneSynth } from "$lib/instruments/harmonic-drone-synth";
import { MelodicSynth } from "$lib/instruments/melodic-synth";
import { VocalPadSynth } from "$lib/instruments/vocal-pads";
import { generateScale, Mode, Note, NoteUtilities } from "$lib/theory";
import type { InstrumentPattern, PatternStep } from "$lib/types/audio";
import { FieldRecordingSynth } from "$lib/types/field-recording-synth";
import { EffectType, InstrumentType } from "$lib/types/instruments";
import { RhythmicPulseSynth } from "$lib/types/rhythmic-pulse-synth";
import type { Optional } from "$lib/types/shared";
import * as Tone from "tone";

export type SynthKind =
  | GranularSynth
  | AmbientPadSynth
  | MelodicSynth
  | HarmonicDroneSynth
  | RhythmicPulseSynth
  | FieldRecordingSynth
  | VocalPadSynth
  | ArpeggiatorSynth;

export function getPatternLengthForType(
  instrumentType: InstrumentType,
  patternType: "random-walk" | "euclidean" | "static-drone" | "markov",
): number {
  switch (patternType) {
    case "static-drone": {
      return 4;
    } // Short patterns for sustained drone notes
    case "euclidean": {
      return 16;
    } // Medium length for rhythmic patterns
    case "random-walk": {
      return 12;
    } // Medium length for melodic wandering
    case "markov": {
      return 8;
    } // Shorter for more coherent musical phrases
    default: {
      return 16;
    }
  }
}

export function shouldApplyVoiceToInstrument(voice: string, instrumentKind: InstrumentType): boolean {
  switch (voice) {
    case "piano": {
      return instrumentKind === InstrumentType.Melodic || instrumentKind === InstrumentType.AmbientPad;
    }
    case "drone": {
      return instrumentKind === InstrumentType.HarmonicDrone || instrumentKind === InstrumentType.Pad;
    }
    case "granular": {
      return instrumentKind === InstrumentType.Granular || instrumentKind === InstrumentType.Atmosphere;
    }
    case "synth": {
      return instrumentKind === InstrumentType.AmbientPad || instrumentKind === InstrumentType.Lead;
    }
    default: {
      return false;
    }
  }
}

export function scaleToNotes(scaleNames: string[]): Note[] {
  return scaleNames.map(name => NoteUtilities.Map[name.replace(/[♭♯]/, match => match === "♭" ? "b" : "#")] ?? Note.C);
}

export function getDefaultEffects(type: InstrumentType): EffectType[] {
  switch (type) {
    case InstrumentType.Pad: {
      return [EffectType.Reverb, EffectType.Chorus];
    }
    case InstrumentType.Lead: {
      return [EffectType.Delay, EffectType.Filter];
    }
    case InstrumentType.Bass: {
      return [EffectType.Compressor];
    }
    case InstrumentType.Atmosphere: {
      return [EffectType.Reverb, EffectType.Filter];
    }
    case InstrumentType.Texture: {
      return [EffectType.Reverb, EffectType.Delay, EffectType.Chorus];
    }
    case InstrumentType.Percussion: {
      return [EffectType.Compressor, EffectType.Reverb];
    }
    case InstrumentType.AmbientPad:
    case InstrumentType.Granular:
    case InstrumentType.Melodic:
    case InstrumentType.HarmonicDrone:
    case InstrumentType.RhythmicPulse: {
      return [];
    }
    default: {
      return [EffectType.Reverb];
    }
  }
}

export function tempoToMs(tempo: number): number {
  return (60 / tempo) * 1000;
}

export function isAmbientInstrument(type: InstrumentType): boolean {
  return [
    InstrumentType.AmbientPad,
    InstrumentType.Granular,
    InstrumentType.Melodic,
    InstrumentType.HarmonicDrone,
    InstrumentType.RhythmicPulse,
    InstrumentType.FieldRecording,
    InstrumentType.VocalPad,
    InstrumentType.Arpeggiator,
  ].includes(type);
}

export function createAmbientInstrument(type: InstrumentType): Optional<SynthKind> {
  switch (type) {
    case InstrumentType.Granular: {
      return new GranularSynth();
    }
    case InstrumentType.AmbientPad: {
      return new AmbientPadSynth();
    }
    case InstrumentType.Melodic: {
      return new MelodicSynth();
    }
    case InstrumentType.HarmonicDrone: {
      return new HarmonicDroneSynth();
    }
    case InstrumentType.RhythmicPulse: {
      return new RhythmicPulseSynth();
    }
    case InstrumentType.FieldRecording: {
      return new FieldRecordingSynth();
    }
    case InstrumentType.VocalPad: {
      return new VocalPadSynth();
    }
    case InstrumentType.Arpeggiator: {
      return new ArpeggiatorSynth();
    }
    default: {
      return void 0;
    }
  }
}

export const createDefaultPattern = (type: InstrumentType, key: Note, mode: Mode): InstrumentPattern => {
  const scale = generateScale(key, mode);
  const steps: PatternStep[] = [];

  switch (type) {
    case InstrumentType.Pad: {
      for (let index = 0; index < 16; index++) {
        steps.push({ note: scale[index % scale.length], velocity: 0.3, duration: "2m", enabled: index % 8 === 0 });
      }
      break;
    }
    case InstrumentType.Atmosphere: {
      for (let index = 0; index < 32; index++) {
        steps.push({
          note: scale[Math.floor(index / 4) % scale.length],
          velocity: 0.2,
          duration: "4m",
          enabled: index % 16 === 0,
        });
      }
      break;
    }
    case InstrumentType.Bass: {
      for (let index = 0; index < 8; index++) {
        steps.push({ note: scale[0], velocity: 0.4, duration: "1m", enabled: index % 4 === 0 });
      }
      break;
    }
    default: {
      for (let index = 0; index < 16; index++) {
        steps.push({ note: scale[index % scale.length], velocity: 0.3, duration: "1m", enabled: index % 4 === 0 });
      }
    }
  }

  return { type, steps, length: steps.length, enabled: true };
};

export function getNestedParam(synth: Tone.PolySynth, path: string): Optional<Tone.Param> {
  const parts = path.split(".");
  let current: unknown = synth.get();

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return;
    }
  }

  return current instanceof Tone.Param ? current : undefined;
}

export function harmonizeNote(note: Note, chord: Note[], instrumentType: InstrumentType): Note {
  if (instrumentType === InstrumentType.Pad || instrumentType === InstrumentType.Atmosphere) {
    return chord[Math.floor(Math.random() * chord.length)];
  }

  return note;
}
