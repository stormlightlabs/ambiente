import { EffectType, InstrumentType } from "$lib/audio";
import type { AudioEngineState } from "$lib/audio-engine";
import { Mode, Note } from "$lib/theory";
import type { Optional } from "$lib/types";

export type Preset = {
  id: string;
  name: string;
  description: string;
  theme: string;
  config: Partial<AudioEngineState>;
  effects?: Partial<Record<InstrumentType, EffectType[]>>;
};

export const PRESETS: Preset[] = [{
  id: "cosmic-voyage",
  name: "Cosmic Voyage",
  description: "Drift through starfields and nebulae with ethereal pads and atmospheric textures",
  theme: "Space",
  config: {
    tempo: 65,
    key: Note.A,
    mode: Mode.Aeolian,
    volume: 0.7,
    instruments: new Set([InstrumentType.Pad, InstrumentType.Atmosphere, InstrumentType.Texture]),
  },
  effects: {
    [InstrumentType.Pad]: [EffectType.Reverb, EffectType.Chorus, EffectType.Delay],
    [InstrumentType.Atmosphere]: [EffectType.Reverb, EffectType.Filter],
    [InstrumentType.Texture]: [EffectType.Reverb, EffectType.Delay, EffectType.Filter],
  },
}, {
  id: "ancient-forest",
  name: "Ancient Forest",
  description: "Deep woodland ambience with organic textures and natural harmonies",
  theme: "Forest",
  config: {
    tempo: 72,
    key: Note.D,
    mode: Mode.Dorian,
    volume: 0.6,
    instruments: new Set([InstrumentType.Pad, InstrumentType.Atmosphere, InstrumentType.Bass]),
  },
  effects: {
    [InstrumentType.Pad]: [EffectType.Reverb, EffectType.Filter],
    [InstrumentType.Atmosphere]: [EffectType.Reverb, EffectType.Chorus],
    [InstrumentType.Bass]: [EffectType.Compressor, EffectType.Reverb],
  },
}, {
  id: "lucid-dreams",
  name: "Lucid Dreams",
  description: "Floating between consciousness and sleep with shimmering textures",
  theme: "Ethereal/Dreamy",
  config: {
    tempo: 58,
    key: Note.E,
    mode: Mode.Lydian,
    volume: 0.5,
    instruments: new Set([InstrumentType.Atmosphere, InstrumentType.Texture]),
  },
  effects: {
    [InstrumentType.Atmosphere]: [EffectType.Reverb, EffectType.Chorus, EffectType.Filter],
    [InstrumentType.Texture]: [EffectType.Reverb, EffectType.Delay, EffectType.Chorus],
  },
}, {
  id: "steel-cathedral",
  name: "Steel Cathedral",
  description: "Mechanical rhythms and metallic textures in vast industrial spaces",
  theme: "Industrial",
  config: {
    tempo: 85,
    key: Note.F,
    mode: Mode.Phrygian,
    volume: 0.8,
    instruments: new Set([InstrumentType.Bass, InstrumentType.Percussion, InstrumentType.Texture]),
  },
  effects: {
    [InstrumentType.Bass]: [EffectType.Compressor, EffectType.Distortion],
    [InstrumentType.Percussion]: [EffectType.Compressor, EffectType.Reverb],
    [InstrumentType.Texture]: [EffectType.Distortion, EffectType.Delay],
  },
}, {
  id: "gentle-current",
  name: "Gentle Current",
  description: "Flowing melodies and warm harmonies that ebb and flow like water",
  theme: "Melodic",
  config: {
    tempo: 78,
    key: Note.G,
    mode: Mode.Ionian,
    volume: 0.7,
    instruments: new Set([InstrumentType.Lead, InstrumentType.Pad, InstrumentType.Atmosphere]),
  },
  effects: {
    [InstrumentType.Lead]: [EffectType.Delay, EffectType.Reverb],
    [InstrumentType.Pad]: [EffectType.Reverb, EffectType.Chorus],
    [InstrumentType.Atmosphere]: [EffectType.Reverb, EffectType.Filter],
  },
}];

export const getPreset = (id: string): Optional<Preset> => PRESETS.find(preset => preset.id === id);

export const getPresetsByTheme = (theme: string): Preset[] => {
  return PRESETS.filter(preset => preset.theme.toLowerCase().includes(theme.toLowerCase()));
};

export const getThemes = (): string[] => [...new Set(PRESETS.map(preset => preset.theme))];
