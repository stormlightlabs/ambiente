import { describe, expect, test } from 'vitest';

import { ShellFixtureApplication } from './shell-fixture';

describe('shell fixture application', () => {
	test('passes serialized documents through without interpreting them', () => {
		const application = new ShellFixtureApplication();
		const document = '{"format":"ambiente","schema_version":2}';

		expect(application.load(document)).toEqual([]);
		expect(application.serialize()).toBe(document);
	});

	test('does not emulate canonical document operations', () => {
		const application = new ShellFixtureApplication();

		expect(application.apply({ kind: 'set_step' })).toEqual([
			expect.objectContaining({ code: 'shell.fixture.read_only', severity: 'warning' })
		]);
		expect(application.queryEvents({ clock: 'metric', start: '0/1', end: '4/1' })).toEqual([]);
	});
});
