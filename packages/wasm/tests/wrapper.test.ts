import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

import { WasmApplication } from '../src/index';

const fixture = new URL('../../../crates/wasm/tests/fixtures/', import.meta.url);

describe('WASM application', () => {
	test('loads, inspects, serializes, edits, validates, and queries through Rust', async () => {
		const document = await readFile(new URL('conformance-document.json', fixture), 'utf8');
		const expected = JSON.parse(await readFile(new URL('conformance-events.json', fixture), 'utf8')) as unknown;
		const module = await readFile(new URL('../generated/ambiente_wasm_bg.wasm', import.meta.url));
		const application = await WasmApplication.create(document, module);

		expect(application.inspect()).toMatchObject({
			documentId: '9f8d76b0-0dd1-4fea-9ad9-43ae8f94f860',
			materialCount: 1,
			materials: [{ id: '313b2f8d-8c00-4d82-82f6-cdb7aeb112de', name: 'Pulse', type: 'step_pattern' }],
			seed: '000000000000002a',
			tempo: '120/1',
			title: 'Cross-runtime study',
			voiceCount: 1,
			voices: [
				{
					enabled: true,
					id: '826b8913-4c23-43e1-b150-594737909a58',
					materialId: '313b2f8d-8c00-4d82-82f6-cdb7aeb112de',
					name: 'Piano',
					parameters: {},
					sound: 'felt-piano'
				}
			]
		});
		expect(application.validate()).toEqual([]);
		expect(application.queryEvents({ clock: 'metric', start: '0/1', end: '2/1' })).toEqual(expected);
		const repeated = application.queryEvents({ clock: 'metric', start: '2/1', end: '4/1' });
		expect(repeated).toHaveLength(4);
		expect(repeated[0]?.span.start.value).toBe('2/1');
		expect(application.apply({ kind: 'set_seed', payload: '000000000000002b' })).toEqual([]);
		expect(application.apply({ kind: 'set_tempo', payload: '96/1' })).toEqual([]);
		expect(
			application.apply({
				kind: 'configure_step_pattern',
				payload: {
					material_id: '313b2f8d-8c00-4d82-82f6-cdb7aeb112de',
					pitches: [72, 67, 60],
					steps: 16,
					subdivision: '1/4'
				}
			})
		).toEqual([]);
		const configured = application.inspect();
		expect(configured).toMatchObject({ seed: '000000000000002b', tempo: '96/1' });
		const configuredMaterial = configured.materials[0];
		expect(configuredMaterial?.type).toBe('step_pattern');
		if (configuredMaterial?.type === 'step_pattern') {
			expect(configuredMaterial.pattern).toMatchObject({ steps: 16, subdivision: '1/4' });
			expect(configuredMaterial.pattern.rows.map((row) => row.pitch)).toEqual([72, 67, 60]);
		}

		const created = await WasmApplication.createNew('Fresh piece');
		expect(created.inspect()).toMatchObject({ materialCount: 0, tempo: '120/1', title: 'Fresh piece', voiceCount: 0 });

		const study = await WasmApplication.createStudy('pattern');
		expect(study.inspect()).toMatchObject({ materialCount: 2, title: 'Pattern Study', voiceCount: 4 });
		expect(study.queryEvents({ clock: 'metric', start: '0/1', end: '8/1' }).length).toBeGreaterThan(10);

		const beforeInvalidLoad = application.serialize();
		expect(application.load('{}')).toEqual([expect.objectContaining({ code: 'document.load', severity: 'error' })]);
		expect(application.serialize()).toBe(beforeInvalidLoad);
	});
});
