import { describe, expect, test } from 'vitest';

import { SOUND_IDS } from '../src/types';
import { soundControls } from '../src/sounds';

describe('browser sounds', () => {
	test('publishes the complete stable semantic palette', () => {
		expect(SOUND_IDS).toEqual(['felt-piano', 'glass', 'warm-drone', 'soft-pluck', 'air', 'percussion']);
	});

	test('maps gain, pan, filter, and effects controls into safe ranges', () => {
		expect(
			soundControls({
				filter_hz: { type: 'integer', value: 25_000 },
				gain: { type: 'integer', value: 40 },
				pan: { type: 'integer', value: -25 },
				reverb: { type: 'integer', value: 130 }
			})
		).toEqual({ filterHz: 20_000, gain: 0.4, pan: -0.25, reverb: 1 });
	});
});
