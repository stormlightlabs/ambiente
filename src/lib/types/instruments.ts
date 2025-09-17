export enum InstrumentType {
  Pad = "pad",
  Lead = "lead",
  Bass = "bass",
  Percussion = "percussion",
  Atmosphere = "atmosphere",
  Texture = "texture",
  // Ambient instruments
  AmbientPad = "ambientPad",
  Granular = "granular",
  Melodic = "melodic",
  HarmonicDrone = "harmonicDrone",
  RhythmicPulse = "rhythmicPulse",
  FieldRecording = "fieldRecording",
  VocalPad = "vocalPad",
  Arpeggiator = "arpeggiator",
}

export const instrumentTypes = Object.values(InstrumentType);

export const getInstrumentDisplayName = (type: InstrumentType): string => type.replaceAll(/([A-Z])/g, " $1").trim();

export type SynthParams = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterFreq: number;
  filterQ: number;
  detune: number;
  volume: number;
};

export enum EffectType {
  Reverb = "reverb",
  Delay = "delay",
  Chorus = "chorus",
  Filter = "filter",
  Distortion = "distortion",
  Compressor = "compressor",
}
