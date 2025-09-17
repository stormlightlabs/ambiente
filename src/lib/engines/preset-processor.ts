import { AmbientMixer } from "$lib/audio/mixer";
import { AMBIENT_TO_ENGINE_MAPPING } from "$lib/data/presets";
import {
  getPatternLengthForType,
  isAmbientInstrument,
  scaleToNotes,
  shouldApplyVoiceToInstrument,
  type SynthKind,
} from "$lib/engines/utilities";
import { PatternRandomizer } from "$lib/seed/pattern-randomizer";
import { Note } from "$lib/theory";
import type { AudioEngineState, InstrumentPattern } from "$lib/types/audio";
import { InstrumentType } from "$lib/types/instruments";
import type { Texture, Voice } from "$lib/types/presets";
import { BehaviorSubject } from "rxjs";
import * as Tone from "tone";

export class PresetProcessor {
  private readonly state$: BehaviorSubject<AudioEngineState>;
  private readonly patterns$: BehaviorSubject<Map<InstrumentType, InstrumentPattern>>;
  private readonly currentScale$: BehaviorSubject<Note[]>;
  private readonly synthInstances: Map<InstrumentType, Tone.PolySynth>;
  private readonly ambientInstruments: Map<InstrumentType, SynthKind>;
  private readonly ambientMixer: AmbientMixer;

  constructor(
    state$: BehaviorSubject<AudioEngineState>,
    patterns$: BehaviorSubject<Map<InstrumentType, InstrumentPattern>>,
    currentScale$: BehaviorSubject<Note[]>,
    synthInstances: Map<InstrumentType, Tone.PolySynth>,
    ambientInstruments: Map<InstrumentType, SynthKind>,
    ambientMixer: AmbientMixer,
  ) {
    this.state$ = state$;
    this.patterns$ = patterns$;
    this.currentScale$ = currentScale$;
    this.synthInstances = synthInstances;
    this.ambientInstruments = ambientInstruments;
    this.ambientMixer = ambientMixer;
  }

  applyPresetTexture(
    texture: Texture,
    setTempo: (tempo: number) => void,
    setVolume: (volume: number) => void,
    setKeyAndMode: (key: Note, mode: any) => void,
  ): void {
    if (texture.tempo) {
      setTempo(texture.tempo);
    }

    if (texture.mix?.volume !== undefined) {
      let volume = texture.mix.volume;
      if (volume < 0) {
        volume = Math.pow(10, volume / 20);
      }
      setVolume(Math.max(0, Math.min(1, volume)));
    }

    if (texture.scale && texture.scale.length > 0) {
      const scaleNotes = scaleToNotes(texture.scale);
      if (scaleNotes.length > 0) {
        setKeyAndMode(scaleNotes[0], this.state$.value.mode);
      }
    }

    if (texture.instruments) {
      for (const [textureKey, params] of Object.entries(texture.instruments)) {
        const kind = AMBIENT_TO_ENGINE_MAPPING[textureKey as keyof typeof AMBIENT_TO_ENGINE_MAPPING];
        if (kind && typeof params === "object" && params !== null) {
          const instrument = this.ambientInstruments.get(kind);
          if (instrument) {
            const converted = { ...params } as any;
            if (converted.volume !== undefined && converted.volume < 0) {
              converted.volume = Math.pow(10, converted.volume / 20);
            }

            instrument.updateParams(converted);
          }
        }
      }
    }

    this.applyTextureProcessing(texture);
    this.applyTextureLayering(texture);
  }

  private applyTextureProcessing(texture: Texture): void {
    if (!texture.processing) return;

    if (texture.processing.reverb) {
      this.ambientMixer.setGlobalReverb(texture.processing.reverb);
    }

    if (texture.processing.delay) {
      this.ambientMixer.setGlobalDelay(texture.processing.delay);
    }

    if (texture.processing.filter) {
      this.ambientMixer.setGlobalFilter(texture.processing.filter);
    }

    if (texture.processing.chorus) {
      this.ambientMixer.setGlobalChorus(texture.processing.chorus);
    }

    this.applyVoiceConfigurations(texture);
  }

  private applyVoiceConfigurations(texture: any): void {
    if (!texture.voices || !Array.isArray(texture.voices)) return;

    const currentState = this.state$.value;

    for (const voice of texture.voices) {
      const { type, count = 1, envelope, oscillator } = voice;

      for (const kind of currentState.instruments) {
        if (shouldApplyVoiceToInstrument(type, kind)) {
          this.configureInstrumentVoice(kind, { type, count, envelope: envelope || {}, oscillator: oscillator || {} });
        }
      }
    }
  }

  private configureInstrumentVoice(kind: InstrumentType, voice: Voice): void {
    const synth = this.synthInstances.get(kind);
    if (!synth) return;

    if (voice.envelope) {
      const envelope = voice.envelope;
      synth.set({
        envelope: {
          attack: envelope.attack,
          decay: envelope.decay,
          sustain: envelope.sustain,
          release: envelope.release,
        },
      });
    }

    if (voice.oscillator) {
      const oscillator = voice.oscillator;

      if (oscillator.type) {
        synth.set({ oscillator: { type: oscillator.type } });
      }
    }

    this.applyVoiceCharacteristics(synth, voice);
  }

  private applyVoiceCharacteristics(synth: Tone.PolySynth, voice: Voice): void {
    switch (voice.type) {
      // Piano-like characteristics: sharp attack, quick decay
      case "piano": {
        synth.set({
          envelope: {
            attack: 0.001,
            decay: voice.envelope?.decay || 2,
            sustain: voice.envelope?.sustain || 0.1,
            release: voice.envelope?.release || 3,
          },
          oscillator: { type: "triangle" }, // More piano-like than sine
        });
        break;
      }
      case "drone": {
        // Drone characteristics: very slow attack, long sustain
        synth.set({
          envelope: {
            attack: voice.envelope?.attack || 8,
            decay: 0,
            sustain: 1,
            release: voice.envelope?.release || 12,
          },
          oscillator: { type: "sawtooth" }, // Rich harmonic content for drones
        });
        break;
      }
      case "granular": {
        // Granular synthesis simulation with choppy envelope
        synth.set({
          envelope: {
            attack: 0.01,
            decay: voice.envelope?.decay || 0.1,
            sustain: voice.envelope?.sustain || 0.3,
            release: voice.envelope?.release || 0.2,
          },
          oscillator: { type: "square" },
        });
        break;
      }
      default: {
        synth.set({ oscillator: { type: voice.oscillator?.type || "sine" } });
        break;
      }
    }

    if (voice.count > 1 && voice.oscillator?.detuneRange) {
      this.applyVoiceDetuning(synth, voice.count, voice.oscillator.detuneRange);
    }
  }

  private applyVoiceDetuning(synth: Tone.PolySynth, voiceCount: number, detuneRange: number): void {
    // Create slight pitch variations for richer sound when multiple voices are specified
    // This simulates the effect of multiple slightly detuned oscillators
    const currentVolume = synth.volume.value;
    // Slightly reduce volume to compensate for multiple voices
    synth.volume.value = currentVolume - 3;

    // Store detune information for potential future use
    (synth as any)._voiceDetune = detuneRange;
    (synth as any)._voiceCount = voiceCount;
  }

  private applyTextureLayering(texture: Texture): void {
    if (!texture.structure?.layering) return;

    const layering = texture.structure.layering;
    const density = texture.structure.density || 1;

    for (const [type, instrument] of this.ambientInstruments.entries()) {
      if (this.state$.value.instruments.has(type)) {
        let volumeMultiplier = 1;

        switch (layering) {
          case "minimal": {
            volumeMultiplier = 0.8;
            break;
          }
          case "medium": {
            volumeMultiplier = 0.9;
            break;
          }
          case "dense": {
            volumeMultiplier = 0.7;
            break;
          }
        }

        const densityMultiplier = Math.max(0.3, 1 - (density * 0.05));
        const finalMultiplier = volumeMultiplier * densityMultiplier;

        if ("updateParams" in instrument) {
          // @ts-expect-error Different instrument types have different param structures
          instrument.updateParams({ volumeMultiplier: finalMultiplier });
        }
      }
    }

    this.applyGenerativePatterns(texture);
  }

  private applyGenerativePatterns(texture: Texture): void {
    if (!texture.structure?.generativePattern) return;

    const patternType = texture.structure.generativePattern as "random-walk" | "euclidean" | "static-drone" | "markov";
    const density = texture.structure.density || 0.5;
    const randomness = texture.structure.randomness || 0.3;
    const currentState = this.state$.value;
    const scale = this.currentScale$.value;
    const seed = currentState.randomization.seed || Math.random();

    const patterns = new Map(this.patterns$.value);
    let patternsUpdated = false;

    for (const kind of currentState.instruments) {
      if (!isAmbientInstrument(kind)) {
        const patternLength = getPatternLengthForType(kind, patternType);
        const newPattern = PatternRandomizer.generatePatternByType(
          patternType,
          kind,
          patternLength,
          scale,
          density,
          randomness,
          // Use instrument type as additional seed variation
          seed + Object.values(InstrumentType).indexOf(kind),
        );

        patterns.set(kind, newPattern);
        patternsUpdated = true;
      }
    }

    if (patternsUpdated) {
      this.patterns$.next(patterns);
    }
  }
}
