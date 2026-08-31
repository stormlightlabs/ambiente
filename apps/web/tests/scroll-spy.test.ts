import { describe, expect, test } from 'vitest';

import { findActiveHeading, type HeadingPosition, type ViewportPosition } from '../content/scroll-spy';

const headings: HeadingPosition[] = [
	{ id: 'first', scrollMarginTop: 32, top: 400 },
	{ id: 'second', scrollMarginTop: 32, top: 900 },
	{ id: 'third', scrollMarginTop: 32, top: 1400 }
];

function viewport(overrides: Partial<ViewportPosition> = {}): ViewportPosition {
	return { documentHeight: 2200, height: 700, scrollY: 0, ...overrides };
}

describe('findActiveHeading', () => {
	test('leaves the table of contents inactive above the first section', () => {
		expect(findActiveHeading(headings, viewport({ scrollY: 360 }))).toBeNull();
	});

	test('selects the last heading above the reading position', () => {
		expect(findActiveHeading(headings, viewport({ scrollY: 865 }))).toBe('second');
	});

	test('selects the final heading at the bottom of the page', () => {
		expect(findActiveHeading(headings, viewport({ height: 700, scrollY: 1500 }))).toBe('third');
	});

	test('handles a page without section headings', () => {
		expect(findActiveHeading([], viewport())).toBeNull();
	});
});
