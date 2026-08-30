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

		expect(application.inspect()).toEqual({
			documentId: '9f8d76b0-0dd1-4fea-9ad9-43ae8f94f860',
			materialCount: 1,
			seed: '000000000000002a',
			title: 'Cross-runtime study',
			voiceCount: 1
		});
		expect(application.validate()).toEqual([]);
		expect(application.queryEvents({ clock: 'metric', start: '0/1', end: '2/1' })).toEqual(expected);
		expect(application.apply({ kind: 'set_seed', payload: '000000000000002b' })).toEqual([]);
		expect(application.serialize()).toContain('"seed": "000000000000002b"');

		const beforeInvalidLoad = application.serialize();
		expect(application.load('{}')).toEqual([expect.objectContaining({ code: 'document.load', severity: 'error' })]);
		expect(application.serialize()).toBe(beforeInvalidLoad);
	});
});
