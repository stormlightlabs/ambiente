import type { ApplicationEvent, ApplicationTimePoint } from '@ambiente/wasm';

import type {
	AudioBackend,
	AudioDocument,
	AudioEventSource,
	SchedulerOptions,
	SchedulerTimer,
	TransportListener,
	TransportState
} from './types';
import { eventIdentity } from './types';

const DEFAULT_INTERVAL_SECONDS = 0.025;
const DEFAULT_LATENCY_SECONDS = 0.02;
const DEFAULT_LOOK_AHEAD_SECONDS = 0.1;
const QUERY_RESOLUTION = 1_000_000;

const browserTimer: SchedulerTimer = {
	clearInterval: (id) => globalThis.clearInterval(id),
	setInterval: (callback, milliseconds) => globalThis.setInterval(callback, milliseconds)
};

/**
 * Pulls deterministic events from Rust over a short horizon and schedules them
 * against an audio-context clock.
 */
export class LookAheadScheduler {
	private readonly intervalSeconds: number;
	private readonly latencySeconds: number;
	private readonly heldPreviewNotes = new Set<string>();
	private readonly listeners = new Set<TransportListener>();
	private readonly lookAheadSeconds: number;
	private readonly scheduledEvents = new Map<string, number>();
	private readonly timer: SchedulerTimer;
	private anchorAudioTime = 0;
	private anchorPosition = 0;
	private intervalId: ReturnType<typeof setInterval> | undefined;
	private queryEnd = 0;
	private stateValue: TransportState = 'stopped';
	private tempo = 120;

	/** Creates a scheduler without starting or unlocking browser audio. */
	constructor(
		private readonly source: AudioEventSource,
		private readonly backend: AudioBackend,
		options: SchedulerOptions = {}
	) {
		this.intervalSeconds = positive(options.intervalSeconds, DEFAULT_INTERVAL_SECONDS);
		this.latencySeconds = nonNegative(options.latencySeconds, DEFAULT_LATENCY_SECONDS);
		this.lookAheadSeconds = positive(options.lookAheadSeconds, DEFAULT_LOOK_AHEAD_SECONDS);
		this.timer = options.timer ?? browserTimer;
		this.readDocument();
	}

	/** Returns the current transport state. */
	get state(): TransportState {
		return this.stateValue;
	}

	/** Returns the current musical position in elapsed seconds. */
	get positionSeconds(): number {
		return this.stateValue === 'playing'
			? Math.max(0, this.anchorPosition + this.backend.now() - this.anchorAudioTime)
			: this.anchorPosition;
	}

	/** Starts playback or resumes it from the preserved position. */
	async play(): Promise<void> {
		if (this.stateValue === 'playing' || this.stateValue === 'starting') return;
		this.setState('starting');
		try {
			await this.backend.start();
		} catch (error) {
			this.setState(this.anchorPosition === 0 ? 'stopped' : 'paused');
			throw error;
		}
		this.readDocument();
		this.anchorAudioTime = this.backend.now() + this.latencySeconds;
		this.queryEnd = this.anchorPosition;
		this.setState('playing');
		this.fillHorizon();
		this.intervalId = this.timer.setInterval(() => this.fillHorizon(), this.intervalSeconds * 1000);
	}

	/** Starts a note immediately on a canonical voice for piano and other direct input. */
	async previewNoteOn(voiceId: string, pitch: number, velocity = 100 / 127): Promise<void> {
		const identity = previewIdentity(voiceId, pitch);
		if (this.heldPreviewNotes.has(identity)) return;
		this.heldPreviewNotes.add(identity);
		try {
			await this.backend.start();
			if (this.heldPreviewNotes.has(identity)) {
				this.backend.previewNoteOn(voiceId, pitch, velocity, this.backend.now());
			}
		} catch (error) {
			this.heldPreviewNotes.delete(identity);
			throw error;
		}
	}

	/** Releases a note started by direct input. */
	previewNoteOff(voiceId: string, pitch: number): void {
		const identity = previewIdentity(voiceId, pitch);
		if (!this.heldPreviewNotes.delete(identity)) return;
		this.backend.previewNoteOff(voiceId, pitch, this.backend.now());
	}

	/** Pauses playback while preserving the current musical position. */
	pause(): void {
		if (this.stateValue !== 'playing') return;
		this.anchorPosition = this.positionSeconds;
		this.stopScheduling();
		this.backend.reset(this.backend.now());
		this.setState('paused');
	}

	/** Stops playback, releases audio, and returns to time zero. */
	stop(): void {
		this.stopScheduling();
		this.backend.reset(this.backend.now());
		this.anchorPosition = 0;
		this.queryEnd = 0;
		this.scheduledEvents.clear();
		this.setState('stopped');
	}

	/** Sets this scheduler's output volume from silence at zero to unity at one. */
	setVolume(volume: number): void {
		if (!Number.isFinite(volume)) throw new RangeError('volume must be finite');
		this.backend.setVolume(Math.min(1, Math.max(0, volume)));
	}

	/** Seeks to an elapsed-second position and rebuilds the short active horizon. */
	seek(positionSeconds: number): void {
		if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
			throw new RangeError('seek position must be a finite non-negative number');
		}
		const wasPlaying = this.stateValue === 'playing';
		this.stopScheduling();
		this.backend.reset(this.backend.now());
		this.anchorPosition = positionSeconds;
		this.queryEnd = positionSeconds;
		this.scheduledEvents.clear();
		if (wasPlaying) {
			this.anchorAudioTime = this.backend.now() + this.latencySeconds;
			this.setState('playing');
			this.fillHorizon();
			this.intervalId = this.timer.setInterval(() => this.fillHorizon(), this.intervalSeconds * 1000);
		} else {
			this.setState(positionSeconds === 0 ? 'stopped' : 'paused');
		}
	}

	/**
	 * Reloads tempo, voices, and parameters after a canonical document edit.
	 * Running playback keeps its position and reschedules only the short horizon.
	 */
	refreshDocument(): void {
		const position = this.positionSeconds;
		const wasPlaying = this.stateValue === 'playing';
		this.stopScheduling();
		this.backend.reset(this.backend.now());
		this.readDocument();
		this.anchorPosition = position;
		this.queryEnd = position;
		this.scheduledEvents.clear();
		if (wasPlaying) {
			this.anchorAudioTime = this.backend.now() + this.latencySeconds;
			this.setState('playing');
			this.fillHorizon();
			this.intervalId = this.timer.setInterval(() => this.fillHorizon(), this.intervalSeconds * 1000);
		}
	}

	/** Subscribes to transport changes and returns an unsubscribe function. */
	subscribe(listener: TransportListener): () => void {
		this.listeners.add(listener);
		listener(this.stateValue, this.positionSeconds);
		return () => this.listeners.delete(listener);
	}

	/** Stops timers, releases audio nodes, and removes listeners. */
	dispose(): void {
		this.heldPreviewNotes.clear();
		this.stopScheduling();
		this.backend.dispose();
		this.listeners.clear();
	}

	private fillHorizon(): void {
		if (this.stateValue !== 'playing') return;
		const position = this.positionSeconds;
		for (const [identity, end] of this.scheduledEvents) {
			if (end <= position) this.scheduledEvents.delete(identity);
		}
		const targetEnd = position + this.lookAheadSeconds;
		if (targetEnd <= this.queryEnd) return;

		const windowStart = this.queryEnd;
		const events = [
			...this.source.queryEvents({
				clock: 'metric',
				start: secondsToExact((windowStart * this.tempo) / 60),
				end: secondsToExact((targetEnd * this.tempo) / 60)
			}),
			...this.source.queryEvents({
				clock: 'absolute',
				start: secondsToExact(windowStart),
				end: secondsToExact(targetEnd)
			})
		];
		for (const event of events) this.scheduleEvent(event, position);
		this.queryEnd = targetEnd;
		this.emit();
	}

	private scheduleEvent(event: ApplicationEvent, position: number): void {
		if (event.kind.type !== 'note' || event.target.type !== 'voice') return;
		const identity = eventIdentity(event);
		if (this.scheduledEvents.has(identity)) return;

		const start = this.toSeconds(event.span.start);
		const end = this.toSeconds(event.span.end);
		const audibleStart = Math.max(start, position);
		if (end <= audibleStart) return;
		this.scheduledEvents.set(identity, end);
		this.backend.schedule({
			duration: end - audibleStart,
			pitch: event.kind.note.pitch,
			time: this.anchorAudioTime + audibleStart - this.anchorPosition,
			velocity: event.kind.note.velocity / 127,
			voiceId: event.target.id
		});
	}

	private toSeconds(point: ApplicationTimePoint): number {
		const value = exactToNumber(point.value);
		return point.clock === 'metric' ? (value * 60) / this.tempo : value;
	}

	private readDocument(): void {
		const inspection = this.source.inspect();
		this.tempo = exactToNumber(inspection.tempo);
		if (!Number.isFinite(this.tempo) || this.tempo <= 0) throw new Error('document tempo must be positive');
		const document: AudioDocument = { tempo: inspection.tempo, voices: inspection.voices };
		this.backend.configure(document);
	}

	private stopScheduling(): void {
		if (this.intervalId !== undefined) {
			this.timer.clearInterval(this.intervalId);
			this.intervalId = undefined;
		}
	}

	private setState(state: TransportState): void {
		this.stateValue = state;
		this.emit();
	}

	private emit(): void {
		for (const listener of this.listeners) listener(this.stateValue, this.positionSeconds);
	}
}

function previewIdentity(voiceId: string, pitch: number): string {
	return `${voiceId}:${pitch}`;
}

function exactToNumber(value: string): number {
	const [numerator, denominator, ...rest] = value.split('/').map(Number);
	if (rest.length > 0 || numerator === undefined || denominator === undefined || denominator === 0) {
		throw new Error(`invalid exact value: ${value}`);
	}
	return numerator / denominator;
}

function secondsToExact(value: number): string {
	const numerator = Math.max(0, Math.round(value * QUERY_RESOLUTION));
	const divisor = greatestCommonDivisor(numerator, QUERY_RESOLUTION);
	return `${numerator / divisor}/${QUERY_RESOLUTION / divisor}`;
}

function greatestCommonDivisor(left: number, right: number): number {
	while (right !== 0) [left, right] = [right, left % right];
	return left;
}

function positive(value: number | undefined, fallback: number): number {
	return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegative(value: number | undefined, fallback: number): number {
	return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}
