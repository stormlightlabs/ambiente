import type { Mode, Note } from "$lib/theory";
import type { InstrumentType } from "$lib/types/instruments";
import type { SvelteSet } from "svelte/reactivity";

export interface AudioEngineState {
  isPlaying: boolean;
  tempo: number;
  key: Note;
  mode: Mode;
  currentChord: number;
  volume: number;
  instruments: SvelteSet<InstrumentType>;
  randomization: RandomizationParams;
}

export type AudioEventKind = "play" | "pause" | "stop" | "chord-change" | "parameter-change" | "instrument-toggle" | "note-played" | "instrument-tick";
export type AudioEventData = {
  chord?: Note[];
  index?: number;
  instrument?: InstrumentType;
  enabled?: boolean;
  notes?: Note[];
  velocity?: number;
  duration?: string;
};
export type AudioEvent = { type: AudioEventKind; timestamp: number; data?: AudioEventData };
export type PatternStep = { note: Note; velocity: number; duration: string; enabled: boolean };
export type InstrumentPattern = { type: InstrumentType; steps: PatternStep[]; length: number; enabled: boolean };

export interface RandomizationParams {
  enabled: boolean;
  /** 0-1, probability of rhythm changes */
  rhythmVariability: number;
  /** 0-1, probability of note substitutions */
  melodicVariability: number;
  /** 0-1, probability of chord substitutions */
  chordProgression: number;
  /** 0-1, probability of pattern mutations */
  patternEvolution: number;
  /** 0-1, constraint strength for musical coherence */
  constraintStrength: number;
  /** For reproducible randomization */
  seed?: number;
}
