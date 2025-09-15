import {
  AMBIENT_PROGRESSIONS,
  ChordType,
  generateAllModes,
  generateChord,
  generateDiatonicChords,
  generateProgression,
  generateScale,
  HarmonicAnalysis,
  Mode,
  Note,
  NoteRelations,
  NoteUtilities,
} from "$lib/theory";
import { describe, expect, it } from "vitest";

describe("Note System", () => {
  it("should have 12 chromatic notes", () => {
    const noteValues = Object.values(Note).filter(n => typeof n === "number");
    expect(noteValues).toHaveLength(12);
    expect(noteValues).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("should convert notes to strings correctly", () => {
    expect(NoteUtilities.toString(Note.C)).toBe("C");
    expect(NoteUtilities.toString(Note.CSharp)).toBe("C#");
    expect(NoteUtilities.toString(Note.FSharp)).toBe("F#");
    expect(NoteUtilities.toString(Note.B)).toBe("B");
  });

  it("should convert strings to notes correctly", () => {
    expect(NoteUtilities.fromString("C")).toBe(Note.C);
    expect(NoteUtilities.fromString("C#")).toBe(Note.CSharp);
    expect(NoteUtilities.fromString("Db")).toBe(Note.CSharp);
    expect(NoteUtilities.fromString("F#")).toBe(Note.FSharp);
    expect(NoteUtilities.fromString("Gb")).toBe(Note.FSharp);
    expect(NoteUtilities.fromString("Invalid")).toBeNull();
  });

  it("should handle MIDI conversions correctly", () => {
    expect(NoteUtilities.fromMidi(60)).toBe(Note.C);
    expect(NoteUtilities.fromMidi(61)).toBe(Note.CSharp);
    expect(NoteUtilities.fromMidi(72)).toBe(Note.C);

    expect(NoteUtilities.toMidi(Note.C, 4)).toBe(60);
    expect(NoteUtilities.toMidi(Note.CSharp, 4)).toBe(61);
    expect(NoteUtilities.toMidi(Note.C, 5)).toBe(72);
  });
});

describe("Scale Generation", () => {
  it("should generate C major scale correctly", () => {
    const cMajor = generateScale(Note.C, Mode.Ionian);
    expect(cMajor).toEqual([Note.C, Note.D, Note.E, Note.F, Note.G, Note.A, Note.B]);
  });

  it("should generate A natural minor scale correctly", () => {
    const aMinor = generateScale(Note.A, Mode.Aeolian);
    expect(aMinor).toEqual([Note.A, Note.B, Note.C, Note.D, Note.E, Note.F, Note.G]);
  });

  it("should generate D Dorian scale correctly", () => {
    const dDorian = generateScale(Note.D, Mode.Dorian);
    expect(dDorian).toEqual([Note.D, Note.E, Note.F, Note.G, Note.A, Note.B, Note.C]);
  });

  it("should generate F Lydian scale correctly", () => {
    const fLydian = generateScale(Note.F, Mode.Lydian);
    expect(fLydian).toEqual([Note.F, Note.G, Note.A, Note.B, Note.C, Note.D, Note.E]);
  });

  it("should generate all modes from a root note", () => {
    const allModes = generateAllModes(Note.C);
    expect(Object.keys(allModes)).toHaveLength(7);
    expect(allModes[Mode.Ionian]).toEqual([Note.C, Note.D, Note.E, Note.F, Note.G, Note.A, Note.B]);
    expect(allModes[Mode.Aeolian]).toEqual([Note.C, Note.D, Note.DSharp, Note.F, Note.G, Note.GSharp, Note.ASharp]);
  });
});

describe("Chord Generation", () => {
  it("should generate major chord correctly", () => {
    const cMajor = generateChord(Note.C, ChordType.Major);
    expect(cMajor).toEqual([Note.C, Note.E, Note.G]);
  });

  it("should generate minor chord correctly", () => {
    const aMinor = generateChord(Note.A, ChordType.Minor);
    expect(aMinor).toEqual([Note.A, Note.C, Note.E]);
  });

  it("should generate seventh chords correctly", () => {
    const cMaj7 = generateChord(Note.C, ChordType.Major7);
    expect(cMaj7).toEqual([Note.C, Note.E, Note.G, Note.B]);

    const cMin7 = generateChord(Note.C, ChordType.Minor7);
    expect(cMin7).toEqual([Note.C, Note.DSharp, Note.G, Note.ASharp]);

    const c7 = generateChord(Note.C, ChordType.Dominant7);
    expect(c7).toEqual([Note.C, Note.E, Note.G, Note.ASharp]);
  });

  it("should generate suspended chords correctly", () => {
    const cSus2 = generateChord(Note.C, ChordType.Sus2);
    expect(cSus2).toEqual([Note.C, Note.D, Note.G]);

    const cSus4 = generateChord(Note.C, ChordType.Sus4);
    expect(cSus4).toEqual([Note.C, Note.F, Note.G]);
  });

  it("should generate diatonic chords from scale", () => {
    const cMajorScale = generateScale(Note.C, Mode.Ionian);
    const diatonicChords = generateDiatonicChords(cMajorScale);

    expect(diatonicChords).toHaveLength(7);
    expect(diatonicChords[0]).toEqual([Note.C, Note.E, Note.G]);
    expect(diatonicChords[1]).toEqual([Note.D, Note.F, Note.A]);
    expect(diatonicChords[2]).toEqual([Note.E, Note.G, Note.B]);
    expect(diatonicChords[3]).toEqual([Note.F, Note.A, Note.C]);
    expect(diatonicChords[4]).toEqual([Note.G, Note.B, Note.D]);
    expect(diatonicChords[5]).toEqual([Note.A, Note.C, Note.E]);
    expect(diatonicChords[6]).toEqual([Note.B, Note.D, Note.F]);
  });
});

describe("Chord Progressions", () => {
  it("should generate classic progression (I-vi-IV-V)", () => {
    const cMajorScale = generateScale(Note.C, Mode.Ionian);
    const progression = generateProgression(cMajorScale, [...AMBIENT_PROGRESSIONS.classic]);

    expect(progression).toHaveLength(4);
    expect(progression[0]).toEqual([Note.C, Note.E, Note.G]);
    expect(progression[1]).toEqual([Note.A, Note.C, Note.E]);
    expect(progression[2]).toEqual([Note.F, Note.A, Note.C]);
    expect(progression[3]).toEqual([Note.G, Note.B, Note.D]);
  });

  it("should generate emotional progression (vi-IV-I-V)", () => {
    const cMajorScale = generateScale(Note.C, Mode.Ionian);
    const progression = generateProgression(cMajorScale, [...AMBIENT_PROGRESSIONS.emotional]);

    expect(progression).toHaveLength(4);
    expect(progression[0]).toEqual([Note.A, Note.C, Note.E]);
    expect(progression[1]).toEqual([Note.F, Note.A, Note.C]);
    expect(progression[2]).toEqual([Note.C, Note.E, Note.G]);
    expect(progression[3]).toEqual([Note.G, Note.B, Note.D]);
  });

  it("should generate jazz progression (ii-V-I)", () => {
    const cMajorScale = generateScale(Note.C, Mode.Ionian);
    const progression = generateProgression(cMajorScale, [...AMBIENT_PROGRESSIONS.jazz]);

    expect(progression).toHaveLength(3);
    expect(progression[0]).toEqual([Note.D, Note.F, Note.A]);
    expect(progression[1]).toEqual([Note.G, Note.B, Note.D]);
    expect(progression[2]).toEqual([Note.C, Note.E, Note.G]);
  });
});

describe("Note Relations", () => {
  it("should calculate intervals correctly", () => {
    expect(NoteRelations.interval(Note.C, Note.C)).toBe(0);
    expect(NoteRelations.interval(Note.C, Note.E)).toBe(4);
    expect(NoteRelations.interval(Note.C, Note.G)).toBe(7);
    expect(NoteRelations.interval(Note.C, Note.B)).toBe(11);
    expect(NoteRelations.interval(Note.G, Note.C)).toBe(5);
  });

  it("should find relative notes at given intervals", () => {
    const relatives = NoteRelations.relative(Note.C, [4, 7]); // Major third and fifth
    expect(relatives).toEqual([Note.E, Note.G]);

    const relatives2 = NoteRelations.relative(Note.F, [3, 7]); // Minor third and fifth
    expect(relatives2).toEqual([Note.GSharp, Note.C]);
  });

  it("should identify consonant intervals correctly", () => {
    expect(NoteRelations.isConsonant(Note.C, Note.C)).toBe(true);
    expect(NoteRelations.isConsonant(Note.C, Note.E)).toBe(true);
    expect(NoteRelations.isConsonant(Note.C, Note.F)).toBe(true);
    expect(NoteRelations.isConsonant(Note.C, Note.G)).toBe(true);
    expect(NoteRelations.isConsonant(Note.C, Note.A)).toBe(true);

    expect(NoteRelations.isConsonant(Note.C, Note.CSharp)).toBe(false);
    expect(NoteRelations.isConsonant(Note.C, Note.D)).toBe(false);
    expect(NoteRelations.isConsonant(Note.C, Note.FSharp)).toBe(false);
    expect(NoteRelations.isConsonant(Note.C, Note.ASharp)).toBe(false);
  });

  it("should handle enharmonic equivalents correctly", () => {
    expect(NoteRelations.enharmonic(Note.CSharp, false)).toBe("C#");
    expect(NoteRelations.enharmonic(Note.CSharp, true)).toBe("Db");
    expect(NoteRelations.enharmonic(Note.FSharp, false)).toBe("F#");
    expect(NoteRelations.enharmonic(Note.FSharp, true)).toBe("Gb");
    expect(NoteRelations.enharmonic(Note.C, false)).toBe("C");
    expect(NoteRelations.enharmonic(Note.C, true)).toBe("C");
  });
});

describe("Harmonic Analysis", () => {
  it("should analyze key correctly from note collection", () => {
    const cMajorNotes = [Note.C, Note.D, Note.E, Note.F, Note.G, Note.A, Note.B];
    const result = HarmonicAnalysis.analyzeKey(cMajorNotes);

    expect(result.key).toBe(Note.C);
    expect(result.mode).toBe(Mode.Ionian);
    expect(result.confidence).toBe(1);
  });

  it("should analyze key with partial note collection", () => {
    const partialNotes = [Note.C, Note.E, Note.G, Note.A];
    const result = HarmonicAnalysis.analyzeKey(partialNotes);

    expect(result.key).toBe(Note.C);
    expect(result.mode).toBe(Mode.Ionian);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("should analyze chord function within key", () => {
    const cMajorChord = [Note.C, Note.E, Note.G];
    const dMinorChord = [Note.D, Note.F, Note.A];
    const fMajorChord = [Note.F, Note.A, Note.C];
    const gMajorChord = [Note.G, Note.B, Note.D];
    const aMinorChord = [Note.A, Note.C, Note.E];

    expect(HarmonicAnalysis.analyzeChordFunction(cMajorChord, Note.C, Mode.Ionian)).toBe(0);
    expect(HarmonicAnalysis.analyzeChordFunction(dMinorChord, Note.C, Mode.Ionian)).toBe(1);
    expect(HarmonicAnalysis.analyzeChordFunction(fMajorChord, Note.C, Mode.Ionian)).toBe(3);
    expect(HarmonicAnalysis.analyzeChordFunction(gMajorChord, Note.C, Mode.Ionian)).toBe(4);
    expect(HarmonicAnalysis.analyzeChordFunction(aMinorChord, Note.C, Mode.Ionian)).toBe(5);
  });

  it("should analyze tension in chord progressions", () => {
    const progression = [[Note.C, Note.E, Note.G], [Note.F, Note.A, Note.C], [Note.G, Note.B, Note.D], [
      Note.C,
      Note.E,
      Note.G,
    ]];

    const tensions = HarmonicAnalysis.analyzeTension(progression);
    expect(tensions[0]).toBe(0);
    expect(tensions[1]).toBeGreaterThan(0);
    expect(tensions[2]).toBeGreaterThan(0);
    expect(tensions[3]).toBeGreaterThan(0);
  });
});

describe("Edge Cases and Integration", () => {
  it("should handle octave wrapping in scales", () => {
    const bMajorScale = generateScale(Note.B, Mode.Ionian);
    expect(bMajorScale).toHaveLength(7);
    expect(bMajorScale[0]).toBe(Note.B);
    expect(bMajorScale).toContain(Note.CSharp);
    expect(bMajorScale).toEqual([Note.B, Note.CSharp, Note.DSharp, Note.E, Note.FSharp, Note.GSharp, Note.ASharp]);
  });

  it("should handle octave wrapping in chords", () => {
    const bMajorChord = generateChord(Note.B, ChordType.Major);
    expect(bMajorChord[0]).toBe(Note.B);
    expect(bMajorChord).toContain(Note.DSharp);
    expect(bMajorChord).toContain(Note.FSharp);
  });

  it("should maintain functional programming principles", () => {
    const originalScale = generateScale(Note.C, Mode.Ionian);
    const chords1 = generateDiatonicChords(originalScale);
    const chords2 = generateDiatonicChords(originalScale);

    expect(chords1).not.toBe(chords2);
    expect(chords1).toEqual(chords2);

    const newScale = generateScale(Note.C, Mode.Ionian);
    expect(originalScale).toEqual(newScale);
  });

  it("should handle empty and invalid inputs gracefully", () => {
    const emptyAnalysis = HarmonicAnalysis.analyzeKey([]);
    expect(emptyAnalysis.confidence).toBe(0);

    const emptyTension = HarmonicAnalysis.analyzeTension([]);
    expect(emptyTension).toEqual([]);

    const singleChordTension = HarmonicAnalysis.analyzeTension([[Note.C, Note.E, Note.G]]);
    expect(singleChordTension).toEqual([0]);
  });
});
