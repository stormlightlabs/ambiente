import { describe, expect, test } from 'vitest';

import { documentation, headingsFromHtml } from '../src/content/docs';

describe('documentation discovery', () => {
	test('derives stable routes from the canonical content directory', () => {
		expect(documentation.map((entry) => entry.path)).toContain('/docs/instrument-studio');
		expect(documentation.map((entry) => entry.path)).toContain('/docs/architecture');
		expect(documentation.map((entry) => entry.path)).toContain('/docs/three-studies');
		expect(documentation.map((entry) => entry.path)).not.toContain('/docs/solid-components');
	});

	test('collects Sätteri heading anchors for page navigation', () => {
		expect(headingsFromHtml('<h1 id="overview">Overview</h1><h2 id="next">Next <code>step</code></h2>')).toEqual([
			{ depth: 1, id: 'overview', text: 'Overview' },
			{ depth: 2, id: 'next', text: 'Next step' }
		]);
	});
});
