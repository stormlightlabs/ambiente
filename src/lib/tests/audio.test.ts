import { Note } from "$lib/theory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(
  "tone",
  () => ({
    start: vi.fn(),
    getContext: vi.fn(() => ({ state: "suspended" })),
    PolySynth: vi.fn(),
    Synth: vi.fn(),
    Gain: vi.fn(() => ({ toDestination: vi.fn(), gain: { value: 0 }, dispose: vi.fn(), connect: vi.fn() })),
    Channel: vi.fn(() => ({ connect: vi.fn(), volume: { value: 0 }, pan: { value: 0 }, dispose: vi.fn() })),
    Reverb: vi.fn(),
    PingPongDelay: vi.fn(),
    Chorus: vi.fn(),
    AutoFilter: vi.fn(),
    Distortion: vi.fn(),
    Compressor: vi.fn(),
    Frequency: vi.fn(),
    LFO: vi.fn(),
    Envelope: vi.fn(),
    ScaleExp: vi.fn(),
    Param: vi.fn(),
    now: vi.fn(() => 0),
  }),
);

vi.mock("$lib/audio", async () => {
  const actual = await vi.importActual("$lib/audio");
  return {
    ...actual,
    ambientMixer: {
      connectSynth: vi.fn(),
      setMasterVolume: vi.fn(),
      dispose: vi.fn(),
      setGlobalReverb: vi.fn(),
      setGlobalDelay: vi.fn(),
      setGlobalFilter: vi.fn(),
      setGlobalChorus: vi.fn(),
    },
  };
});

import {
  AmbientMixer,
  chordToToneStrings,
  createEffectsChain,
  createSynth,
  DEFAULT_SYNTH_PARAMS,
  initializeAudio,
  noteToFrequency,
  noteToToneString,
  ParameterAutomation,
} from "$lib/audio";
import { EffectType, InstrumentType } from "$lib/types/instruments";
import * as Tone from "tone";

describe("audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initializeAudio", () => {
    it("should start Tone.js when context is not running", async () => {
      const mockStart = vi.fn().mockResolvedValue(void 0);
      (Tone.getContext as any).mockReturnValue({ state: "suspended" });
      (Tone.start as any) = mockStart;

      await initializeAudio();

      expect(mockStart).toHaveBeenCalledOnce();
    });

    it("should not start Tone.js when context is already running", async () => {
      const mockStart = vi.fn();
      (Tone.getContext as any).mockReturnValue({ state: "running" });
      (Tone.start as any) = mockStart;

      await initializeAudio();

      expect(mockStart).not.toHaveBeenCalled();
    });
  });

  describe("InstrumentType enum", () => {
    it("should have all expected instrument types", () => {
      expect(InstrumentType.Pad).toBe("pad");
      expect(InstrumentType.Lead).toBe("lead");
      expect(InstrumentType.Bass).toBe("bass");
      expect(InstrumentType.Percussion).toBe("percussion");
      expect(InstrumentType.Atmosphere).toBe("atmosphere");
      expect(InstrumentType.Texture).toBe("texture");
    });
  });

  describe("DEFAULT_SYNTH_PARAMS", () => {
    it("should have parameters for all instrument types", () => {
      for (const type of Object.values(InstrumentType)) {
        expect(DEFAULT_SYNTH_PARAMS[type]).toBeDefined();
        expect(DEFAULT_SYNTH_PARAMS[type]).toHaveProperty("attack");
        expect(DEFAULT_SYNTH_PARAMS[type]).toHaveProperty("decay");
        expect(DEFAULT_SYNTH_PARAMS[type]).toHaveProperty("sustain");
        expect(DEFAULT_SYNTH_PARAMS[type]).toHaveProperty("release");
        expect(DEFAULT_SYNTH_PARAMS[type]).toHaveProperty("filterFreq");
        expect(DEFAULT_SYNTH_PARAMS[type]).toHaveProperty("filterQ");
        expect(DEFAULT_SYNTH_PARAMS[type]).toHaveProperty("detune");
        expect(DEFAULT_SYNTH_PARAMS[type]).toHaveProperty("volume");
      }
    });

    it("should have different attack times for different instrument types", () => {
      expect(DEFAULT_SYNTH_PARAMS[InstrumentType.Pad].attack).toBeGreaterThan(
        DEFAULT_SYNTH_PARAMS[InstrumentType.Lead].attack,
      );
      expect(DEFAULT_SYNTH_PARAMS[InstrumentType.Atmosphere].attack).toBeGreaterThan(
        DEFAULT_SYNTH_PARAMS[InstrumentType.Bass].attack,
      );
    });
  });

  describe("createSynth", () => {
    const mockPolySynth = { set: vi.fn() };

    beforeEach(() => {
      (Tone.PolySynth as any).mockImplementation(() => mockPolySynth);
    });

    it("should create a PolySynth with default parameters", () => {
      const _synth = createSynth(InstrumentType.Pad);

      expect(Tone.PolySynth).toHaveBeenCalledWith(Tone.Synth, {
        envelope: {
          attack: DEFAULT_SYNTH_PARAMS[InstrumentType.Pad].attack,
          decay: DEFAULT_SYNTH_PARAMS[InstrumentType.Pad].decay,
          sustain: DEFAULT_SYNTH_PARAMS[InstrumentType.Pad].sustain,
          release: DEFAULT_SYNTH_PARAMS[InstrumentType.Pad].release,
        },
        volume: DEFAULT_SYNTH_PARAMS[InstrumentType.Pad].volume,
      });
    });

    it("should merge custom parameters with defaults", () => {
      const customParams = { attack: 1.5, volume: -10 };
      createSynth(InstrumentType.Lead, customParams);

      expect(Tone.PolySynth).toHaveBeenCalledWith(Tone.Synth, {
        envelope: expect.objectContaining({ attack: 1.5, decay: DEFAULT_SYNTH_PARAMS[InstrumentType.Lead].decay }),
        volume: -10,
      });
    });

    it("should set the correct waveform for each instrument type", () => {
      createSynth(InstrumentType.Pad);
      expect(mockPolySynth.set).toHaveBeenCalledWith({ oscillator: { type: "sawtooth" } });

      createSynth(InstrumentType.Lead);
      expect(mockPolySynth.set).toHaveBeenCalledWith({ oscillator: { type: "square" } });

      createSynth(InstrumentType.Bass);
      expect(mockPolySynth.set).toHaveBeenCalledWith({ oscillator: { type: "triangle" } });
    });
  });

  describe("createEffectsChain", () => {
    const mockEffects = {
      reverb: { decay: 4, wet: 0.3 },
      delay: { delayTime: "8n", feedback: 0.3, wet: 0.2 },
      chorus: { frequency: 0.5, delayTime: 3.5, depth: 0.7, wet: 0.3 },
    };

    beforeEach(() => {
      (Tone.Reverb as any).mockImplementation(() => mockEffects.reverb);
      (Tone.PingPongDelay as any).mockImplementation(() => mockEffects.delay);
      (Tone.Chorus as any).mockImplementation(() => mockEffects.chorus);
      (Tone.Gain as any).mockImplementation(() => ({}));
    });

    it("should create reverb effect", () => {
      const effects = createEffectsChain([EffectType.Reverb]);

      expect(Tone.Reverb).toHaveBeenCalledWith({ decay: 4, wet: 0.3 });
      expect(effects).toHaveLength(1);
    });

    it("should create multiple effects in order", () => {
      const effects = createEffectsChain([EffectType.Reverb, EffectType.Delay, EffectType.Chorus]);

      expect(effects).toHaveLength(3);
      expect(Tone.Reverb).toHaveBeenCalled();
      expect(Tone.PingPongDelay).toHaveBeenCalled();
      expect(Tone.Chorus).toHaveBeenCalled();
    });

    it("should create all effect types with correct parameters", () => {
      const allEffects = [
        EffectType.Reverb,
        EffectType.Delay,
        EffectType.Chorus,
        EffectType.Filter,
        EffectType.Distortion,
        EffectType.Compressor,
      ];

      const effects = createEffectsChain(allEffects);

      expect(effects).toHaveLength(6);
      expect(Tone.Reverb).toHaveBeenCalledWith({ decay: 4, wet: 0.3 });
      expect(Tone.PingPongDelay).toHaveBeenCalledWith({ delayTime: "8n", feedback: 0.3, wet: 0.2 });
      expect(Tone.Chorus).toHaveBeenCalledWith({ frequency: 0.5, delayTime: 3.5, depth: 0.7, wet: 0.3 });
      expect(Tone.AutoFilter).toHaveBeenCalledWith({ frequency: 0.2, baseFrequency: 800, octaves: 2.5, wet: 0.5 });
      expect(Tone.Distortion).toHaveBeenCalledWith({ distortion: 0.1, wet: 0.2 });
      expect(Tone.Compressor).toHaveBeenCalledWith({ threshold: -24, ratio: 4, attack: 0.003, release: 0.1 });
    });

    it("should return gain for unknown effect types", () => {
      const effects = createEffectsChain(["unknown" as EffectType]);

      expect(Tone.Gain).toHaveBeenCalledWith(1);
      expect(effects).toHaveLength(1);
    });
  });

  describe("AmbientMixer", () => {
    let mockChannel: any;
    let mockGain: any;

    beforeEach(() => {
      mockChannel = { connect: vi.fn(), volume: { value: 0 }, pan: { value: 0 }, dispose: vi.fn() };

      mockGain = { toDestination: vi.fn(), gain: { value: 0 }, dispose: vi.fn(), connect: vi.fn() };

      (Tone.Channel as any).mockImplementation(() => mockChannel);
      (Tone.Gain as any).mockImplementation(() => mockGain);
    });

    it("should initialize with master gain and channels for all instrument types", () => {
      const _mixer = new AmbientMixer();

      expect(Tone.Gain).toHaveBeenCalledWith(0.8);
      expect(mockGain.toDestination).toHaveBeenCalled();
      expect(Tone.Channel).toHaveBeenCalledTimes(Object.values(InstrumentType).length);
    });

    it("should connect synth with effects chain", () => {
      const mixer = new AmbientMixer();
      const mockSynth = { connect: vi.fn() };
      const mockEffect = { connect: vi.fn() };

      (Tone.Reverb as any).mockImplementationOnce(() => mockEffect);

      mixer.connectSynth(mockSynth as any, InstrumentType.Pad, [EffectType.Reverb]);

      expect(mockSynth.connect).toHaveBeenCalledWith(mockEffect);
      expect(mockEffect.connect).toHaveBeenCalledWith(mockChannel);
    });

    it("should connect synth directly to channel when no effects", () => {
      const mixer = new AmbientMixer();
      const mockSynth = { connect: vi.fn() };

      mixer.connectSynth(mockSynth as any, InstrumentType.Pad, []);

      expect(mockSynth.connect).toHaveBeenCalledWith(mockChannel);
    });

    it("should not connect if channel doesn't exist", () => {
      const mixer = new AmbientMixer();
      const mockSynth = { connect: vi.fn() };

      mixer.connectSynth(mockSynth as any, "nonexistent" as InstrumentType, []);

      expect(mockSynth.connect).not.toHaveBeenCalled();
    });

    it("should set channel volume", () => {
      const mixer = new AmbientMixer();
      mixer.setChannelVolume(InstrumentType.Pad, -10);

      expect(mockChannel.volume.value).toBe(-10);
    });

    it("should not set volume for non-existent channel", () => {
      const mixer = new AmbientMixer();
      const originalValue = mockChannel.volume.value;

      mixer.setChannelVolume("nonexistent" as InstrumentType, -5);

      expect(mockChannel.volume.value).toBe(originalValue);
    });

    it("should clamp channel pan between -1 and 1", () => {
      const mixer = new AmbientMixer();

      mixer.setChannelPan(InstrumentType.Pad, 2);
      expect(mockChannel.pan.value).toBe(1);

      mixer.setChannelPan(InstrumentType.Pad, -2);
      expect(mockChannel.pan.value).toBe(-1);

      mixer.setChannelPan(InstrumentType.Pad, 0.5);
      expect(mockChannel.pan.value).toBe(0.5);
    });

    it("should clamp master volume between 0 and 1", () => {
      const mixer = new AmbientMixer();

      mixer.setMasterVolume(2);
      expect(mockGain.gain.value).toBe(1);

      mixer.setMasterVolume(-1);
      expect(mockGain.gain.value).toBe(0);

      mixer.setMasterVolume(0.7);
      expect(mockGain.gain.value).toBe(0.7);
    });

    it("should get channel by instrument type", () => {
      const mixer = new AmbientMixer();

      const channel = mixer.getChannel(InstrumentType.Pad);
      expect(channel).toBeDefined();

      const nonExistentChannel = mixer.getChannel("nonexistent" as InstrumentType);
      expect(nonExistentChannel).toBeUndefined();
    });

    it("should dispose all resources", () => {
      const mixer = new AmbientMixer();
      mixer.dispose();

      expect(mockChannel.dispose).toHaveBeenCalledTimes(Object.values(InstrumentType).length);
      expect(mockGain.dispose).toHaveBeenCalled();
    });
  });

  describe("note conversion utilities", () => {
    beforeEach(() => {
      const mockFrequency = { toFrequency: vi.fn().mockReturnValue(440) };
      (Tone.Frequency as any).mockImplementation(() => mockFrequency);
    });

    it("should convert note to frequency", () => {
      const freq = noteToFrequency(Note.A, 4);

      expect(Tone.Frequency).toHaveBeenCalledWith("A4");
      expect(freq).toBe(440);
    });

    it("should convert note to Tone.js string format", () => {
      const noteString = noteToToneString(Note.C, 3);
      expect(noteString).toBe("C3");
    });

    it("should convert chord to Tone.js string array", () => {
      const chord = [Note.C, Note.E, Note.G];
      const chordStrings = chordToToneStrings(chord, 4);

      expect(chordStrings).toEqual(["C4", "E4", "G4"]);
    });

    it("should use default octave 4 when not specified", () => {
      noteToToneString(Note.F);
      expect(noteToToneString(Note.F)).toBe("F4");
    });
  });

  describe("ParameterAutomation", () => {
    let mockParam: any;
    let mockLFO: any;
    let mockEnvelope: any;
    let mockScale: any;

    beforeEach(() => {
      mockParam = { linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), value: 0.5 };
      mockLFO = { type: "sine", connect: vi.fn() };
      mockEnvelope = { connect: vi.fn() };
      mockScale = { connect: vi.fn() };

      (Tone.LFO as any).mockImplementation(() => mockLFO);
      (Tone.Envelope as any).mockImplementation(() => mockEnvelope);
      (Tone.ScaleExp as any).mockImplementation(() => mockScale);
    });

    it("should automate parameter with linear ramp", () => {
      ParameterAutomation.automateParameter(mockParam as any, 1, "2m", "linear");

      expect(mockParam.linearRampToValueAtTime).toHaveBeenCalledWith(1, "+2m");
    });

    it("should automate parameter with exponential ramp", () => {
      ParameterAutomation.automateParameter(mockParam as any, 1, "2m", "exponential");

      expect(mockParam.exponentialRampToValueAtTime).toHaveBeenCalledWith(1, "+2m");
    });

    it("should create LFO with correct parameters", () => {
      const lfo = ParameterAutomation.createLFO(mockParam, 0.2, 0.3, "triangle");

      expect(Tone.LFO).toHaveBeenCalledWith(0.2, 0.2, 0.8); // value ± depth
      expect(mockLFO.type).toBe("triangle");
      expect(mockLFO.connect).toHaveBeenCalledWith(mockParam);
      expect(lfo).toBe(mockLFO);
    });

    it("should create envelope modulation", () => {
      const scale = ParameterAutomation.createEnvelopeModulation(mockParam, 0.1, 0.2, 0.8, 1.5, 0.4);

      expect(Tone.Envelope).toHaveBeenCalledWith(0.1, 0.2, 0.8, 1.5);
      expect(Tone.ScaleExp).toHaveBeenCalledWith(0.5, 0.9);
      expect(mockEnvelope.connect).toHaveBeenCalledWith(mockScale);
      expect(mockScale.connect).toHaveBeenCalledWith(mockParam);
      expect(scale).toBe(mockScale);
    });

    it("should use default parameters", () => {
      ParameterAutomation.automateParameter(mockParam, 1);
      expect(mockParam.linearRampToValueAtTime).toHaveBeenCalledWith(1, "+1m");

      ParameterAutomation.createLFO(mockParam);
      expect(Tone.LFO).toHaveBeenCalledWith(0.1, 0, 1); // default values
    });

    it("should handle LFO start and stop", () => {
      mockLFO.start = vi.fn();
      mockLFO.stop = vi.fn();

      const lfo = ParameterAutomation.createLFO(mockParam, 0.5, 0.2);

      expect(lfo).toBe(mockLFO);
      expect(mockLFO.connect).toHaveBeenCalledWith(mockParam);
    });
  });
});
