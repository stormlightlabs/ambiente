import * as Tone from 'tone';

import type { AudioBackend, AudioDocument, AudioParameterValue, AudioVoice, ScheduledNote, SoundId } from './types';
import { isSoundId } from './types';

type Trigger = (note: ScheduledNote) => void;

type VoiceGraph = {
	dispose(): void;
	previewNoteOff(pitch: number, at: number): void;
	previewNoteOn(pitch: number, velocity: number, at: number): void;
	trigger: Trigger;
};

/** Tone.js rendering backend for Ambiente's stable semantic sound palette. */
export class ToneAudioBackend implements AudioBackend {
	private document: AudioDocument = { tempo: '120/1', voices: [] };
	private readonly graphs = new Map<string, VoiceGraph>();
	private readonly output = new Tone.Gain(1).toDestination();

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

	/** Starts an unscheduled note for direct instrument input. */
	previewNoteOn(voiceId: string, pitch: number, velocity: number, at: number): void {
		this.graphs.get(voiceId)?.previewNoteOn(pitch, velocity, at);
	}

	/** Releases a note started by direct instrument input. */
	previewNoteOff(voiceId: string, pitch: number, at: number): void {
		this.graphs.get(voiceId)?.previewNoteOff(pitch, at);
	}

	/** Schedules one note on the graph selected by its canonical voice ID. */
	schedule(note: ScheduledNote): void {
		this.graphs.get(note.voiceId)?.trigger(note);
	}

	/** Sets the gain shared by every voice rendered through this backend. */
	setVolume(volume: number): void {
		this.output.gain.rampTo(Math.min(1, Math.max(0, volume)), 0.05);
	}

	/** Cancels the current short horizon by replacing all disposable voice graphs. */
	reset(_at: number): void {
		this.rebuild();
	}

	/** Releases every graph and its Web Audio nodes. */
	dispose(): void {
		this.disposeGraphs();
		this.output.dispose();
	}

	private disposeGraphs(): void {
		for (const graph of this.graphs.values()) graph.dispose();
		this.graphs.clear();
	}

	private rebuild(): void {
		this.disposeGraphs();
		for (const voice of this.document.voices) {
			if (voice.enabled) this.graphs.set(voice.id, createVoiceGraph(voice, this.output));
		}
	}
}

/** Values mapped from semantic voice parameters into one browser sound graph. */
export type SoundControls = Readonly<{
	delay: number;
	drive: number;
	filterHz: number;
	gain: number;
	motion: number;
	pan: number;
	reverb: number;
	width: number;
	wowFlutter: number;
}>;

/**
 * Maps backend-independent integer controls to safe Web Audio ranges.
 * Most effect controls use 0–100; `pan` uses -100–100; `filter_hz` uses hertz.
 * Gain follows a -36 dB to 0 dB curve so several voices can mix without each
 * midrange setting consuming half of the available linear headroom.
 */
export function soundControls(parameters: Readonly<Record<string, AudioParameterValue>>): SoundControls {
	return {
		delay: clamp(integerParameter(parameters.delay, 0), 0, 100) / 100,
		drive: clamp(integerParameter(parameters.drive, 0), 0, 100) / 100,
		filterHz: clamp(integerParameter(parameters.filter_hz, 12_000), 80, 20_000),
		gain: semanticGain(integerParameter(parameters.gain, 80)),
		motion: clamp(integerParameter(parameters.motion, 0), 0, 100) / 100,
		pan: clamp(integerParameter(parameters.pan, 0), -100, 100) / 100,
		reverb: clamp(integerParameter(parameters.reverb, 15), 0, 100) / 100,
		width: clamp(integerParameter(parameters.width, 0), 0, 100) / 100,
		wowFlutter: clamp(integerParameter(parameters.wow_flutter, 0), 0, 100) / 100
	};
}

function createVoiceGraph(voice: AudioVoice, output: Tone.Gain): VoiceGraph {
	const sound = isSoundId(voice.sound) ? voice.sound : 'felt-piano';
	const controls = soundControls(voice.parameters);
	const filter = new Tone.Filter(controls.filterHz, 'lowpass');
	const drive = new Tone.Distortion({ distortion: controls.drive * 0.28, oversample: '2x', wet: controls.drive });
	const wowFlutter = new Tone.Chorus({
		depth: 0.08 + controls.wowFlutter * 0.16,
		delayTime: 8,
		frequency: 0.12 + controls.wowFlutter * 0.28,
		spread: 0,
		wet: controls.wowFlutter * 0.18
	}).start();
	const panner = new Tone.Panner(controls.pan);
	const gain = new Tone.Gain(controls.gain);
	const delay = new Tone.FeedbackDelay({ delayTime: 0.375, feedback: 0.18, wet: controls.delay * 0.35 });
	const reverb = new Tone.Reverb({ decay: reverbDecay(sound), wet: controls.reverb });
	const safeWidth = sound === 'warm-drone' ? Math.min(0.25, controls.width * 0.5) : controls.width * 0.65;
	const widener = new Tone.StereoWidener(safeWidth);
	filter.chain(drive, wowFlutter, panner, gain, delay, reverb, widener, output);

	const instrument = createInstrument(sound);
	instrument.output.connect(filter);
	const modulation = createSlowModulation(controls, filter, panner);

	return {
		dispose: () => {
			modulation?.dispose();
			instrument.dispose();
			filter.dispose();
			drive.dispose();
			wowFlutter.dispose();
			panner.dispose();
			gain.dispose();
			delay.dispose();
			reverb.dispose();
			widener.dispose();
		},
		previewNoteOff: instrument.previewNoteOff,
		previewNoteOn: instrument.previewNoteOn,
		trigger: instrument.trigger
	};
}

function createSlowModulation(
	controls: SoundControls,
	filter: Tone.Filter,
	panner: Tone.Panner
): { dispose(): void } | undefined {
	if (controls.motion === 0) return;

	const cycleSeconds = 150 - controls.motion * 120;
	const filterDepth = 0.08 + controls.motion * 0.22;
	const filterMotion = new Tone.LFO({
		frequency: 1 / cycleSeconds,
		max: Math.min(20_000, controls.filterHz * (1 + filterDepth)),
		min: Math.max(80, controls.filterHz * (1 - filterDepth)),
		type: 'sine'
	});
	const panDepth = 0.04 + controls.motion * 0.16;
	const panMotion = new Tone.LFO({
		frequency: 1 / (cycleSeconds * 1.618),
		max: Math.min(1, controls.pan + panDepth),
		min: Math.max(-1, controls.pan - panDepth),
		type: 'sine'
	});
	filterMotion.connect(filter.frequency).start();
	panMotion.connect(panner.pan).start();
	return {
		dispose: () => {
			filterMotion.dispose();
			panMotion.dispose();
		}
	};
}

function createInstrument(sound: SoundId): VoiceGraph & { output: Tone.ToneAudioNode } {
	switch (sound) {
		case 'felt-piano': {
			const synth = new Tone.PolySynth(Tone.Synth, {
				envelope: { attack: 0.015, decay: 0.8, release: 1.8, sustain: 0.18 },
				oscillator: { type: 'triangle8' }
			});
			return pitchedInstrument(synth, (pitch, at) => synth.triggerRelease(midiFrequency(pitch), at));
		}
		case 'glass': {
			const synth = new Tone.PolySynth(Tone.FMSynth, {
				envelope: { attack: 0.002, decay: 1.5, release: 2.5, sustain: 0.05 },
				harmonicity: 3.5,
				modulationIndex: 8
			});
			return pitchedInstrument(synth, (pitch, at) => synth.triggerRelease(midiFrequency(pitch), at));
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
			return pitchedInstrument(synth, (pitch, at) => synth.triggerRelease(midiFrequency(pitch), at));
		}
		case 'soft-pluck': {
			const synth = new Tone.PluckSynth({ attackNoise: 0.7, dampening: 3200, resonance: 0.82 });
			return pitchedInstrument(synth, (_pitch, at) => synth.triggerRelease(at));
		}
		case 'air': {
			const synth = new Tone.NoiseSynth({
				envelope: { attack: 0.25, decay: 0.5, release: 1.2, sustain: 0.4 },
				noise: { type: 'pink' }
			});
			return {
				dispose: () => synth.dispose(),
				output: synth,
				previewNoteOff: (_pitch, at) => synth.triggerRelease(at),
				previewNoteOn: (_pitch, velocity, at) => synth.triggerAttack(at, velocity),
				trigger: (note) => synth.triggerAttackRelease(note.duration, note.time, note.velocity)
			};
		}
		case 'percussion': {
			const synth = new Tone.MembraneSynth({
				envelope: { attack: 0.001, decay: 0.35, release: 0.15, sustain: 0 },
				octaves: 5,
				pitchDecay: 0.035
			});
			return pitchedInstrument(synth, (_pitch, at) => synth.triggerRelease(at));
		}
		case 'broad-pad': {
			const synth = new Tone.PolySynth(Tone.AMSynth, {
				envelope: { attack: 1.8, decay: 1.2, release: 5, sustain: 0.72 },
				harmonicity: 1.5,
				modulationEnvelope: { attack: 2.4, decay: 1.5, release: 4, sustain: 0.45 },
				oscillator: { type: 'sine4' }
			});
			return pitchedInstrument(synth, (pitch, at) => synth.triggerRelease(midiFrequency(pitch), at));
		}
	}
}

function pitchedInstrument(
	instrument: Tone.ToneAudioNode & {
		dispose(): unknown;
		triggerAttack(note: Tone.Unit.Frequency, time?: Tone.Unit.Time, velocity?: number): unknown;
		triggerAttackRelease(
			note: Tone.Unit.Frequency,
			duration: Tone.Unit.Time,
			time?: Tone.Unit.Time,
			velocity?: number
		): unknown;
	},
	release: (pitch: number, at: number) => unknown
): VoiceGraph & { output: Tone.ToneAudioNode } {
	return {
		dispose: () => instrument.dispose(),
		output: instrument,
		previewNoteOff: release,
		previewNoteOn: (pitch, velocity, at) => instrument.triggerAttack(midiFrequency(pitch), at, velocity),
		trigger: (note) =>
			instrument.triggerAttackRelease(midiFrequency(note.pitch), note.duration, note.time, note.velocity)
	};
}

/** Converts Ambiente's chromatic semitone pitch to the frequency expected by Tone.js. */
export function midiFrequency(pitch: number): number {
	return 440 * 2 ** ((pitch - 69) / 12);
}

function semanticGain(value: number): number {
	const normalized = clamp(value, 0, 100);
	return normalized === 0 ? 0 : Tone.dbToGain(-36 + normalized * 0.36);
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
		'warm-drone': 3,
		'broad-pad': 5
	};
	return decayBySound[sound];
}
