// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const clientDirectory = resolve(import.meta.dirname, '../dist/client');

async function builtPage(path: string): Promise<string> {
	return readFile(resolve(clientDirectory, path, 'index.html'), 'utf8');
}

describe('prerendered output', () => {
	test('emits the landing page and documentation as static HTML', async () => {
		await expect(builtPage('')).resolves.toContain('Compose the system.');
		const architecture = await builtPage('docs/architecture');
		expect(architecture).toContain('Ambiente uses one Rust model');
		expect(architecture).toContain('href="/docs/document-format"');
		await expect(builtPage('docs/solid-components')).resolves.toContain('Interactive documentation');
	});

	test('emits the Pagefind documentation index', async () => {
		const pagefind = await readFile(resolve(clientDirectory, 'pagefind/pagefind.js'), 'utf8');
		expect(pagefind).toContain('search');
	});

	test('emits a client-rendered Studio HTML shell', async () => {
		const studio = await builtPage('studio');
		expect(studio).toContain('<title>Studio — Ambiente</title>');
		expect(studio).not.toContain('Studio is in preview.');
	});
});
