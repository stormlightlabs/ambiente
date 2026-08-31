import { describe, expect, test } from 'vitest';

import { SOUND_FAMILIES, SOUND_IDS } from '../src/types';
import { midiFrequency, soundControls } from '../src/sounds';

describe('browser sounds', () => {
	test('publishes the complete stable semantic palette', () => {
		expect(SOUND_IDS).toEqual(['felt-piano', 'glass', 'warm-drone', 'soft-pluck', 'air', 'percussion', 'broad-pad']);
		expect(SOUND_FAMILIES['broad-pad']).toEqual({ family: 'pad', role: 'Broad sustained harmony' });
	});

	test('maps gain, pan, filter, and effects controls into safe ranges', () => {
		expect(
			soundControls({
				filter_hz: { type: 'integer', value: 25_000 },
				gain: { type: 'integer', value: 40 },
				pan: { type: 'integer', value: -25 },
				reverb: { type: 'integer', value: 130 }
			})
		).toEqual({
			delay: 0,
			drive: 0,
			filterHz: 20_000,
			gain: expect.any(Number),
			motion: 0,
			pan: -0.25,
			reverb: 1,
			width: 0,
			wowFlutter: 0
		});
		expect(soundControls({ gain: { type: 'integer', value: 40 } }).gain).toBeCloseTo(0.083, 3);
		expect(soundControls({ gain: { type: 'integer', value: 0 } }).gain).toBe(0);
		expect(soundControls({ gain: { type: 'integer', value: 100 } }).gain).toBe(1);
	});

	test('maps slow motion and chromatic pitches at the audio boundary', () => {
		expect(
			soundControls({
				delay: { type: 'integer', value: 25 },
				drive: { type: 'integer', value: 20 },
				motion: { type: 'integer', value: 30 },
				width: { type: 'integer', value: 40 },
				wow_flutter: { type: 'integer', value: 15 }
			})
		).toMatchObject({ delay: 0.25, drive: 0.2, motion: 0.3, width: 0.4, wowFlutter: 0.15 });
		expect(midiFrequency(69)).toBe(440);
		expect(midiFrequency(60)).toBeCloseTo(261.626, 3);
	});
});
