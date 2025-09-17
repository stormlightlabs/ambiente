import { EffectType } from "$lib/types/instruments";
import * as Tone from "tone";

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
