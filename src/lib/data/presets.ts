import { Note, NoteUtilities } from "$lib/theory";
import { InstrumentType } from "$lib/types/instruments";
import { type Preset, TextureType } from "$lib/types/presets";
import type { Optional } from "$lib/types/shared";
import { INSPIRED } from "./artist-inspired-presets";
import { THEMED } from "./themed";

export const PRESETS: Preset[] = [...INSPIRED, ...THEMED];

export const AMBIENT_TO_ENGINE_MAPPING: Record<TextureType, InstrumentType> = {
  [TextureType.AmbientPad]: InstrumentType.AmbientPad,
  [TextureType.Granular]: InstrumentType.Granular,
  [TextureType.Melodic]: InstrumentType.Melodic,
  [TextureType.HarmonicDrone]: InstrumentType.HarmonicDrone,
  [TextureType.RhythmicPulse]: InstrumentType.RhythmicPulse,
  [TextureType.FieldRecording]: InstrumentType.FieldRecording,
  [TextureType.VocalPad]: InstrumentType.VocalPad,
  [TextureType.Arpeggiator]: InstrumentType.Arpeggiator,
};

export const scaleToNotes = (names: string[]): Note[] => names.map(name => NoteUtilities.Map[name] ?? Note.C);

export const getPreset = (id: string): Optional<Preset> => PRESETS.find(preset => preset.id === id);

export const getPresetsByTheme = (theme: string): Preset[] =>
  PRESETS.filter(preset => preset.theme.toLowerCase().includes(theme.toLowerCase()));

export const getThemes = (): string[] => ["All", ...new Set(PRESETS.map(preset => preset.theme))];
