import { logger } from "$lib/debug/audio-logger";
import { EffectType, InstrumentType } from "$lib/types/instruments";
import type { Optional } from "$lib/types/shared";
import * as Tone from "tone";
import { createEffectsChain } from "./effects";
import { DEFAULT_SYNTH_PARAMS } from "./synth-factory";

export class AmbientMixer {
  private masterGain: Tone.Gain;
  private channels: Map<InstrumentType, Tone.Channel> = new Map();
  private effects: Map<InstrumentType, Tone.ToneAudioNode[]> = new Map();
  private static readonly PREFIX = "[AmbientMixer]";

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
    logger.debug(AmbientMixer.PREFIX, `Connecting synth for ${type} with ${effects.length} effects`);
    const channel = this.channels.get(type);
    if (!channel) {
      logger.error(AmbientMixer.PREFIX, "No channel found for instrument type:", type);
      return;
    }

    const effectsChain = createEffectsChain(effects);
    this.effects.set(type, effectsChain);
    logger.debug(AmbientMixer.PREFIX, `Created effects chain for ${type}:`, effects);

    // Chain: synth -> effects -> channel -> master
    let currentNode: Tone.ToneAudioNode = synth;

    for (const effect of effectsChain) {
      currentNode.connect(effect);
      currentNode = effect;
    }

    currentNode.connect(channel);
    logger.debug(AmbientMixer.PREFIX, `Connected synth ${type} to audio chain`);
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
    logger.debug(AmbientMixer.PREFIX, `Disposing mixer with ${this.channels.size} channels`);

    // Step 1: Disconnect all channels from master and effects
    logger.debug(AmbientMixer.PREFIX, "Disconnecting all channels...");
    for (const [type, channel] of this.channels) {
      try {
        channel.disconnect();
        logger.debug(AmbientMixer.PREFIX, `Disconnected channel for ${type}`);
      } catch (error) {
        logger.error(AmbientMixer.PREFIX, `Error disconnecting channel ${type}:`, error);
      }
    }

    // Step 2: Dispose instrument-specific effects first
    logger.debug(AmbientMixer.PREFIX, "Disposing instrument effects...");
    for (const [type, effectsArray] of this.effects) {
      logger.debug(AmbientMixer.PREFIX, `Disposing ${effectsArray.length} effects for ${type}`);
      for (const effect of effectsArray) {
        try {
          effect.disconnect();
          effect.dispose();
        } catch (error) {
          logger.error(AmbientMixer.PREFIX, `Error disposing effect for ${type}:`, error);
        }
      }
    }
    this.effects.clear();

    // Step 3: Dispose global effects
    logger.debug(AmbientMixer.PREFIX, "Disposing global effects...");
    if (this.globalReverb) {
      try {
        this.globalReverb.disconnect();
        this.globalReverb.dispose();
        logger.debug(AmbientMixer.PREFIX, "Disposed global reverb");
      } catch (error) {
        logger.error(AmbientMixer.PREFIX, "Error disposing global reverb:", error);
      }
    }
    if (this.globalDelay) {
      try {
        this.globalDelay.disconnect();
        this.globalDelay.dispose();
        logger.debug(AmbientMixer.PREFIX, "Disposed global delay");
      } catch (error) {
        logger.error(AmbientMixer.PREFIX, "Error disposing global delay:", error);
      }
    }
    if (this.globalFilter) {
      try {
        this.globalFilter.disconnect();
        this.globalFilter.dispose();
        logger.debug(AmbientMixer.PREFIX, "Disposed global filter");
      } catch (error) {
        logger.error(AmbientMixer.PREFIX, "Error disposing global filter:", error);
      }
    }
    if (this.globalChorus) {
      try {
        this.globalChorus.disconnect();
        this.globalChorus.dispose();
        logger.debug(AmbientMixer.PREFIX, "Disposed global chorus");
      } catch (error) {
        logger.error(AmbientMixer.PREFIX, "Error disposing global chorus:", error);
      }
    }
    this.globalEffectsChain = [];

    // Step 4: Dispose channels
    logger.debug(AmbientMixer.PREFIX, "Disposing channels...");
    for (const [type, channel] of this.channels) {
      try {
        channel.dispose();
        logger.debug(AmbientMixer.PREFIX, `Disposed channel for ${type}`);
      } catch (error) {
        logger.error(AmbientMixer.PREFIX, `Error disposing channel ${type}:`, error);
      }
    }
    this.channels.clear();

    // Step 5: Finally dispose master gain
    logger.debug(AmbientMixer.PREFIX, "Disposing master gain");
    try {
      this.masterGain.disconnect();
      this.masterGain.dispose();
    } catch (error) {
      logger.error(AmbientMixer.PREFIX, "Error disposing master gain:", error);
    }

    logger.debug(AmbientMixer.PREFIX, "Mixer disposal complete");
  }
}
