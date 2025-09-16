import type { AudioEngineState } from "$lib/types/audio";
import type {
  AmbientPadParams,
  ArpeggiatorParams,
  FieldRecordingParams,
  GranularParams,
  HarmonicDroneParams,
  MelodicParams,
  RhythmicPulseParams,
  VocalPadParams,
} from "$lib/types/params";
import type { EffectType, InstrumentType } from "./instruments";

export interface AmbientInstrumentConfig {
  ambientPad: AmbientPadParams;
  granular: GranularParams;
  melodic: MelodicParams;
  harmonicDrone: HarmonicDroneParams;
  rhythmicPulse: RhythmicPulseParams;
  fieldRecording?: FieldRecordingParams;
  vocalPad?: VocalPadParams;
  arpeggiator?: ArpeggiatorParams;
}

type Voice = {
  type: "synth" | "sampler" | "drone" | "granular" | "piano";
  count: number;
  envelope?: { attack: number; decay: number; sustain: number; release: number };
  oscillator?: { type: "sine" | "triangle" | "sawtooth" | "square" | "noise"; detuneRange?: number };
  sampleUrls?: string[];
};

export type AmbientPreset = {
  name: string;
  tempo: number;
  scale: string[];
  voices: Array<Voice>;
  processing: {
    reverb: { wet: number; decay: number; preDelay: number };
    delay?: { wet: number; time: string; feedback: number };
    filter?: { type: "lowpass" | "highpass" | "bandpass"; frequency: number; Q?: number };
    chorus?: { wet: number; frequency: number; depth: number };
  };
  structure: {
    density: number;
    randomness: number;
    layering: "minimal" | "medium" | "dense";
    generativePattern: "markov" | "random-walk" | "euclidean" | "static-drone";
  };
  mix: { width: number; tapeSaturation: number; volume: number };
  instruments: AmbientInstrumentConfig;
};

export enum AmbientInstrumentType {
  AmbientPad = "ambientPad",
  Granular = "granular",
  Melodic = "melodic",
  HarmonicDrone = "harmonicDrone",
  RhythmicPulse = "rhythmicPulse",
  FieldRecording = "fieldRecording",
  VocalPad = "vocalPad",
  Arpeggiator = "arpeggiator",
}

export type Preset = {
  id: string;
  name: string;
  description: string;
  theme: string;
  config: Partial<AudioEngineState>;
  effects?: Partial<Record<InstrumentType, EffectType[]>>;
  texture: AmbientPreset;
};
