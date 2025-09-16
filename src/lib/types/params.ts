export enum AmbientInstrumentType {
  AmbientPad = "ambientPad",
  Granular = "granular",
  Melodic = "melodic",
  HarmonicDrone = "harmonicDrone",
  RhythmicPulse = "rhythmicPulse",
}

export interface Params {
  volume: number;
  muted: boolean;
  enabled: boolean;
}

export interface GranularParams extends Params {
  density: number;
  grainSize: number;
  pitch: number;
  spread: number;
}

export interface AmbientPadParams extends Params {
  filterFreq: number;
  resonance: number;
}

export interface MelodicParams extends Params {
  octave: number;
}

export interface HarmonicDroneParams extends Params {
  changeInterval: number;
  voiceLeading: number;
  voiceCount: number;
  spread: number;
}

export interface RhythmicPulseParams extends Params {
  baseTempo: number;
  accentProb: number;
  layerCount: number;
  tempoVar: number;
  syncopation: number;
}

export interface FieldRecordingParams extends Params {
  textureType: "rain" | "forest" | "urban" | "wind" | "ocean";
  density: number;
  filterFreq: number;
  reverb: number;
  fadeTime: number;
}

export interface VocalPadParams extends Params {
  formantFreq: number;
  breathiness: number;
  vibrato: number;
  chorusDepth: number;
  attack: number;
  release: number;
}

export interface ArpeggiatorParams extends Params {
  tempo: number;
  pattern: "up" | "down" | "upDown" | "random";
  octaveRange: number;
  noteDuration: number;
  probability: number;
  swing: number;
}
