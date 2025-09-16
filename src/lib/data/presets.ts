import { EffectType, InstrumentType } from "$lib/audio";
import type { AudioEngineState } from "$lib/audio-engine";
import { Mode, Note } from "$lib/theory";
import type { Optional } from "$lib/types";
import { SvelteSet } from "svelte/reactivity";

export interface AmbientInstrumentConfig {
  ambientPad: { volume: number; muted: boolean; enabled: boolean; filterFreq: number; resonance: number };
  granular: {
    volume: number;
    muted: boolean;
    enabled: boolean;
    density: number;
    grainSize: number;
    pitch: number;
    spread: number;
  };
  melodic: { volume: number; muted: boolean; enabled: boolean; octave: number };
  harmonicDrone: {
    volume: number;
    muted: boolean;
    enabled: boolean;
    changeInterval: number;
    voiceLeading: number;
    voiceCount: number;
    spread: number;
  };
  rhythmicPulse: {
    volume: number;
    muted: boolean;
    enabled: boolean;
    baseTempo: number;
    accentProb: number;
    layerCount: number;
    tempoVar: number;
    syncopation: number;
  };
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

export const PRESETS: Preset[] = [{
  id: "cosmic-voyage",
  name: "Cosmic Voyage",
  description: "Drift through starfields and nebulae with ethereal pads and atmospheric textures",
  theme: "Space",
  config: {
    tempo: 68,
    key: Note.A,
    mode: Mode.Aeolian,
    volume: 0.65,
    instruments: new SvelteSet([InstrumentType.AmbientPad, InstrumentType.Granular, InstrumentType.Melodic]),
  },
  texture: {
    name: "Cosmic Voyage",
    tempo: 68,
    scale: ["A", "B", "C", "D", "E", "F", "G"],
    voices: [{
      type: "synth",
      count: 4,
      envelope: { attack: 6, decay: 3, sustain: 0.8, release: 12 },
      oscillator: { type: "sine", detuneRange: 8 },
    }],
    processing: {
      reverb: { wet: 0.8, decay: 15, preDelay: 0.2 },
      delay: { wet: 0.3, time: "8n", feedback: 0.4 },
      chorus: { wet: 0.4, frequency: 0.2, depth: 0.6 },
    },
    structure: { density: 8, randomness: 0.4, layering: "medium", generativePattern: "random-walk" },
    mix: { width: 0.9, tapeSaturation: 0.15, volume: 0.65 },
    instruments: {
      ambientPad: { volume: 0.5, muted: false, enabled: true, filterFreq: 600, resonance: 1.2 },
      granular: { volume: 0.25, muted: false, enabled: true, density: 0.15, grainSize: 0.2, pitch: 0, spread: 400 },
      melodic: { volume: 0.15, muted: false, enabled: true, octave: 4 },
      harmonicDrone: {
        volume: 0.3,
        muted: false,
        enabled: false,
        changeInterval: 12,
        voiceLeading: 0.6,
        voiceCount: 3,
        spread: 1.8,
      },
      rhythmicPulse: {
        volume: 0.1,
        muted: false,
        enabled: false,
        baseTempo: 68,
        accentProb: 0.2,
        layerCount: 2,
        tempoVar: 0.15,
        syncopation: 0.3,
      },
    },
  },
}, {
  id: "ancient-forest",
  name: "Ancient Forest",
  description: "Deep woodland ambience with organic textures and natural harmonies",
  theme: "Forest",
  config: {
    tempo: 75,
    key: Note.D,
    mode: Mode.Dorian,
    volume: 0.6,
    instruments: new SvelteSet([InstrumentType.AmbientPad, InstrumentType.Granular, InstrumentType.HarmonicDrone]),
  },
  texture: {
    name: "Ancient Forest",
    tempo: 75,
    scale: ["D", "E", "F", "G", "A", "B", "C"],
    voices: [{
      type: "synth",
      count: 5,
      envelope: { attack: 5, decay: 4, sustain: 0.6, release: 8 },
      oscillator: { type: "triangle", detuneRange: 12 },
    }],
    processing: {
      reverb: { wet: 0.7, decay: 10, preDelay: 0.1 },
      filter: { type: "lowpass", frequency: 600, Q: 0.8 },
      chorus: { wet: 0.2, frequency: 0.4, depth: 0.3 },
    },
    structure: { density: 10, randomness: 0.6, layering: "medium", generativePattern: "markov" },
    mix: { width: 0.8, tapeSaturation: 0.25, volume: 0.6 },
    instruments: {
      ambientPad: { volume: 0.4, muted: false, enabled: true, filterFreq: 500, resonance: 1 },
      granular: { volume: 0.2, muted: false, enabled: true, density: 0.25, grainSize: 0.18, pitch: -1, spread: 350 },
      melodic: { volume: 0.12, muted: false, enabled: false, octave: 3 },
      harmonicDrone: {
        volume: 0.35,
        muted: false,
        enabled: true,
        changeInterval: 10,
        voiceLeading: 0.8,
        voiceCount: 4,
        spread: 1.4,
      },
      rhythmicPulse: {
        volume: 0.08,
        muted: false,
        enabled: false,
        baseTempo: 75,
        accentProb: 0.15,
        layerCount: 2,
        tempoVar: 0.2,
        syncopation: 0.2,
      },
    },
  },
}, {
  id: "lucid-dreams",
  name: "Lucid Dreams",
  description: "Floating between consciousness and sleep with shimmering textures",
  theme: "Ethereal/Dreamy",
  config: {
    tempo: 60,
    key: Note.E,
    mode: Mode.Lydian,
    volume: 0.55,
    instruments: new SvelteSet([InstrumentType.AmbientPad, InstrumentType.Granular, InstrumentType.Melodic]),
  },
  texture: {
    name: "Lucid Dreams",
    tempo: 60,
    scale: ["E", "F#", "G#", "A#", "B", "C#", "D#"],
    voices: [{
      type: "synth",
      count: 3,
      envelope: { attack: 8, decay: 2, sustain: 0.9, release: 15 },
      oscillator: { type: "sine", detuneRange: 3 },
    }],
    processing: {
      reverb: { wet: 0.9, decay: 20, preDelay: 0.3 },
      delay: { wet: 0.4, time: "4n.", feedback: 0.5 },
      chorus: { wet: 0.6, frequency: 0.15, depth: 0.8 },
      filter: { type: "lowpass", frequency: 1200, Q: 0.4 },
    },
    structure: { density: 6, randomness: 0.3, layering: "minimal", generativePattern: "random-walk" },
    mix: { width: 1, tapeSaturation: 0.1, volume: 0.55 },
    instruments: {
      ambientPad: { volume: 0.45, muted: false, enabled: true, filterFreq: 800, resonance: 0.8 },
      granular: { volume: 0.18, muted: false, enabled: true, density: 0.12, grainSize: 0.25, pitch: 2, spread: 600 },
      melodic: { volume: 0.08, muted: false, enabled: true, octave: 5 },
      harmonicDrone: {
        volume: 0.2,
        muted: false,
        enabled: false,
        changeInterval: 16,
        voiceLeading: 0.9,
        voiceCount: 2,
        spread: 2,
      },
      rhythmicPulse: {
        volume: 0.05,
        muted: false,
        enabled: false,
        baseTempo: 60,
        accentProb: 0.1,
        layerCount: 1,
        tempoVar: 0.05,
        syncopation: 0.1,
      },
    },
  },
}, {
  id: "steel-cathedral",
  name: "Steel Cathedral",
  description: "Mechanical rhythms and metallic textures in vast industrial spaces",
  theme: "Industrial",
  config: {
    tempo: 88,
    key: Note.F,
    mode: Mode.Phrygian,
    volume: 0.75,
    instruments: new SvelteSet([InstrumentType.AmbientPad, InstrumentType.Granular, InstrumentType.RhythmicPulse]),
  },
  texture: {
    name: "Steel Cathedral",
    tempo: 88,
    scale: ["F", "Gb", "Ab", "Bb", "C", "Db", "Eb"],
    voices: [{
      type: "synth",
      count: 6,
      envelope: { attack: 2, decay: 1, sustain: 0.7, release: 4 },
      oscillator: { type: "sawtooth", detuneRange: 15 },
    }],
    processing: {
      reverb: { wet: 0.6, decay: 8, preDelay: 0.05 },
      delay: { wet: 0.3, time: "8n", feedback: 0.6 },
      filter: { type: "lowpass", frequency: 400, Q: 1.5 },
    },
    structure: { density: 18, randomness: 0.5, layering: "dense", generativePattern: "euclidean" },
    mix: { width: 0.7, tapeSaturation: 0.4, volume: 0.75 },
    instruments: {
      ambientPad: { volume: 0.35, muted: false, enabled: true, filterFreq: 300, resonance: 2 },
      granular: { volume: 0.3, muted: false, enabled: true, density: 0.4, grainSize: 0.08, pitch: -3, spread: 200 },
      melodic: { volume: 0.1, muted: false, enabled: false, octave: 2 },
      harmonicDrone: {
        volume: 0.25,
        muted: false,
        enabled: false,
        changeInterval: 8,
        voiceLeading: 0.4,
        voiceCount: 5,
        spread: 1,
      },
      rhythmicPulse: {
        volume: 0.4,
        muted: false,
        enabled: true,
        baseTempo: 88,
        accentProb: 0.7,
        layerCount: 4,
        tempoVar: 0.3,
        syncopation: 0.8,
      },
    },
  },
}, {
  id: "gentle-current",
  name: "Gentle Current",
  description: "Flowing melodies and warm harmonies that ebb and flow like water",
  theme: "Melodic",
  config: {
    tempo: 80,
    key: Note.G,
    mode: Mode.Ionian,
    volume: 0.65,
    instruments: new SvelteSet([InstrumentType.AmbientPad, InstrumentType.Melodic, InstrumentType.HarmonicDrone]),
  },
  texture: {
    name: "Gentle Current",
    tempo: 80,
    scale: ["G", "A", "B", "C", "D", "E", "F#"],
    voices: [{
      type: "synth",
      count: 4,
      envelope: { attack: 3, decay: 2, sustain: 0.8, release: 6 },
      oscillator: { type: "sine", detuneRange: 6 },
    }],
    processing: {
      reverb: { wet: 0.65, decay: 12, preDelay: 0.12 },
      delay: { wet: 0.25, time: "4n", feedback: 0.35 },
      chorus: { wet: 0.35, frequency: 0.25, depth: 0.4 },
    },
    structure: { density: 14, randomness: 0.4, layering: "medium", generativePattern: "markov" },
    mix: { width: 0.85, tapeSaturation: 0.2, volume: 0.65 },
    instruments: {
      ambientPad: { volume: 0.3, muted: false, enabled: true, filterFreq: 700, resonance: 1.1 },
      granular: { volume: 0.15, muted: false, enabled: false, density: 0.18, grainSize: 0.16, pitch: 1, spread: 300 },
      melodic: { volume: 0.4, muted: false, enabled: true, octave: 4 },
      harmonicDrone: {
        volume: 0.25,
        muted: false,
        enabled: true,
        changeInterval: 8,
        voiceLeading: 0.75,
        voiceCount: 3,
        spread: 1.3,
      },
      rhythmicPulse: {
        volume: 0.12,
        muted: false,
        enabled: false,
        baseTempo: 80,
        accentProb: 0.25,
        layerCount: 2,
        tempoVar: 0.12,
        syncopation: 0.35,
      },
    },
  },
}, {
  id: "discreet-music",
  name: "Brian Eno – Discreet Music",
  description: "Minimalist ambient textures with gentle evolving patterns",
  theme: "Ambient/Generative",
  config: {
    tempo: 60,
    key: Note.C,
    mode: Mode.Aeolian,
    volume: 0.7,
    instruments: new SvelteSet([InstrumentType.AmbientPad, InstrumentType.Granular, InstrumentType.Melodic]),
  },
  texture: {
    name: "Brian Eno – Discreet Music",
    tempo: 60,
    scale: ["C", "D", "F", "G", "A"],
    voices: [{
      type: "synth",
      count: 3,
      envelope: { attack: 4, decay: 2, sustain: 0.7, release: 8 },
      oscillator: { type: "sine", detuneRange: 5 },
    }],
    processing: {
      reverb: { wet: 0.6, decay: 8, preDelay: 0.1 },
      delay: { wet: 0.2, time: "4n", feedback: 0.3 },
      filter: { type: "lowpass", frequency: 800, Q: 0.7 },
    },
    structure: { density: 12, randomness: 0.3, layering: "minimal", generativePattern: "random-walk" },
    mix: { width: 0.8, tapeSaturation: 0.2, volume: 0.7 },
    instruments: {
      ambientPad: { volume: 0.4, muted: false, enabled: true, filterFreq: 400, resonance: 1.5 },
      granular: { volume: 0.15, muted: false, enabled: true, density: 0.2, grainSize: 0.15, pitch: -1, spread: 300 },
      melodic: { volume: 0.1, muted: false, enabled: true, octave: 3 },
      harmonicDrone: {
        volume: 0.25,
        muted: false,
        enabled: false,
        changeInterval: 8,
        voiceLeading: 0.7,
        voiceCount: 4,
        spread: 1.5,
      },
      rhythmicPulse: {
        volume: 0.2,
        muted: false,
        enabled: false,
        baseTempo: 90,
        accentProb: 0.3,
        layerCount: 3,
        tempoVar: 0.1,
        syncopation: 0.4,
      },
    },
  },
}, {
  id: "lovely-thunder",
  name: "Harold Budd – Lovely Thunder",
  description: "Sparse piano textures with lush harmonic drones",
  theme: "Ambient/Melodic",
  config: {
    tempo: 45,
    key: Note.C,
    mode: Mode.Aeolian,
    volume: 0.6,
    instruments: new SvelteSet([InstrumentType.AmbientPad, InstrumentType.Melodic, InstrumentType.HarmonicDrone]),
  },
  texture: {
    name: "Harold Budd – Lovely Thunder",
    tempo: 45,
    scale: ["C", "D", "E", "G", "A", "B"],
    voices: [{ type: "piano", count: 2, envelope: { attack: 0.1, decay: 3, sustain: 0.3, release: 5 } }],
    processing: { reverb: { wet: 0.8, decay: 12, preDelay: 0.15 }, chorus: { wet: 0.3, frequency: 0.3, depth: 0.5 } },
    structure: { density: 6, randomness: 0.5, layering: "medium", generativePattern: "markov" },
    mix: { width: 0.9, tapeSaturation: 0.3, volume: 0.6 },
    instruments: {
      ambientPad: { volume: 0.2, muted: false, enabled: true, filterFreq: 600, resonance: 1.2 },
      granular: { volume: 0.1, muted: false, enabled: false, density: 0.1, grainSize: 0.2, pitch: 0, spread: 200 },
      melodic: { volume: 0.3, muted: false, enabled: true, octave: 4 },
      harmonicDrone: {
        volume: 0.15,
        muted: false,
        enabled: true,
        changeInterval: 12,
        voiceLeading: 0.8,
        voiceCount: 3,
        spread: 1.2,
      },
      rhythmicPulse: {
        volume: 0,
        muted: true,
        enabled: false,
        baseTempo: 45,
        accentProb: 0.1,
        layerCount: 1,
        tempoVar: 0.05,
        syncopation: 0.1,
      },
    },
  },
}, {
  id: "stars-of-the-lid",
  name: "Stars of the Lid – Drone",
  description: "Deep, sustained drone textures with minimal movement",
  theme: "Ambient/Drone",
  config: {
    tempo: 40,
    key: Note.C,
    mode: Mode.Aeolian,
    volume: 0.8,
    instruments: new SvelteSet([InstrumentType.AmbientPad, InstrumentType.Granular, InstrumentType.HarmonicDrone]),
  },
  texture: {
    name: "Stars of the Lid – Drone",
    tempo: 40,
    scale: ["C", "F", "G"],
    voices: [{
      type: "drone",
      count: 4,
      envelope: { attack: 8, decay: 0, sustain: 1, release: 10 },
      oscillator: { type: "sine", detuneRange: 2 },
    }],
    processing: { reverb: { wet: 0.9, decay: 15, preDelay: 0.2 }, filter: { type: "lowpass", frequency: 400, Q: 0.5 } },
    structure: { density: 2, randomness: 0.1, layering: "dense", generativePattern: "static-drone" },
    mix: { width: 1, tapeSaturation: 0.4, volume: 0.8 },
    instruments: {
      ambientPad: { volume: 0.5, muted: false, enabled: true, filterFreq: 300, resonance: 0.8 },
      granular: { volume: 0.2, muted: false, enabled: true, density: 0.05, grainSize: 0.3, pitch: -2, spread: 500 },
      melodic: { volume: 0.05, muted: false, enabled: false, octave: 2 },
      harmonicDrone: {
        volume: 0.6,
        muted: false,
        enabled: true,
        changeInterval: 16,
        voiceLeading: 0.9,
        voiceCount: 6,
        spread: 2,
      },
      rhythmicPulse: {
        volume: 0,
        muted: true,
        enabled: false,
        baseTempo: 40,
        accentProb: 0.05,
        layerCount: 1,
        tempoVar: 0.02,
        syncopation: 0,
      },
    },
  },
}];

export const AMBIENT_TO_ENGINE_MAPPING: Record<AmbientInstrumentType, InstrumentType> = {
  [AmbientInstrumentType.AmbientPad]: InstrumentType.AmbientPad,
  [AmbientInstrumentType.Granular]: InstrumentType.Granular,
  [AmbientInstrumentType.Melodic]: InstrumentType.Melodic,
  [AmbientInstrumentType.HarmonicDrone]: InstrumentType.HarmonicDrone,
  [AmbientInstrumentType.RhythmicPulse]: InstrumentType.RhythmicPulse,
};

export function scaleToNotes(scaleNames: string[]): Note[] {
  const noteMap: Record<string, Note> = {
    "C": Note.C,
    "C#": Note.CSharp,
    "Db": Note.CSharp,
    "D": Note.D,
    "D#": Note.DSharp,
    "Eb": Note.DSharp,
    "E": Note.E,
    "F": Note.F,
    "F#": Note.FSharp,
    "Gb": Note.FSharp,
    "G": Note.G,
    "G#": Note.GSharp,
    "Ab": Note.GSharp,
    "A": Note.A,
    "A#": Note.ASharp,
    "Bb": Note.ASharp,
    "B": Note.B,
  };

  return scaleNames.map(name => noteMap[name] ?? Note.C);
}

export const getPreset = (id: string): Optional<Preset> => PRESETS.find(preset => preset.id === id);

export const getPresetsByTheme = (theme: string): Preset[] => {
  return PRESETS.filter(preset => preset.theme.toLowerCase().includes(theme.toLowerCase()));
};

export const getThemes = (): string[] => ["All", ...new SvelteSet(PRESETS.map(preset => preset.theme))];
