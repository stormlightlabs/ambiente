import type { Note } from "$lib/theory";
import type { InstrumentType } from "$lib/types/instruments";
import { eventID, type InstrumentActivity, type PlaybackEvent, type PlaybackState } from "$lib/types/playback";
import type { Optional } from "$lib/types/shared";
import { SvelteMap } from "svelte/reactivity";

const MAX_RECENT_EVENTS = 50;
const MAX_INSTRUMENT_EVENTS = 20;

class PlaybackStore {
  private _isTracking = $state<boolean>(false);
  private _currentChord = $state<Note[]>([]);
  private _currentChordIndex = $state<number>(-1);
  private _activeInstruments = new SvelteMap<InstrumentType, InstrumentActivity>();
  private _recentEvents = $state<PlaybackEvent[]>([]);
  private _currentPreset = $state<string>();
  private _startTime = $state<number>();

  get state(): PlaybackState {
    return {
      isTracking: this._isTracking,
      currentChord: this._currentChord,
      currentChordIndex: this._currentChordIndex,
      activeInstruments: this._activeInstruments,
      recentEvents: this._recentEvents,
      currentPreset: this._currentPreset,
      startTime: this._startTime,
    };
  }

  get isTracking(): boolean {
    return this._isTracking;
  }

  get currentChord(): Note[] {
    return this._currentChord;
  }

  get currentChordIndex(): number {
    return this._currentChordIndex;
  }

  get activeInstruments(): Map<InstrumentType, InstrumentActivity> {
    return this._activeInstruments;
  }

  get recentEvents(): PlaybackEvent[] {
    return this._recentEvents;
  }

  get currentPreset(): Optional<string> {
    return this._currentPreset;
  }

  get startTime(): Optional<number> {
    return this._startTime;
  }

  get activeInstrumentsList(): InstrumentActivity[] {
    return [...this._activeInstruments.values()];
  }

  get currentlyPlayingNotes(): Note[] {
    const allNotes: Note[] = [];
    for (const activity of this._activeInstruments.values()) {
      if (activity.isActive) {
        allNotes.push(...activity.currentNotes);
      }
    }
    return [...new Set(allNotes)];
  }

  startTracking(presetName?: string): void {
    this._isTracking = true;
    this._startTime = Date.now();
    this._currentPreset = presetName;
    this.clear();
  }

  stopTracking(): void {
    this._isTracking = false;
    this._startTime = undefined;

    for (const activity of this._activeInstruments.values()) {
      activity.isActive = false;
      activity.currentNotes = [];
    }
  }

  setPreset(presetName: string): void {
    this._currentPreset = presetName;
  }

  updateChord(chord: Note[], chordIndex: number): void {
    if (!this._isTracking) return;

    this._currentChord = [...chord];
    this._currentChordIndex = chordIndex;

    this.addEvent({ ...eventID("chord"), type: "chord", notes: chord, chordIndex, presetName: this._currentPreset });
  }

  updateInstrumentNotes(instrumentType: InstrumentType, notes: Note[], velocity?: number, duration?: string): void {
    if (!this._isTracking) return;

    let activity = this._activeInstruments.get(instrumentType);
    if (!activity) {
      activity = { type: instrumentType, isActive: false, currentNotes: [], lastActivity: 0, recentEvents: [] };
      this._activeInstruments.set(instrumentType, activity);
    }

    activity.isActive = notes.length > 0;
    activity.currentNotes = [...notes];
    activity.lastActivity = Date.now();

    if (notes.length > 0) {
      const event = {
        ...eventID("note", instrumentType),
        instrumentType,
        notes: [...notes],
        velocity,
        duration,
        presetName: this._currentPreset,
      };

      this.addEvent(event);

      activity.recentEvents.push(event);
      if (activity.recentEvents.length > MAX_INSTRUMENT_EVENTS) {
        activity.recentEvents.shift();
      }
    }
  }

  updateInstrumentActivity(instrumentType: InstrumentType, isActive: boolean): void {
    if (!this._isTracking) return;

    let activity = this._activeInstruments.get(instrumentType);
    if (!activity) {
      activity = { type: instrumentType, isActive: false, currentNotes: [], lastActivity: 0, recentEvents: [] };
      this._activeInstruments.set(instrumentType, activity);
    }

    activity.isActive = isActive;
    activity.lastActivity = Date.now();

    this.addEvent({ ...eventID("instrument-toggle", instrumentType), instrumentType, presetName: this._currentPreset });
  }

  instrumentTick(instrumentType: InstrumentType): void {
    if (!this._isTracking) return;

    let activity = this._activeInstruments.get(instrumentType);
    if (!activity) {
      activity = { type: instrumentType, isActive: true, currentNotes: [], lastActivity: 0, recentEvents: [] };
      this._activeInstruments.set(instrumentType, activity);
    }

    activity.lastActivity = Date.now();
    activity.isActive = true;

    const event = { ...eventID("instrument-tick", instrumentType), instrumentType, presetName: this._currentPreset };

    this.addEvent(event);

    activity.recentEvents.push(event);
    if (activity.recentEvents.length > MAX_INSTRUMENT_EVENTS) {
      activity.recentEvents.shift();
    }
  }

  private addEvent(event: PlaybackEvent): void {
    this._recentEvents.push(event);
    if (this._recentEvents.length > MAX_RECENT_EVENTS) {
      this._recentEvents.shift();
    }
  }

  clear(): void {
    this._currentChord = [];
    this._currentChordIndex = -1;
    this._activeInstruments.clear();
    this._recentEvents = [];
  }

  getInstrumentActivity(kind: InstrumentType): Optional<InstrumentActivity> {
    return this._activeInstruments.get(kind);
  }

  getRecentEventsForInstrument(kind: InstrumentType): PlaybackEvent[] {
    return this.getInstrumentActivity(kind)?.recentEvents || [];
  }
}

export const playbackStore = new PlaybackStore();
