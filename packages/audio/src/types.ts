import type { AmbienteApplication, ApplicationEvent } from '@ambiente/wasm';

/** Stable semantic IDs for the browser sound palette. */
export const SOUND_IDS = ['felt-piano', 'glass', 'warm-drone', 'soft-pluck', 'air', 'percussion'] as const;

/** One stable semantic browser sound ID. */
export type SoundId = (typeof SOUND_IDS)[number];

/** Persisted backend-independent voice parameter values exposed by Rust. */
export type AudioParameterValue =
	| Readonly<{ type: 'boolean'; value: boolean }>
	| Readonly<{ type: 'integer'; value: number }>
	| Readonly<{ type: 'text'; value: string }>;

/** Playback settings for one canonical voice. */
export type AudioVoice = Readonly<{
	enabled: boolean;
	id: string;
	parameters: Readonly<Record<string, AudioParameterValue>>;
	sound: string;
}>;

/** Canonical playback metadata returned by the Rust facade. */
export type AudioDocument = Readonly<{ tempo: string; voices: readonly AudioVoice[] }>;

/** The Rust-backed application methods needed for audio playback. */
export type AudioEventSource = Pick<AmbienteApplication, 'inspect' | 'queryEvents'>;

/** Current browser transport state. */
export type TransportState = 'paused' | 'playing' | 'starting' | 'stopped';

/** A note translated to audio-context seconds for a rendering backend. */
export type ScheduledNote = Readonly<{
	duration: number;
	pitch: number;
	time: number;
	velocity: number;
	voiceId: string;
}>;

/** A rendering boundary used by the look-ahead scheduler. */
export type AudioBackend = {
	configure(document: AudioDocument): void;
	dispose(): void;
	now(): number;
	previewNoteOff(voiceId: string, pitch: number, at: number): void;
	previewNoteOn(voiceId: string, pitch: number, velocity: number, at: number): void;
	reset(at: number): void;
	schedule(note: ScheduledNote): void;
	setVolume(volume: number): void;
	start(): Promise<void>;
};

/** Timer boundary used to test scheduling without waiting on wall-clock time. */
export type SchedulerTimer = {
	clearInterval(id: ReturnType<typeof setInterval>): void;
	setInterval(callback: () => void, milliseconds: number): ReturnType<typeof setInterval>;
};

/** Runtime tuning values for short-horizon scheduling. */
export type SchedulerOptions = Readonly<{
	intervalSeconds?: number;
	latencySeconds?: number;
	lookAheadSeconds?: number;
	timer?: SchedulerTimer;
}>;

/** A listener called when transport state or position changes. */
export type TransportListener = (state: TransportState, positionSeconds: number) => void;

/** Returns whether a string is one of the built-in semantic sound IDs. */
export function isSoundId(value: string): value is SoundId {
	return (SOUND_IDS as readonly string[]).includes(value);
}

/** Builds a stable identity for an event returned by overlapping queries. */
export function eventIdentity(event: ApplicationEvent): string {
	return JSON.stringify([event.span, event.target, event.kind, event.source]);
}
