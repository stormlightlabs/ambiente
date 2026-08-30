import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { BrowserPieceStorage, DebouncedPieceAutosave } from '../src/application/piece-storage';

const databaseNames: string[] = [];
const document = JSON.stringify({
	format: 'ambiente',
	id: '9f8d76b0-0dd1-4fea-9ad9-43ae8f94f860',
	metadata: { title: 'Local study' },
	schema_version: 2
});

afterEach(async () => {
	for (const name of databaseNames.splice(0)) await Dexie.delete(name);
	vi.useRealTimers();
});

function databaseName(): string {
	const name = `ambiente-test-${crypto.randomUUID()}`;
	databaseNames.push(name);
	return name;
}

describe('browser piece storage', () => {
	test('creates, lists, reopens, duplicates, saves, and deletes canonical documents', async () => {
		const storage = new BrowserPieceStorage(databaseName());
		const created = await storage.create(document);
		await storage.setActiveId(created.id);

		expect(await storage.list()).toEqual([created]);
		const reopened = await storage.get(created.id);
		expect(reopened?.document).toBe(document);
		expect(await storage.getActiveId()).toBe(created.id);

		const duplicate = await storage.duplicate(created.id);
		expect(duplicate.id).not.toBe(created.id);
		expect(duplicate.documentId).toBe(created.documentId);

		const renamed = document.replace('Local study', 'Saved study');
		await storage.save(created.id, renamed);
		const saved = await storage.get(created.id);
		expect(saved?.title).toBe('Saved study');

		await storage.delete(created.id);
		expect(await storage.get(created.id)).toBeUndefined();
		expect(await storage.getActiveId()).toBeUndefined();
		storage.close();
	});

	test('rejects noncanonical input before changing IndexedDB', async () => {
		const storage = new BrowserPieceStorage(databaseName());
		await expect(storage.create('{}')).rejects.toMatchObject({ code: 'invalid-document' });
		expect(await storage.list()).toEqual([]);
		storage.close();
	});

	test('migrates the IndexedDB schema independently of document schema versions', async () => {
		const name = databaseName();
		const legacy = new Dexie(name);
		legacy.version(1).stores({ pieces: '&id, title, updatedAt', preferences: '&key' });
		await legacy
			.table('pieces')
			.add({
				document,
				documentId: '9f8d76b0-0dd1-4fea-9ad9-43ae8f94f860',
				id: 'legacy-entry',
				schemaVersion: 2,
				title: 'Local study',
				updatedAt: 42
			});
		legacy.close();

		const storage = new BrowserPieceStorage(name);
		expect(await storage.list()).toEqual([
			expect.objectContaining({ createdAt: 42, id: 'legacy-entry', schemaVersion: 2 })
		]);
		storage.close();
	});
});

describe('debounced autosave', () => {
	test('coalesces changes and can flush pending work', async () => {
		vi.useFakeTimers();
		const save = vi.fn(() => Promise.resolve());
		const autosave = new DebouncedPieceAutosave(save, 100);
		autosave.schedule();
		autosave.schedule();
		await vi.advanceTimersByTimeAsync(100);
		expect(save).toHaveBeenCalledTimes(1);

		autosave.schedule();
		await autosave.flush();
		expect(save).toHaveBeenCalledTimes(2);
	});
});
