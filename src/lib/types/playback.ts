import type { Note } from "$lib/theory";
import type { SvelteMap } from "svelte/reactivity";
import type { InstrumentType } from "./instruments";

type EventKind = "note" | "chord" | "instrument-toggle" | "instrument-tick";

export type PlaybackEvent = {
  id: string;
  type: EventKind;
  timestamp: number;
  instrumentType?: InstrumentType;
  notes?: Note[];
  velocity?: number;
  duration?: string;
  presetName?: string;
  chordIndex?: number;
};

export function eventID(event: EventKind, kind?: InstrumentType) {
  const now = Date.now();
  switch (event) {
    case "note": {
      return { id: `note${"-" + (kind ?? "")}-${now}`, timestamp: now, type: event };
    }
    case "chord": {
      return { id: `chord-${now}`, timestamp: now, type: event };
    }
    case "instrument-toggle": {
      return { id: `instrument-toggle${"-" + (kind ?? "")}-${now}`, timestamp: now, type: event };
    }
    case "instrument-tick": {
      return { id: `instrument-tick${"-" + (kind ?? "")}-${now}`, timestamp: now, type: event };
    }
  }
}

export type InstrumentActivity = {
  type: InstrumentType;
  isActive: boolean;
  currentNotes: Note[];
  lastActivity: number;
  recentEvents: PlaybackEvent[];
};

export type PlaybackState = {
  isTracking: boolean;
  currentChord: Note[];
  currentChordIndex: number;
  activeInstruments: SvelteMap<InstrumentType, InstrumentActivity>;
  recentEvents: PlaybackEvent[];
  currentPreset?: string;
  startTime?: number;
};
