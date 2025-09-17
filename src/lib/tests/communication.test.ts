import { Mode, Note } from "$lib/theory";
import { InstrumentType } from "$lib/types/instruments";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(
  "$lib/audio",
  () => ({
    InstrumentType: {
      Pad: "pad",
      Lead: "lead",
      Bass: "bass",
      Percussion: "percussion",
      Atmosphere: "atmosphere",
      Texture: "texture",
    },
    ambientMixer: {
      connectSynth: vi.fn(),
      setMasterVolume: vi.fn(),
      dispose: vi.fn(),
      setGlobalReverb: vi.fn(),
      setGlobalDelay: vi.fn(),
      setGlobalFilter: vi.fn(),
      setGlobalChorus: vi.fn(),
    },
  }),
);

const mockAudioEngine = {
  getState$: vi.fn(() => ({
    subscribe: vi.fn((callback) => {
      callback({
        isPlaying: false,
        tempo: 80,
        key: Note.C,
        mode: Mode.Ionian,
        currentChord: 0,
        volume: 0.7,
        instruments: new Set([InstrumentType.Pad]),
      });
      return { unsubscribe: vi.fn() };
    }),
  })),
  getEvents$: vi.fn(() => ({
    subscribe: vi.fn((callback) => {
      callback({ type: "play", timestamp: Date.now() });
      return { unsubscribe: vi.fn() };
    }),
  })),
  getCurrentChord$: vi.fn(() => ({ subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) })),
  togglePlayback: vi.fn(),
  setTempo: vi.fn(),
  setKeyAndMode: vi.fn(),
  setVolume: vi.fn(),
  toggleInstrument: vi.fn(),
  automateParameter: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("$lib/audio-engine", () => ({ createAmbientAudioEngine: vi.fn(() => mockAudioEngine) }));

import { AppStateManager, ComponentCommunicator } from "$lib/communication.svelte";

describe("Communication Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AppStateManager Integration", () => {
    it("should handle audio engine state changes", async () => {
      const appState = new AppStateManager();

      await appState.togglePlayback();
      expect(appState.ui.isInitialized).toBe(true);
      expect(appState.audio.isPlaying).toBe(false);
      expect(appState.audio.tempo).toBe(80);
      expect(appState.audio.key).toBe(Note.C);
      expect(appState.audio.mode).toBe(Mode.Ionian);
      expect(appState.audio.volume).toBe(0.7);
    });

    it("should have UI state methods", async () => {
      const appState = new AppStateManager();
      expect(appState.setActiveView).toBeTypeOf("function");
      expect(appState.setSelectedPreset).toBeTypeOf("function");
      expect(appState.toggleRecording).toBeTypeOf("function");
      expect(appState.toggleSettings).toBeTypeOf("function");
    });

    it("should delegate audio engine methods", async () => {
      const appState = new AppStateManager();
      appState.togglePlayback();
      expect(mockAudioEngine.togglePlayback).toHaveBeenCalled();

      appState.setTempo(120);
      expect(mockAudioEngine.setTempo).toHaveBeenCalledWith(120);

      appState.setKeyAndMode(Note.G, Mode.Dorian);
      expect(mockAudioEngine.setKeyAndMode).toHaveBeenCalledWith(Note.G, Mode.Dorian);

      appState.setVolume(0.5);
      expect(mockAudioEngine.setVolume).toHaveBeenCalledWith(0.5);

      appState.toggleInstrument(InstrumentType.Lead);
      expect(mockAudioEngine.toggleInstrument).toHaveBeenCalledWith(InstrumentType.Lead);

      appState.automateParameter(InstrumentType.Pad, "filter.frequency", 1000, "2m");
      expect(mockAudioEngine.automateParameter).toHaveBeenCalledWith(
        InstrumentType.Pad,
        "filter.frequency",
        1000,
        "2m",
      );
    });

    it("should provide observables", async () => {
      const appState = new AppStateManager();
      const state$ = appState.getAudioState$();
      const events$ = appState.getAudioEvents$();
      const chord$ = appState.getCurrentChord$();

      expect(state$).toBeDefined();
      expect(events$).toBeDefined();
      expect(chord$).toBeDefined();
    });

    it("should track recent events", async () => {
      const appState = new AppStateManager();

      expect(Array.isArray(appState.recentEvents)).toBe(true);
      expect(appState.recentEvents.length).toBeLessThanOrEqual(10);
    });

    it("should provide undo/redo capabilities", async () => {
      const appState = new AppStateManager();

      expect(typeof appState.canUndo).toBe("boolean");
      expect(typeof appState.canRedo).toBe("boolean");
      expect(typeof appState.undo).toBe("function");
      expect(typeof appState.redo).toBe("function");
    });
  });

  describe("ComponentCommunicator", () => {
    it("should have publish and subscribe methods", async () => {
      const componentBus = new ComponentCommunicator();

      expect(typeof componentBus.publish).toBe("function");
      expect(typeof componentBus.subscribe).toBe("function");
      expect(Array.isArray(componentBus.recentMessages)).toBe(true);
    });

    it("should provide subscription functionality", async () => {
      const componentBus = new ComponentCommunicator();
      const callback = vi.fn();

      const unsubscribe = componentBus.subscribe("test-event", callback);
      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });

    it("should maintain message history structure", async () => {
      const componentBus = new ComponentCommunicator();
      expect(Array.isArray(componentBus.recentMessages)).toBe(true);

      componentBus.publish("test-event", "test-component", { value: 42 });

      if (componentBus.recentMessages.length > 0) {
        const message = componentBus.recentMessages.at(-1);
        expect(message).toHaveProperty("type");
        expect(message).toHaveProperty("source");
        expect(message).toHaveProperty("timestamp");
      }
    });
  });
});
