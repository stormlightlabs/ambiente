import { AudioEngine, createAmbientAudioEngine, createDefaultPattern } from "$lib/audio-engine";
import { Mode, Note } from "$lib/theory";
import type { AudioEngineState, InstrumentPattern } from "$lib/types/audio";
import { InstrumentType } from "$lib/types/instruments";
import { SvelteSet } from "svelte/reactivity";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockTransport = { start: vi.fn(), pause: vi.fn(), stop: vi.fn(), dispose: vi.fn() };

vi.mock(
  "tone",
  () => ({
    start: vi.fn(),
    getContext: vi.fn(() => ({ state: "suspended" })),
    PolySynth: vi.fn(),
    Synth: vi.fn(),
    Gain: vi.fn(() => ({ toDestination: vi.fn(), gain: { value: 0 }, dispose: vi.fn(), connect: vi.fn() })),
    Filter: vi.fn(() => ({ frequency: { value: 0 }, Q: { value: 0 }, dispose: vi.fn(), connect: vi.fn() })),
    Frequency: vi.fn(() => ({ toFrequency: vi.fn(() => 440) })),
    getTransport: vi.fn(() => mockTransport),
    now: vi.fn(() => 0),
  }),
);

vi.mock(
  "../audio",
  () => ({
    initializeAudio: vi.fn(),
    createSynth: vi.fn(() => ({
      dispose: vi.fn(),
      triggerAttackRelease: vi.fn(),
      get: vi.fn(() => ({})),
      releaseAll: vi.fn(),
    })),
    InstrumentType: {
      Pad: "pad",
      Lead: "lead",
      Bass: "bass",
      Percussion: "percussion",
      Atmosphere: "atmosphere",
      Texture: "texture",
      AmbientPad: "ambientPad",
      Granular: "granular",
      Melodic: "melodic",
      HarmonicDrone: "harmonicDrone",
      RhythmicPulse: "rhythmicPulse",
    },
    EffectType: {
      Reverb: "reverb",
      Delay: "delay",
      Chorus: "chorus",
      Filter: "filter",
      Distortion: "distortion",
      Compressor: "compressor",
    },
    ambientMixer: {
      connectSynth: vi.fn(),
      setMasterVolume: vi.fn(),
      dispose: vi.fn(),
      getChannel: vi.fn(() => ({ connect: vi.fn(), volume: { value: 0 }, dispose: vi.fn() })),
      setGlobalReverb: vi.fn(),
      setGlobalDelay: vi.fn(),
      setGlobalFilter: vi.fn(),
      setGlobalChorus: vi.fn(),
    },
    noteToToneString: vi.fn((note: Note, octave = 4) => {
      const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      return `${noteNames[note]}${octave}`;
    }),
    ParameterAutomation: { automateParameter: vi.fn() },
  }),
);

vi.mock(
  "$lib/theory",
  () => ({
    Note: { C: 0, CSharp: 1, D: 2, DSharp: 3, E: 4, F: 5, FSharp: 6, G: 7, GSharp: 8, A: 9, ASharp: 10, B: 11 },
    Mode: {
      Ionian: "ionian",
      Dorian: "dorian",
      Phrygian: "phrygian",
      Lydian: "lydian",
      Mixolydian: "mixolydian",
      Aeolian: "aeolian",
      Locrian: "locrian",
    },
    generateScale: vi.fn(() => [0, 2, 4, 5, 7, 9, 11]),
    generateProgression: vi.fn(() => [[0, 4, 7], [5, 9, 0], [7, 11, 2]]),
    AMBIENT_PROGRESSIONS: { emotional: [0, 5, 6, 4] },
    NoteUtilities: {
      toString: vi.fn((note: number) => ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][note]),
    },
  }),
);

vi.mock(
  "../instruments",
  () => ({
    GranularSynth: vi.fn(() => ({ setScale: vi.fn(), updateParams: vi.fn(), connect: vi.fn(), dispose: vi.fn() })),
    AmbientPadSynth: vi.fn(() => ({ setChord: vi.fn(), updateParams: vi.fn(), connect: vi.fn(), dispose: vi.fn() })),
    MelodicSynth: vi.fn(() => ({ setScale: vi.fn(), updateParams: vi.fn(), connect: vi.fn(), dispose: vi.fn() })),
    HarmonicDroneSynth: vi.fn(() => ({ setChord: vi.fn(), updateParams: vi.fn(), connect: vi.fn(), dispose: vi.fn() })),
    RhythmicPulseSynth: vi.fn(() => ({ setScale: vi.fn(), updateParams: vi.fn(), connect: vi.fn(), dispose: vi.fn() })),
  }),
);

describe("AudioEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should initialize with default state", () => {
      const engine = new AudioEngine();
      const state = engine.getState$();

      state.subscribe(currentState => {
        expect(currentState).toEqual({
          isPlaying: false,
          tempo: 80,
          key: Note.C,
          mode: Mode.Ionian,
          currentChord: 0,
          volume: 0.7,
          instruments: new Set([InstrumentType.Pad, InstrumentType.Atmosphere]),
        });
      });
    });

    it("should merge initial state with defaults", () => {
      const initialState = { tempo: 120, key: Note.G, instruments: new SvelteSet([InstrumentType.Lead]) };

      const engine = new AudioEngine(initialState);
      const state = engine.getState$();

      state.subscribe(currentState => {
        expect(currentState.tempo).toBe(120);
        expect(currentState.key).toBe(Note.G);
        expect(currentState.instruments).toEqual(new Set([InstrumentType.Lead]));
        expect(currentState.volume).toBe(0.7);
      });
    });
  });

  describe("playback control", () => {
    it("should toggle playback state", async () => {
      const engine = new AudioEngine();
      const states: AudioEngineState[] = [];

      engine.getState$().subscribe(state => states.push(state));
      expect(states[0].isPlaying).toBe(false);

      await engine.togglePlayback();
      expect(states[1].isPlaying).toBe(true);

      await engine.togglePlayback();
      expect(states[2].isPlaying).toBe(false);
    });

    it("should emit play/pause events", async () => {
      const engine = new AudioEngine();
      const events: any[] = [];

      engine.getEvents$().subscribe(event => events.push(event));

      await engine.togglePlayback();
      expect(events[0]).toEqual({ type: "play", timestamp: 0 });

      await engine.togglePlayback();
      expect(events[1]).toEqual({ type: "stop", timestamp: 0 });
    });

    it("should stop playback and emit stop event", () => {
      const engine = new AudioEngine({ isPlaying: true });
      const events: any[] = [];
      const states: AudioEngineState[] = [];

      engine.getEvents$().subscribe(event => events.push(event));
      engine.getState$().subscribe(state => states.push(state));

      engine.stop();

      expect(states[1].isPlaying).toBe(false);
      expect(events[0]).toEqual({ type: "stop", timestamp: 0 });
      expect(mockTransport.stop).toHaveBeenCalled();
    });
  });

  describe("parameter control", () => {
    it("should set tempo within valid range", () => {
      const engine = new AudioEngine();
      const states: AudioEngineState[] = [];

      engine.getState$().subscribe(state => states.push(state));

      engine.setTempo(120);
      expect(states[1].tempo).toBe(120);

      engine.setTempo(300);
      expect(states[2].tempo).toBe(200);

      engine.setTempo(20);
      expect(states[3].tempo).toBe(40);
    });

    it("should set key and mode", () => {
      const engine = new AudioEngine();
      const states: AudioEngineState[] = [];

      engine.getState$().subscribe(state => states.push(state));

      engine.setKeyAndMode(Note.FSharp, Mode.Dorian);

      expect(states[1].key).toBe(Note.FSharp);
      expect(states[1].mode).toBe(Mode.Dorian);
      expect(states[1].currentChord).toBe(0);
    });

    it("should set volume within valid range", () => {
      const engine = new AudioEngine();
      const states: AudioEngineState[] = [];

      engine.getState$().subscribe(state => states.push(state));

      engine.setVolume(0.5);
      expect(states[1].volume).toBe(0.5);

      engine.setVolume(2);
      expect(states[2].volume).toBe(1);

      engine.setVolume(-1);
      expect(states[3].volume).toBe(0);
    });
  });

  describe("instrument management", () => {
    it("should toggle instruments", () => {
      const engine = new AudioEngine();
      const states: AudioEngineState[] = [];
      const events: any[] = [];

      engine.getState$().subscribe(state => states.push(state));
      engine.getEvents$().subscribe(event => events.push(event));

      engine.toggleInstrument(InstrumentType.Pad);
      expect(states[1].instruments.has(InstrumentType.Pad)).toBe(false);
      expect(events[0]).toEqual({
        type: "instrument-toggle",
        timestamp: 0,
        data: { instrument: InstrumentType.Pad, enabled: false },
      });

      engine.toggleInstrument(InstrumentType.Lead);
      expect(states[2].instruments.has(InstrumentType.Lead)).toBe(true);
      expect(events[1]).toEqual({
        type: "instrument-toggle",
        timestamp: 0,
        data: { instrument: InstrumentType.Lead, enabled: true },
      });
    });

    it("should get synth instance", () => {
      const engine = new AudioEngine({ instruments: new SvelteSet([InstrumentType.Pad]) });

      const synth = engine.getSynth(InstrumentType.Pad);
      expect(synth).toBeDefined();

      const nonExistentSynth = engine.getSynth(InstrumentType.Lead);
      expect(nonExistentSynth).toBeUndefined();
    });
  });

  describe("pattern management", () => {
    it("should set instrument pattern", () => {
      const engine = new AudioEngine();
      const pattern: InstrumentPattern = {
        type: InstrumentType.Pad,
        steps: [{ note: Note.C, velocity: 0.5, duration: "1m", enabled: true }, {
          note: Note.E,
          velocity: 0.3,
          duration: "1m",
          enabled: false,
        }],
        length: 2,
        enabled: true,
      };

      engine.setInstrumentPattern(InstrumentType.Pad, pattern);

      expect(() => engine.setInstrumentPattern(InstrumentType.Pad, pattern)).not.toThrow();
    });
  });

  describe("parameter automation", () => {
    it("should automate synth parameters", async () => {
      const mockSynth = { get: vi.fn().mockReturnValue({ envelope: { attack: { value: 0.1 } } }), dispose: vi.fn() };
      const engine = new AudioEngine({ instruments: new SvelteSet([InstrumentType.Pad]) });

      const { createSynth } = await import("$lib/audio");
      vi.mocked(createSynth).mockReturnValue(mockSynth as any);

      engine.toggleInstrument(InstrumentType.Lead);
      engine.toggleInstrument(InstrumentType.Lead);
      engine.toggleInstrument(InstrumentType.Pad);

      engine.automateParameter(InstrumentType.Pad, "envelope.attack", 0.5, "2m");

      expect(() => engine.automateParameter(InstrumentType.Pad, "envelope.attack", 0.5)).not.toThrow();
    });

    it("should handle missing synth gracefully", () => {
      const engine = new AudioEngine();

      expect(() => {
        engine.automateParameter(InstrumentType.Lead, "envelope.attack", 0.5);
      }).not.toThrow();
    });
  });

  describe("disposal", () => {
    it("should clean up all resources", () => {
      const engine = new AudioEngine({ instruments: new SvelteSet([InstrumentType.Pad, InstrumentType.Lead]) });
      engine.dispose();
      expect(mockTransport.dispose).toHaveBeenCalled();
    });
  });

  describe("observables", () => {
    it("should provide chord progression observable", () => {
      const engine = new AudioEngine();
      const progressions: any[] = [];

      engine.getChordProgression$().subscribe(progression => {
        progressions.push(progression);
      });

      expect(progressions.length).toBeGreaterThan(0);
    });

    it("should provide current chord observable", () => {
      const engine = new AudioEngine();
      const chords: any[] = [];

      engine.getCurrentChord$().subscribe(chord => {
        chords.push(chord);
      });

      expect(chords.length).toBeGreaterThan(0);
    });
  });
});

describe("createAmbientAudioEngine", () => {
  it("should create engine with ambient-specific defaults", () => {
    const engine = createAmbientAudioEngine();
    const states: AudioEngineState[] = [];

    engine.getState$().subscribe(state => states.push(state));

    expect(states[0].tempo).toBe(72);
    expect(states[0].key).toBe(Note.C);
    expect(states[0].mode).toBe(Mode.Aeolian);
    expect(states[0].volume).toBe(0.6);
    expect(states[0].instruments).toEqual(new Set([InstrumentType.AmbientPad, InstrumentType.Granular]));
  });

  it("should merge custom initial state", () => {
    const customState = { tempo: 90, key: Note.D };
    const engine = createAmbientAudioEngine(customState);
    const states: AudioEngineState[] = [];

    engine.getState$().subscribe(state => states.push(state));

    expect(states[0].tempo).toBe(90);
    expect(states[0].key).toBe(Note.D);
    expect(states[0].mode).toBe(Mode.Aeolian);
  });
});

describe("createDefaultPattern", () => {
  beforeEach(async () => {
    const { generateScale } = await import("$lib/theory");
    vi.mocked(generateScale).mockReturnValue([0, 2, 4, 5, 7, 9, 11]);
  });

  it("should create pad pattern with long notes", () => {
    const pattern = createDefaultPattern(InstrumentType.Pad, Note.C, Mode.Ionian);

    expect(pattern.type).toBe(InstrumentType.Pad);
    expect(pattern.steps).toHaveLength(16);
    expect(pattern.length).toBe(16);
    expect(pattern.enabled).toBe(true);

    for (const [index, step] of pattern.steps.entries()) {
      if (index % 8 === 0) {
        expect(step.enabled).toBe(true);
        expect(step.duration).toBe("2m");
        expect(step.velocity).toBe(0.3);
      } else {
        expect(step.enabled).toBe(false);
      }
    }
  });

  it("should create atmosphere pattern with very sparse notes", () => {
    const pattern = createDefaultPattern(InstrumentType.Atmosphere, Note.G, Mode.Dorian);

    expect(pattern.type).toBe(InstrumentType.Atmosphere);
    expect(pattern.steps).toHaveLength(32);

    for (const [index, step] of pattern.steps.entries()) {
      if (index % 16 === 0) {
        expect(step.enabled).toBe(true);
        expect(step.duration).toBe("4m");
        expect(step.velocity).toBe(0.2);
      } else {
        expect(step.enabled).toBe(false);
      }
    }
  });

  it("should create bass pattern with root notes", () => {
    const pattern = createDefaultPattern(InstrumentType.Bass, Note.F, Mode.Lydian);

    expect(pattern.type).toBe(InstrumentType.Bass);
    expect(pattern.steps).toHaveLength(8);

    for (const [index, step] of pattern.steps.entries()) {
      if (index % 4 === 0) {
        expect(step.enabled).toBe(true);
        expect(step.note).toBe(0);
        expect(step.duration).toBe("1m");
        expect(step.velocity).toBe(0.4);
      } else {
        expect(step.enabled).toBe(false);
      }
    }
  });

  it("should create default pattern for unknown instrument types", () => {
    const pattern = createDefaultPattern(InstrumentType.Lead, Note.A, Mode.Mixolydian);

    expect(pattern.type).toBe(InstrumentType.Lead);
    expect(pattern.steps).toHaveLength(16);

    for (const [index, step] of pattern.steps.entries()) {
      if (index % 4 === 0) {
        expect(step.enabled).toBe(true);
        expect(step.duration).toBe("1m");
        expect(step.velocity).toBe(0.3);
      } else {
        expect(step.enabled).toBe(false);
      }
    }
  });

  it("should use notes from the generated scale", async () => {
    const pattern = createDefaultPattern(InstrumentType.Pad, Note.CSharp, Mode.Phrygian);

    const { generateScale } = await import("$lib/theory");
    expect(generateScale).toHaveBeenCalledWith(Note.CSharp, Mode.Phrygian);

    for (const step of pattern.steps) {
      expect([0, 2, 4, 5, 7, 9, 11]).toContain(step.note);
    }
  });
});
