import { describe, expect, test } from 'vitest';

import { LookAheadScheduler } from '../src/scheduler';
import type { AudioBackend, AudioDocument, AudioEventSource, ScheduledNote, SchedulerTimer } from '../src/types';

const event = {
	kind: { note: { pitch: 60, velocity: 100 }, type: 'note' as const },
	properties: {},
	source: { material_id: 'material', row: 0, step: 0, type: 'step_cell' },
	span: { end: { clock: 'metric' as const, value: '1/2' }, start: { clock: 'metric' as const, value: '0/1' } },
	target: { id: 'voice', type: 'voice' as const }
};

class FakeBackend implements AudioBackend {
	configured: AudioDocument[] = [];
	disposed = false;
	notes: ScheduledNote[] = [];
	previewed: string[] = [];
	resets = 0;
	time = 0;
	volumes: number[] = [];

	configure(document: AudioDocument): void {
		this.configured.push(document);
	}

	dispose(): void {
		this.disposed = true;
	}

	now(): number {
		return this.time;
	}

	previewNoteOff(voiceId: string, pitch: number): void {
		this.previewed.push(`off:${voiceId}:${pitch}`);
	}

	previewNoteOn(voiceId: string, pitch: number): void {
		this.previewed.push(`on:${voiceId}:${pitch}`);
	}

	reset(): void {
		this.resets += 1;
	}

	schedule(note: ScheduledNote): void {
		this.notes.push(note);
	}

	setVolume(volume: number): void {
		this.volumes.push(volume);
	}

	startError: Error | undefined;

	async start(): Promise<void> {
		if (this.startError) throw this.startError;
	}
}

class FakeTimer implements SchedulerTimer {
	callback: (() => void) | undefined;
	cleared = false;

	clearInterval(): void {
		this.cleared = true;
	}

	setInterval(callback: () => void): ReturnType<typeof setInterval> {
		this.callback = callback;
		return 1 as unknown as ReturnType<typeof setInterval>;
	}
}

function source(): AudioEventSource {
	return {
		inspect: () => ({
			documentId: 'document',
			materialCount: 1,
			materials: [],
			macros: [],
			purposePresets: [],
			seed: '000000000000002a',
			tempo: '120/1',
			title: 'Study',
			voiceCount: 1,
			voices: [
				{
					enabled: true,
					id: 'voice',
					materialId: null,
					name: 'Piano',
					parameters: {},
					pattern: null,
					sound: 'felt-piano'
				}
			]
		}),
		queryEvents: (query) => (query.clock === 'metric' ? [event] : [])
	};
}

describe('look-ahead scheduler', () => {
	test('starts from a user action and schedules Rust events over a short horizon', async () => {
		const backend = new FakeBackend();
		const timer = new FakeTimer();
		const scheduler = new LookAheadScheduler(source(), backend, { latencySeconds: 0.02, lookAheadSeconds: 0.1, timer });

		await scheduler.play();

		expect(scheduler.state).toBe('playing');
		expect(backend.notes).toEqual([
			expect.objectContaining({ duration: 0.25, pitch: 60, time: 0.02, voiceId: 'voice' })
		]);
		expect(timer.callback).toBeTypeOf('function');

		backend.time = 0.05;
		timer.callback?.();
		expect(backend.notes).toHaveLength(1);
	});

	test('previews direct input without starting the transport', async () => {
		const backend = new FakeBackend();
		const scheduler = new LookAheadScheduler(source(), backend);

		await scheduler.previewNoteOn('voice', 64);
		scheduler.previewNoteOff('voice', 64);

		expect(scheduler.state).toBe('stopped');
		expect(backend.previewed).toEqual(['on:voice:64', 'off:voice:64']);
	});

	test('pauses, resumes, seeks, stops, and refreshes a running document', async () => {
		const backend = new FakeBackend();
		const timer = new FakeTimer();
		const scheduler = new LookAheadScheduler(source(), backend, { latencySeconds: 0, timer });
		await scheduler.play();

		backend.time = 0.1;
		scheduler.pause();
		expect(scheduler.state).toBe('paused');
		expect(scheduler.positionSeconds).toBeCloseTo(0.1);

		await scheduler.play();
		scheduler.seek(0.25);
		expect(scheduler.positionSeconds).toBeCloseTo(0.25);
		expect(scheduler.state).toBe('playing');

		scheduler.refreshDocument();
		expect(backend.configured).toHaveLength(4);
		expect(scheduler.state).toBe('playing');

		scheduler.stop();
		expect(scheduler.state).toBe('stopped');
		expect(scheduler.positionSeconds).toBe(0);
		expect(backend.resets).toBeGreaterThanOrEqual(3);
	});

	test('sets and clamps backend volume', () => {
		const backend = new FakeBackend();
		const scheduler = new LookAheadScheduler(source(), backend);

		scheduler.setVolume(0.65);
		scheduler.setVolume(2);
		expect(backend.volumes).toEqual([0.65, 1]);
		expect(() => scheduler.setVolume(Number.NaN)).toThrow(RangeError);
	});

	test('recovers from a failed audio-context start and releases nodes on disposal', async () => {
		const backend = new FakeBackend();
		backend.startError = new Error('context suspended');
		const scheduler = new LookAheadScheduler(source(), backend);

		await expect(scheduler.play()).rejects.toThrow('context suspended');
		expect(scheduler.state).toBe('stopped');
		backend.startError = undefined;
		await scheduler.play();
		expect(scheduler.state).toBe('playing');

		scheduler.dispose();
		expect(backend.disposed).toBe(true);
		expect(backend.resets).toBeGreaterThan(0);
	});

	test('rejects invalid seek positions', () => {
		const scheduler = new LookAheadScheduler(source(), new FakeBackend());
		expect(() => scheduler.seek(-1)).toThrow(RangeError);
	});
});
