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
		await expect(builtPage('')).resolves.toContain('Algorithmic Ambient Composition');
		const architecture = await builtPage('docs/architecture');
		expect(architecture).toContain('Ambiente keeps persisted musical state');
		expect(architecture).toContain('href="/docs/document-format"');
		await expect(builtPage('docs/three-studies')).resolves.toContain('Three Studies');
		await expect(builtPage('examples')).resolves.toContain('Hear Ambiente’s musical building blocks');
	});

	test('emits the Pagefind documentation index', async () => {
		const pagefind = await readFile(resolve(clientDirectory, 'pagefind/pagefind.js'), 'utf8');
		expect(pagefind).toContain('search');
	});

	test('emits client-rendered Listen and Studio HTML shells', async () => {
		const listen = await builtPage('listen');
		expect(listen).toContain('<title>Listen — Ambiente</title>');
		const studio = await builtPage('studio');
		expect(studio).toContain('<title>Studio — Ambiente</title>');
		expect(studio).not.toContain('Studio is in preview.');
	});
});
