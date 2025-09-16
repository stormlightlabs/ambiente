import * as Tone from "tone";
import { Note, NoteUtilities } from "./theory";
import { EffectType, InstrumentType, type SynthParams } from "./types/instruments";
import type { Optional } from "./types/shared";

export const initializeAudio = async (): Promise<void> => {
  if (Tone.getContext().state !== "running") {
    await Tone.start();
  }
};

export const DEFAULT_SYNTH_PARAMS: Record<InstrumentType, SynthParams> = {
  [InstrumentType.Pad]: {
    attack: 2,
    decay: 0.5,
    sustain: 0.8,
    release: 4,
    filterFreq: 800,
    filterQ: 1,
    detune: 0,
    volume: -12,
  },
  [InstrumentType.Lead]: {
    attack: 0.1,
    decay: 0.3,
    sustain: 0.6,
    release: 1.5,
    filterFreq: 1200,
    filterQ: 2,
    detune: 0,
    volume: -18,
  },
  [InstrumentType.Bass]: {
    attack: 0.05,
    decay: 0.2,
    sustain: 0.4,
    release: 0.8,
    filterFreq: 400,
    filterQ: 1.5,
    detune: 0,
    volume: -8,
  },
  [InstrumentType.Percussion]: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0,
    release: 0.3,
    filterFreq: 2000,
    filterQ: 0.5,
    detune: 0,
    volume: -15,
  },
  [InstrumentType.Atmosphere]: {
    attack: 4,
    decay: 2,
    sustain: 0.9,
    release: 8,
    filterFreq: 600,
    filterQ: 0.8,
    detune: 5,
    volume: -20,
  },
  [InstrumentType.Texture]: {
    attack: 1,
    decay: 1,
    sustain: 0.7,
    release: 3,
    filterFreq: 1000,
    filterQ: 1.2,
    detune: -3,
    volume: -16,
  },
  // Ambient instruments
  [InstrumentType.AmbientPad]: {
    attack: 2,
    decay: 0.5,
    sustain: 0.8,
    release: 4,
    filterFreq: 400,
    filterQ: 1.5,
    detune: 0,
    volume: -10,
  },
  [InstrumentType.Granular]: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.3,
    release: 0.2,
    filterFreq: 800,
    filterQ: 1,
    detune: 0,
    volume: -14,
  },
  [InstrumentType.Melodic]: {
    attack: 0.1,
    decay: 0.3,
    sustain: 0.6,
    release: 1.5,
    filterFreq: 1200,
    filterQ: 2,
    detune: 0,
    volume: -20,
  },
  [InstrumentType.HarmonicDrone]: {
    attack: 8,
    decay: 0,
    sustain: 1,
    release: 10,
    filterFreq: 400,
    filterQ: 0.5,
    detune: 2,
    volume: -12,
  },
  [InstrumentType.RhythmicPulse]: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0,
    release: 0.3,
    filterFreq: 2000,
    filterQ: 0.5,
    detune: 0,
    volume: -18,
  },
  [InstrumentType.FieldRecording]: {
    attack: 0.5,
    decay: 1,
    sustain: 1,
    release: 2,
    filterFreq: 800,
    filterQ: 1,
    detune: 0,
    volume: -15,
  },
  [InstrumentType.VocalPad]: {
    attack: 3,
    decay: 0.5,
    sustain: 0.9,
    release: 5,
    filterFreq: 1200,
    filterQ: 0.8,
    detune: 0,
    volume: -14,
  },
  [InstrumentType.Arpeggiator]: {
    attack: 0.05,
    decay: 0.4,
    sustain: 0.3,
    release: 1,
    filterFreq: 1500,
    filterQ: 2,
    detune: 0,
    volume: -16,
  },
};

export const createSynth = (type: InstrumentType, params?: Partial<SynthParams>): Tone.PolySynth => {
  const finalParams = { ...DEFAULT_SYNTH_PARAMS[type], ...params };

  const synth = new Tone.PolySynth(Tone.Synth, {
    envelope: {
      attack: finalParams.attack,
      decay: finalParams.decay,
      sustain: finalParams.sustain,
      release: finalParams.release,
    },
    volume: finalParams.volume,
  });

  synth.set({ oscillator: { type: getSynthWaveform(type) } });

  return synth;
};

const getSynthWaveform = (type: InstrumentType) => {
  switch (type) {
    case InstrumentType.Pad: {
      return "sawtooth";
    }
    case InstrumentType.Lead: {
      return "square";
    }
    case InstrumentType.Bass: {
      return "triangle";
    }
    case InstrumentType.Percussion: {
      return "square";
    }
    case InstrumentType.Atmosphere: {
      return "sine";
    }
    case InstrumentType.Texture: {
      return "sawtooth";
    }
    default: {
      return "sine";
    }
  }
};

export const createEffectsChain = (effects: EffectType[]): Tone.ToneAudioNode[] =>
  effects.map(effectType => {
    switch (effectType) {
      case EffectType.Reverb: {
        return new Tone.Reverb({ decay: 4, wet: 0.3 });
      }

      case EffectType.Delay: {
        return new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.3, wet: 0.2 });
      }

      case EffectType.Chorus: {
        return new Tone.Chorus({ frequency: 0.5, delayTime: 3.5, depth: 0.7, wet: 0.3 });
      }

      case EffectType.Filter: {
        return new Tone.AutoFilter({ frequency: 0.2, baseFrequency: 800, octaves: 2.5, wet: 0.5 });
      }

      case EffectType.Distortion: {
        return new Tone.Distortion({ distortion: 0.1, wet: 0.2 });
      }

      case EffectType.Compressor: {
        return new Tone.Compressor({ threshold: -24, ratio: 4, attack: 0.003, release: 0.1 });
      }

      default: {
        return new Tone.Gain(1);
      }
    }
  });

export class AmbientMixer {
  private masterGain: Tone.Gain;
  private channels: Map<InstrumentType, Tone.Channel> = new Map();
  private effects: Map<InstrumentType, Tone.ToneAudioNode[]> = new Map();

  private globalReverb: Optional<Tone.Reverb>;
  private globalDelay: Optional<Tone.PingPongDelay>;
  private globalFilter: Optional<Tone.AutoFilter>;
  private globalChorus: Optional<Tone.Chorus>;
  private globalEffectsChain: Tone.ToneAudioNode[] = [];

  constructor() {
    this.masterGain = new Tone.Gain(0.8);
    this.masterGain.toDestination();

    for (const type of Object.values(InstrumentType)) {
      const channel = new Tone.Channel({ volume: DEFAULT_SYNTH_PARAMS[type].volume, pan: 0 });

      channel.connect(this.masterGain);
      this.channels.set(type, channel);
    }
  }

  connectSynth(synth: Tone.PolySynth, type: InstrumentType, effects: EffectType[] = []): void {
    const channel = this.channels.get(type);
    if (!channel) return;

    const effectsChain = createEffectsChain(effects);
    this.effects.set(type, effectsChain);

    // Chain: synth -> effects -> channel -> master
    let currentNode: Tone.ToneAudioNode = synth;

    for (const effect of effectsChain) {
      currentNode.connect(effect);
      currentNode = effect;
    }

    currentNode.connect(channel);
  }

  setChannelVolume(type: InstrumentType, volume: number): void {
    const channel = this.channels.get(type);
    if (channel) {
      channel.volume.value = volume;
    }
  }

  setChannelPan(type: InstrumentType, pan: number): void {
    const channel = this.channels.get(type);
    if (channel) {
      channel.pan.value = Math.max(-1, Math.min(1, pan));
    }
  }

  setMasterVolume(volume: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  getChannel(type: InstrumentType): Tone.Channel | undefined {
    return this.channels.get(type);
  }

  setGlobalReverb(settings: { wet: number; decay: number; preDelay: number }): void {
    if (this.globalReverb) {
      this.globalReverb.dispose();
      this.removeFromGlobalChain(this.globalReverb);
    }

    this.globalReverb = new Tone.Reverb({ decay: settings.decay, preDelay: settings.preDelay, wet: settings.wet });

    this.addToGlobalChain(this.globalReverb);
  }

  setGlobalDelay(settings: { wet: number; time: string; feedback: number }): void {
    if (this.globalDelay) {
      this.globalDelay.dispose();
      this.removeFromGlobalChain(this.globalDelay);
    }

    this.globalDelay = new Tone.PingPongDelay({
      delayTime: settings.time,
      feedback: settings.feedback,
      wet: settings.wet,
    });

    this.addToGlobalChain(this.globalDelay);
  }

  setGlobalFilter(settings: { type: string; frequency: number; Q?: number }): void {
    if (this.globalFilter) {
      this.globalFilter.dispose();
      this.removeFromGlobalChain(this.globalFilter);
    }

    if (settings.type === "lowpass" || settings.type === "highpass" || settings.type === "bandpass") {
      const filter = new Tone.Filter({ type: settings.type as any, frequency: settings.frequency, Q: settings.Q || 1 });
      this.globalFilter = filter as any;
      this.addToGlobalChain(filter);
    } else {
      this.globalFilter = new Tone.AutoFilter({
        frequency: 0.2,
        baseFrequency: settings.frequency,
        octaves: 2.5,
        wet: 0.5,
      });
      this.addToGlobalChain(this.globalFilter);
    }
  }

  setGlobalChorus(settings: { wet: number; frequency: number; depth: number }): void {
    if (this.globalChorus) {
      this.globalChorus.dispose();
      this.removeFromGlobalChain(this.globalChorus);
    }

    this.globalChorus = new Tone.Chorus({
      frequency: settings.frequency,
      delayTime: 3.5,
      depth: settings.depth,
      wet: settings.wet,
    });

    this.addToGlobalChain(this.globalChorus);
  }

  private addToGlobalChain(effect: Tone.ToneAudioNode): void {
    this.globalEffectsChain.push(effect);
    this.rebuildGlobalChain();
  }

  private removeFromGlobalChain(effect: Tone.ToneAudioNode): void {
    const index = this.globalEffectsChain.indexOf(effect);
    if (index !== -1) {
      this.globalEffectsChain.splice(index, 1);
      this.rebuildGlobalChain();
    }
  }

  private rebuildGlobalChain(): void {
    for (const [, channel] of this.channels) {
      channel.disconnect();
    }

    if (this.globalEffectsChain.length === 0) {
      for (const [, channel] of this.channels) {
        channel.connect(this.masterGain);
      }
      return;
    }

    const firstEffect = this.globalEffectsChain[0];
    for (const [, channel] of this.channels) {
      channel.connect(firstEffect);
    }

    for (let index = 0; index < this.globalEffectsChain.length - 1; index++) {
      this.globalEffectsChain[index].connect(this.globalEffectsChain[index + 1]);
    }

    const lastEffect = this.globalEffectsChain.at(-1);
    lastEffect?.connect(this.masterGain);
  }

  dispose(): void {
    for (const [, channel] of this.channels) channel.dispose();
    for (const [, effectsArray] of this.effects) for (const effect of effectsArray) effect.dispose();

    if (this.globalReverb) this.globalReverb.dispose();
    if (this.globalDelay) this.globalDelay.dispose();
    if (this.globalFilter) this.globalFilter.dispose();
    if (this.globalChorus) this.globalChorus.dispose();

    this.masterGain.dispose();
  }
}

export const noteToFrequency = (note: Note, octave: number = 4): number =>
  Tone.Frequency(`${NoteUtilities.toString(note)}${octave}`).toFrequency();

export const noteToToneString = (note: Note, octave: number = 4): string => `${NoteUtilities.toString(note)}${octave}`;

export const chordToToneStrings = (chord: Note[], octave: number = 4): string[] =>
  chord.map(note => noteToToneString(note, octave));

export const ParameterAutomation = {
  automateParameter<T extends Tone.Param>(
    param: T,
    targetValue: number,
    duration: string = "1m",
    curve: "linear" | "exponential" = "linear",
  ): void {
    if (curve === "exponential") {
      param.exponentialRampToValueAtTime(targetValue, `+${duration}`);
    } else {
      param.linearRampToValueAtTime(targetValue, `+${duration}`);
    }
  },

  createLFO(
    param: Tone.Param,
    frequency: number = 0.1,
    depth: number = 0.5,
    type: Tone.ToneOscillatorType = "sine",
  ): Tone.LFO {
    const lfo = new Tone.LFO(frequency, param.value - depth, param.value + depth);
    lfo.type = type;
    lfo.connect(param);
    return lfo;
  },

  createEnvelopeModulation(
    param: Tone.Param,
    attack: number = 0.1,
    decay: number = 0.3,
    sustain: number = 0.7,
    release: number = 1,
    amount: number = 0.5,
  ): Tone.ScaleExp {
    const envelope = new Tone.Envelope(attack, decay, sustain, release);
    const scale = new Tone.ScaleExp(param.value, param.value + amount);

    envelope.connect(scale);
    scale.connect(param);

    return scale;
  },
};

export const ambientMixer = new AmbientMixer();
