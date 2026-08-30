import * as Tone from 'tone';

import type { AudioBackend, AudioDocument, AudioParameterValue, AudioVoice, ScheduledNote, SoundId } from './types';
import { isSoundId } from './types';

type Trigger = (note: ScheduledNote) => void;

type VoiceGraph = { dispose(): void; trigger: Trigger };

/** Tone.js rendering backend for Ambiente's stable semantic sound palette. */
export class ToneAudioBackend implements AudioBackend {
	private document: AudioDocument = { tempo: '120/1', voices: [] };
	private readonly graphs = new Map<string, VoiceGraph>();

	/** Creates or replaces the runtime graph for each enabled canonical voice. */
	configure(document: AudioDocument): void {
		this.document = document;
		this.rebuild();
	}

	/** Unlocks or resumes the browser audio context from a user action. */
	async start(): Promise<void> {
		await Tone.start();
	}

	/** Returns audio-context time without Tone.js's additional look-ahead. */
	now(): number {
		return Tone.immediate();
	}

	/** Schedules one note on the graph selected by its canonical voice ID. */
	schedule(note: ScheduledNote): void {
		this.graphs.get(note.voiceId)?.trigger(note);
	}

	/** Cancels the current short horizon by replacing all disposable voice graphs. */
	reset(_at: number): void {
		this.rebuild();
	}

	/** Releases every graph and its Web Audio nodes. */
	dispose(): void {
		for (const graph of this.graphs.values()) graph.dispose();
		this.graphs.clear();
	}

	private rebuild(): void {
		this.dispose();
		for (const voice of this.document.voices) {
			if (voice.enabled) this.graphs.set(voice.id, createVoiceGraph(voice));
		}
	}
}

/** Values mapped from semantic voice parameters into one browser sound graph. */
export type SoundControls = Readonly<{ filterHz: number; gain: number; pan: number; reverb: number }>;

/**
 * Maps backend-independent integer controls to safe Web Audio ranges.
 * `gain` and `reverb` use 0–100; `pan` uses -100–100; `filter_hz` uses hertz.
 */
export function soundControls(parameters: Readonly<Record<string, AudioParameterValue>>): SoundControls {
	return {
		filterHz: clamp(integerParameter(parameters.filter_hz, 12_000), 80, 20_000),
		gain: clamp(integerParameter(parameters.gain, 80), 0, 100) / 100,
		pan: clamp(integerParameter(parameters.pan, 0), -100, 100) / 100,
		reverb: clamp(integerParameter(parameters.reverb, 15), 0, 100) / 100
	};
}

function createVoiceGraph(voice: AudioVoice): VoiceGraph {
	const sound = isSoundId(voice.sound) ? voice.sound : 'felt-piano';
	const controls = soundControls(voice.parameters);
	const filter = new Tone.Filter(controls.filterHz, 'lowpass');
	const panner = new Tone.Panner(controls.pan);
	const gain = new Tone.Gain(controls.gain);
	const reverb = new Tone.Reverb({ decay: reverbDecay(sound), wet: controls.reverb });
	filter.connect(panner);
	panner.connect(gain);
	gain.connect(reverb);
	reverb.toDestination();

	const instrument = createInstrument(sound);
	instrument.output.connect(filter);

	return {
		dispose: () => {
			instrument.dispose();
			filter.dispose();
			panner.dispose();
			gain.dispose();
			reverb.dispose();
		},
		trigger: instrument.trigger
	};
}

function createInstrument(sound: SoundId): VoiceGraph & { output: Tone.ToneAudioNode } {
	switch (sound) {
		case 'felt-piano': {
			const synth = new Tone.PolySynth(Tone.Synth, {
				envelope: { attack: 0.015, decay: 0.8, release: 1.8, sustain: 0.18 },
				oscillator: { type: 'triangle8' }
			});
			return pitchedInstrument(synth);
		}
		case 'glass': {
			const synth = new Tone.PolySynth(Tone.FMSynth, {
				envelope: { attack: 0.002, decay: 1.5, release: 2.5, sustain: 0.05 },
				harmonicity: 3.5,
				modulationIndex: 8
			});
			return pitchedInstrument(synth);
		}
		case 'warm-drone': {
			const synth = new Tone.PolySynth(Tone.MonoSynth, {
				envelope: { attack: 0.8, decay: 0.5, release: 3, sustain: 0.8 },
				filter: { Q: 1, rolloff: -24, type: 'lowpass' },
				filterEnvelope: {
					attack: 1.5,
					baseFrequency: 180,
					decay: 1,
					exponent: 2,
					octaves: 2,
					release: 3,
					sustain: 0.7
				},
				oscillator: { type: 'sine4' }
			});
			return pitchedInstrument(synth);
		}
		case 'soft-pluck': {
			const synth = new Tone.PluckSynth({ attackNoise: 0.7, dampening: 3200, resonance: 0.82 });
			return pitchedInstrument(synth);
		}
		case 'air': {
			const synth = new Tone.NoiseSynth({
				envelope: { attack: 0.25, decay: 0.5, release: 1.2, sustain: 0.4 },
				noise: { type: 'pink' }
			});
			return {
				dispose: () => synth.dispose(),
				output: synth,
				trigger: (note) => synth.triggerAttackRelease(note.duration, note.time, note.velocity)
			};
		}
		case 'percussion': {
			const synth = new Tone.MembraneSynth({
				envelope: { attack: 0.001, decay: 0.35, release: 0.15, sustain: 0 },
				octaves: 5,
				pitchDecay: 0.035
			});
			return pitchedInstrument(synth);
		}
	}
}

function pitchedInstrument(
	instrument: Tone.ToneAudioNode & {
		dispose(): unknown;
		triggerAttackRelease(
			note: Tone.Unit.Frequency,
			duration: Tone.Unit.Time,
			time?: Tone.Unit.Time,
			velocity?: number
		): unknown;
	}
): VoiceGraph & { output: Tone.ToneAudioNode } {
	return {
		dispose: () => instrument.dispose(),
		output: instrument,
		trigger: (note) => instrument.triggerAttackRelease(note.pitch, note.duration, note.time, note.velocity)
	};
}

function integerParameter(value: AudioParameterValue | undefined, fallback: number): number {
	return value?.type === 'integer' ? value.value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function reverbDecay(sound: SoundId): number {
	const decayBySound: Record<SoundId, number> = {
		air: 3,
		'felt-piano': 1.5,
		glass: 4,
		percussion: 1.5,
		'soft-pluck': 1.5,
		'warm-drone': 3
	};
	return decayBySound[sound];
}
