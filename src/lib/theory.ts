import type { Optional } from "./types";

export enum Note {
  C = 0,
  CSharp = 1,
  D = 2,
  DSharp = 3,
  E = 4,
  F = 5,
  FSharp = 6,
  G = 7,
  GSharp = 8,
  A = 9,
  ASharp = 10,
  B = 11,
}

export enum Mode {
  /** Major */
  Ionian = "ionian",
  Dorian = "dorian",
  Phrygian = "phrygian",
  Lydian = "lydian",
  Mixolydian = "mixolydian",
  /**  Natural Minor */
  Aeolian = "aeolian",
  Locrian = "locrian",
}

export enum ChordType {
  Major = "major",
  Minor = "minor",
  Diminished = "diminished",
  Augmented = "augmented",
  Sus2 = "sus2",
  Sus4 = "sus4",
  Major7 = "major7",
  Minor7 = "minor7",
  Dominant7 = "dominant7",
}

const SCALE_PATTERNS = {
  [Mode.Ionian]: [2, 2, 1, 2, 2, 2, 1],
  [Mode.Dorian]: [2, 1, 2, 2, 2, 1, 2],
  [Mode.Phrygian]: [1, 2, 2, 2, 1, 2, 2],
  [Mode.Lydian]: [2, 2, 2, 1, 2, 2, 1],
  [Mode.Mixolydian]: [2, 2, 1, 2, 2, 1, 2],
  [Mode.Aeolian]: [2, 1, 2, 2, 1, 2, 2],
  [Mode.Locrian]: [1, 2, 2, 1, 2, 2, 2],
} as const;

const CHORD_PATTERNS = {
  [ChordType.Major]: [0, 4, 7],
  [ChordType.Minor]: [0, 3, 7],
  [ChordType.Diminished]: [0, 3, 6],
  [ChordType.Augmented]: [0, 4, 8],
  [ChordType.Sus2]: [0, 2, 7],
  [ChordType.Sus4]: [0, 5, 7],
  [ChordType.Major7]: [0, 4, 7, 11],
  [ChordType.Minor7]: [0, 3, 7, 10],
  [ChordType.Dominant7]: [0, 4, 7, 10],
} as const;

export const generateScale = (root: Note, mode: Mode): Note[] => {
  const pattern = SCALE_PATTERNS[mode];
  const scale: Note[] = [root];

  let currentNote = root;
  for (const interval of pattern.slice(0, -1)) {
    currentNote = (currentNote + interval) % 12;
    scale.push(currentNote);
  }

  return scale;
};

export const generateAllModes = (root: Note): Record<Mode, Note[]> => {
  const modes = {} as Record<Mode, Note[]>;
  for (const mode of Object.values(Mode)) {
    modes[mode] = generateScale(root, mode);
  }

  return modes;
};

export const generateChord = (root: Note, type: ChordType): Note[] => {
  const pattern = CHORD_PATTERNS[type];
  return pattern.map((interval) => (root + interval) % 12);
};

export const generateDiatonicChords = (scale: Note[]): Note[][] => {
  return scale.map((root, index) => {
    const third = scale[(index + 2) % 7];
    const fifth = scale[(index + 4) % 7];
    return [root, third, fifth];
  });
};

export const AMBIENT_PROGRESSIONS = {
  /** I - vi - IV - V */
  classic: [0, 5, 3, 4],
  /** vi - IV - I - V */
  emotional: [5, 3, 0, 4],
  /** I - V - vi - IV */
  pop: [0, 4, 5, 3],
  /** ii - V - I */
  jazz: [1, 4, 0],
  /** I - bVII - IV - I */
  modal: [0, 6, 3, 0],
} as const;

export const generateProgression = (scale: Note[], progression: number[]): Note[][] => {
  const diatonicChords = generateDiatonicChords(scale);
  return progression.map((degree) => diatonicChords[degree]);
};

export const NoteRelations = {
  interval: (note1: Note, note2: Note): number => (note2 - note1 + 12) % 12,
  relative: (root: Note, intervals: number[]): Note[] => intervals.map((interval) => (root + interval) % 12),

  isConsonant: (note1: Note, note2: Note): boolean => {
    const interval = NoteRelations.interval(note1, note2);
    return [0, 3, 4, 5, 7, 8, 9].includes(interval);
  },

  enharmonic: (note: Note, preferFlats = false): string => {
    const sharpNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const flatNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    return preferFlats ? flatNames[note] : sharpNames[note];
  },
};

export const HarmonicAnalysis = {
  analyzeKey: (notes: Note[]): { key: Note; mode: Mode; confidence: number } => {
    let bestMatch = { key: Note.C, mode: Mode.Ionian as Mode, confidence: 0 };

    for (const key of Object.values(Note)) {
      if (typeof key === "number") {
        for (const mode of Object.values(Mode)) {
          const scale = generateScale(key, mode);
          const matches = notes.filter((note) => scale.includes(note)).length;
          const confidence = matches / notes.length;

          if (confidence > bestMatch.confidence) {
            bestMatch = { key, mode, confidence };
          }
        }
      }
    }

    return bestMatch;
  },

  analyzeChordFunction: (chord: Note[], key: Note, mode: Mode): number => {
    const scale = generateScale(key, mode);
    const root = chord[0];
    return scale.indexOf(root);
  },

  analyzeTension: (progression: Note[][]): number[] =>
    progression.map((chord, index) => {
      if (index === 0) return 0;

      const previousChord = progression[index - 1];
      let tension = 0;

      for (const [voiceIndex, note] of chord.entries()) {
        if (previousChord[voiceIndex] !== undefined) {
          const interval = Math.abs(note - previousChord[voiceIndex]);
          tension += interval > 6 ? 12 - interval : interval;
        }
      }

      return tension / chord.length;
    }),
};

export const NoteUtilities = {
  toString: (note: Note): string => {
    switch (note) {
      case Note.C: {
        return "C";
      }
      case Note.CSharp: {
        return "C#";
      }
      case Note.D: {
        return "D";
      }
      case Note.DSharp: {
        return "D#";
      }
      case Note.E: {
        return "E";
      }
      case Note.F: {
        return "F";
      }
      case Note.FSharp: {
        return "F#";
      }
      case Note.G: {
        return "G";
      }
      case Note.GSharp: {
        return "G#";
      }
      case Note.A: {
        return "A";
      }
      case Note.ASharp: {
        return "A#";
      }
      case Note.B: {
        return "B";
      }
    }
  },

  fromString: (noteString: string): Optional<Note> => {
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
    return noteMap[noteString] ?? undefined;
  },

  fromMidi: (midiNote: number): Note => midiNote % 12,
  toMidi: (note: Note, octave: number = 4): number => note + octave * 12 + 12,
};

export const ModeUtilities = {
  toString(mode: Mode): string {
    switch (mode) {
      case Mode.Ionian: {
        return "Ionian (Major)";
      }
      case Mode.Dorian: {
        return "Dorian (Minor ♮6)";
      }
      case Mode.Phrygian: {
        return "Phrygian (Minor ♭2)";
      }
      case Mode.Lydian: {
        return "Lydian (Major ♯4)";
      }
      case Mode.Mixolydian: {
        return "Mixolydian (Major ♭7)";
      }
      case Mode.Aeolian: {
        return "Aeolian (Minor)";
      }
      case Mode.Locrian: {
        return "Locrian (Minor ♭2 ♭5)";
      }
      default: {
        return "Unknown mode";
      }
    }
  },
};

export const ChordAnalysis = {
  analyzeChord: (notes: Note[]): { root: Note; type?: ChordType; name: string } => {
    if (notes.length === 0) {
      return { root: Note.C, name: "..." };
    }

    const uniqueNotes = [...new Set(notes)].toSorted((a, b) => a - b);
    const root = uniqueNotes[0];
    const intervals = uniqueNotes.map(note => (note - root + 12) % 12).toSorted((a, b) => a - b);

    for (const [chordType, pattern] of Object.entries(CHORD_PATTERNS)) {
      const normalizedPattern = [...pattern].toSorted((a, b) => a - b);
      if (
        intervals.length === normalizedPattern.length
        && intervals.every((interval, index) => interval === normalizedPattern[index])
      ) {
        return {
          root,
          type: chordType as ChordType,
          name: `${NoteUtilities.toString(root)}${ChordAnalysis.getChordSuffix(chordType as ChordType)}`,
        };
      }
    }

    return { root, name: `${NoteUtilities.toString(root)} chord` };
  },

  getChordSuffix: (type: ChordType): string => {
    switch (type) {
      case ChordType.Major: {
        return "";
      }
      case ChordType.Minor: {
        return "m";
      }
      case ChordType.Diminished: {
        return "°";
      }
      case ChordType.Augmented: {
        return "+";
      }
      case ChordType.Sus2: {
        return "sus2";
      }
      case ChordType.Sus4: {
        return "sus4";
      }
      case ChordType.Major7: {
        return "maj7";
      }
      case ChordType.Minor7: {
        return "m7";
      }
      case ChordType.Dominant7: {
        return "7";
      }
      default: {
        return "";
      }
    }
  },
};
