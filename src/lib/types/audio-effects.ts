export interface SpectralProcessingParams {
  enabled: boolean;
  fftSize: 256 | 512 | 1024 | 2048 | 4096;
  windowType: "hann" | "hamming" | "blackman";
  spectralShift: number;
  harmonicEnhancement: number;
  noiseGate: number;
  wet: number;
}

export interface GranularDelayParams {
  enabled: boolean;
  delayTime: number;
  feedback: number;
  grainSize: number;
  grainDensity: number;
  grainPitch: number;
  grainSpread: number;
  wet: number;
}

export interface ConvolutionReverbParams {
  enabled: boolean;
  impulseUrl: string;
  roomSize: "small" | "medium" | "large" | "cathedral" | "hall";
  wet: number;
  decay: number;
  preDelay: number;
}

export interface TapeSaturationParams {
  enabled: boolean;
  drive: number;
  warmth: number;
  hiss: number;
  flutter: number;
  bias: number;
  wet: number;
}

export interface ModulatedFiltersParams {
  enabled: boolean;
  filterType: "lowpass" | "highpass" | "bandpass" | "notch";
  frequency: number;
  resonance: number;
  lfoRate: number;
  lfoDepth: number;
  lfoWave: "sine" | "triangle" | "square" | "sawtooth";
  envelope: boolean;
}

export interface StereoImagingParams {
  enabled: boolean;
  width: number;
  bassMonoFreq: number;
  stereoEnhancement: number;
  phase: number;
  haasDelay: number;
}

export interface ProbabilityOrnamentsParams {
  enabled: boolean;
  ornamentChance: number;
  ornamentTypes: Array<"trill" | "mordent" | "turn" | "grace" | "slide">;
  dynamicRange: number;
  timingVariation: number;
}

export interface AdaptiveDynamicsParams {
  enabled: boolean;
  analysisWindow: number;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  lookAhead: number;
  adaptiveGain: boolean;
}

export interface AdvancedEffectsConfig {
  spectralProcessing?: SpectralProcessingParams;
  granularDelay?: GranularDelayParams;
  convolutionReverb?: ConvolutionReverbParams;
  tapeSaturation?: TapeSaturationParams;
  modulatedFilters?: ModulatedFiltersParams;
  stereoImaging?: StereoImagingParams;
  probabilityOrnaments?: ProbabilityOrnamentsParams;
  adaptiveDynamics?: AdaptiveDynamicsParams;
}

export enum AdvancedEffectType {
  SpectralProcessing = "spectralProcessing",
  GranularDelay = "granularDelay",
  ConvolutionReverb = "convolutionReverb",
  TapeSaturation = "tapeSaturation",
  ModulatedFilters = "modulatedFilters",
  StereoImaging = "stereoImaging",
  ProbabilityOrnaments = "probabilityOrnaments",
  AdaptiveDynamics = "adaptiveDynamics",
}
