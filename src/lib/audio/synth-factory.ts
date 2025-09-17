import { InstrumentType, type SynthParams } from "$lib/types/instruments";
import * as Tone from "tone";

export const DEFAULT_SYNTH_PARAMS: Record<InstrumentType, SynthParams> = {
  [InstrumentType.Pad]: {
    attack: 2,
    decay: 0.5,
    sustain: 0.8,
    release: 4,
    filterFreq: 800,
    filterQ: 1,
    detune: 0,
    volume: -12,
  },
  [InstrumentType.Lead]: {
    attack: 0.1,
    decay: 0.3,
    sustain: 0.6,
    release: 1.5,
    filterFreq: 1200,
    filterQ: 2,
    detune: 0,
    volume: -18,
  },
  [InstrumentType.Bass]: {
    attack: 0.05,
    decay: 0.2,
    sustain: 0.4,
    release: 0.8,
    filterFreq: 400,
    filterQ: 1.5,
    detune: 0,
    volume: -8,
  },
  [InstrumentType.Percussion]: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0,
    release: 0.3,
    filterFreq: 2000,
    filterQ: 0.5,
    detune: 0,
    volume: -15,
  },
  [InstrumentType.Atmosphere]: {
    attack: 4,
    decay: 2,
    sustain: 0.9,
    release: 8,
    filterFreq: 600,
    filterQ: 0.8,
    detune: 5,
    volume: -20,
  },
  [InstrumentType.Texture]: {
    attack: 1,
    decay: 1,
    sustain: 0.7,
    release: 3,
    filterFreq: 1000,
    filterQ: 1.2,
    detune: -3,
    volume: -16,
  },
  // Ambient instruments
  [InstrumentType.AmbientPad]: {
    attack: 2,
    decay: 0.5,
    sustain: 0.8,
    release: 4,
    filterFreq: 400,
    filterQ: 1.5,
    detune: 0,
    volume: -10,
  },
  [InstrumentType.Granular]: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.3,
    release: 0.2,
    filterFreq: 800,
    filterQ: 1,
    detune: 0,
    volume: -14,
  },
  [InstrumentType.Melodic]: {
    attack: 0.1,
    decay: 0.3,
    sustain: 0.6,
    release: 1.5,
    filterFreq: 1200,
    filterQ: 2,
    detune: 0,
    volume: -20,
  },
  [InstrumentType.HarmonicDrone]: {
    attack: 8,
    decay: 0,
    sustain: 1,
    release: 10,
    filterFreq: 400,
    filterQ: 0.5,
    detune: 2,
    volume: -12,
  },
  [InstrumentType.RhythmicPulse]: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0,
    release: 0.3,
    filterFreq: 2000,
    filterQ: 0.5,
    detune: 0,
    volume: -18,
  },
  [InstrumentType.FieldRecording]: {
    attack: 0.5,
    decay: 1,
    sustain: 1,
    release: 2,
    filterFreq: 800,
    filterQ: 1,
    detune: 0,
    volume: -15,
  },
  [InstrumentType.VocalPad]: {
    attack: 3,
    decay: 0.5,
    sustain: 0.9,
    release: 5,
    filterFreq: 1200,
    filterQ: 0.8,
    detune: 0,
    volume: -14,
  },
  [InstrumentType.Arpeggiator]: {
    attack: 0.05,
    decay: 0.4,
    sustain: 0.3,
    release: 1,
    filterFreq: 1500,
    filterQ: 2,
    detune: 0,
    volume: -16,
  },
};

const getSynthWaveform = (type: InstrumentType) => {
  switch (type) {
    case InstrumentType.Pad: {
      return "sawtooth";
    }
    case InstrumentType.Lead: {
      return "square";
    }
    case InstrumentType.Bass: {
      return "triangle";
    }
    case InstrumentType.Percussion: {
      return "square";
    }
    case InstrumentType.Atmosphere: {
      return "sine";
    }
    case InstrumentType.Texture: {
      return "sawtooth";
    }
    default: {
      return "sine";
    }
  }
};

export const createSynth = (type: InstrumentType, params?: Partial<SynthParams>): Tone.PolySynth => {
  const finalParams = { ...DEFAULT_SYNTH_PARAMS[type], ...params };

  const synth = new Tone.PolySynth({
    voice: Tone.Synth,
    options: {
      envelope: {
        attack: finalParams.attack,
        decay: finalParams.decay,
        sustain: finalParams.sustain,
        release: finalParams.release,
      },
      volume: finalParams.volume,
    },
    maxPolyphony: 16,
  });

  synth.set({ oscillator: { type: getSynthWaveform(type) } });

  return synth;
};
