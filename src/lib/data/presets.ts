import { Note } from "$lib/theory";
import { InstrumentType } from "$lib/types/instruments";
import { type Preset, TextureType } from "$lib/types/presets";
import type { Optional } from "$lib/types/shared";
import { SvelteSet } from "svelte/reactivity";
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

export function scaleToNotes(scaleNames: string[]): Note[] {
  const noteMap: Record<string, Note> = {
    C: Note.C,
    "C#": Note.CSharp,
    Db: Note.CSharp,
    D: Note.D,
    "D#": Note.DSharp,
    Eb: Note.DSharp,
    E: Note.E,
    F: Note.F,
    "F#": Note.FSharp,
    Gb: Note.FSharp,
    G: Note.G,
    "G#": Note.GSharp,
    Ab: Note.GSharp,
    A: Note.A,
    "A#": Note.ASharp,
    Bb: Note.ASharp,
    B: Note.B,
  };

  return scaleNames.map(name => noteMap[name] ?? Note.C);
}

export const getPreset = (id: string): Optional<Preset> => PRESETS.find(preset => preset.id === id);

export const getPresetsByTheme = (theme: string): Preset[] =>
  PRESETS.filter(preset => preset.theme.toLowerCase().includes(theme.toLowerCase()));

export const getThemes = (): string[] => ["All", ...new SvelteSet(PRESETS.map(preset => preset.theme))];
