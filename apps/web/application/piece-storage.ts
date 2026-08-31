import Dexie, { type EntityTable } from 'dexie';

import type { SerializedDocument } from './facade';

/** Metadata indexed for the local piece library. */
export type StoredPiece = Readonly<{
	createdAt: number;
	documentId: string;
	id: string;
	schemaVersion: number;
	title: string;
	updatedAt: number;
}>;

/** A canonical document and its local library metadata. */
export type StoredPieceDocument = StoredPiece & Readonly<{ document: SerializedDocument }>;

/** Result of asking the browser to protect local pieces from automatic eviction. */
export type PersistenceStatus = 'granted' | 'not-supported' | 'prompt-denied';

/** Storage boundary shared by browser and future desktop adapters. */
export type PieceStorage = {
	create(document: SerializedDocument): Promise<StoredPiece>;
	delete(id: string): Promise<void>;
	duplicate(id: string): Promise<StoredPiece>;
	get(id: string): Promise<StoredPieceDocument | undefined>;
	getActiveId(): Promise<string | undefined>;
	list(): Promise<readonly StoredPiece[]>;
	save(id: string, document: SerializedDocument): Promise<StoredPiece>;
	setActiveId(id: string | undefined): Promise<void>;
};

type PieceRecord = {
	createdAt: number;
	document: SerializedDocument;
	documentId: string;
	id: string;
	schemaVersion: number;
	title: string;
	updatedAt: number;
};
type PreferenceRecord = { key: string; value: string };
type LegacyPieceRecord = Omit<PieceRecord, 'createdAt'>;

const ACTIVE_PIECE_KEY = 'active-piece';
const DATABASE_VERSION = 2;

class PieceDatabase extends Dexie {
	pieces!: EntityTable<PieceRecord, 'id'>;
	preferences!: EntityTable<PreferenceRecord, 'key'>;

	constructor(name: string) {
		super(name);
		this.version(1).stores({ pieces: '&id, title, updatedAt', preferences: '&key' });
		this.version(DATABASE_VERSION)
			.stores({ pieces: '&id, title, updatedAt, documentId, schemaVersion', preferences: '&key' })
			.upgrade(async (transaction) => {
				const pieces = transaction.table<LegacyPieceRecord, string>('pieces');
				await pieces.toCollection().modify((piece) => {
					(piece as PieceRecord).createdAt = piece.updatedAt;
				});
			});
	}
}

/** IndexedDB implementation that stores canonical documents without interpreting musical state. */
export class BrowserPieceStorage implements PieceStorage {
	private readonly database: PieceDatabase;

	/** Opens an isolated database name when supplied, primarily for tests. */
	constructor(databaseName = 'ambiente-pieces') {
		this.database = new PieceDatabase(databaseName);
	}

	/** Adds a canonical document to the local library. */
	async create(document: SerializedDocument): Promise<StoredPiece> {
		const metadata = readDocumentMetadata(document);
		const now = Date.now();
		const record: PieceRecord = { ...metadata, createdAt: now, document, id: crypto.randomUUID(), updatedAt: now };
		await this.write(() => this.database.pieces.add(record));
		return withoutDocument(record);
	}

	/** Returns local pieces with the most recently saved first. */
	async list(): Promise<readonly StoredPiece[]> {
		// Dexie's Collection.reverse() changes cursor direction; it does not mutate an array.
		// eslint-disable-next-line unicorn/no-array-reverse
		const records = await this.database.pieces.orderBy('updatedAt').reverse().toArray();
		return records.map((record) => withoutDocument(record));
	}

	/** Loads one canonical document by its local library ID. */
	async get(id: string): Promise<StoredPieceDocument | undefined> {
		return this.database.pieces.get(id);
	}

	/** Atomically replaces one saved canonical document and its derived index metadata. */
	async save(id: string, document: SerializedDocument): Promise<StoredPiece> {
		const metadata = readDocumentMetadata(document);
		let saved: PieceRecord | undefined;
		await this.write(async () => {
			const existing = await this.database.pieces.get(id);
			if (!existing) throw new PieceStorageError('not-found', 'This piece is no longer in the local library.');
			saved = { ...existing, ...metadata, document, updatedAt: Date.now() };
			await this.database.pieces.put(saved);
		});
		return withoutDocument(saved!);
	}

	/** Creates another local entry containing the same canonical document. */
	async duplicate(id: string): Promise<StoredPiece> {
		const source = await this.get(id);
		if (!source) throw new PieceStorageError('not-found', 'This piece is no longer in the local library.');
		return this.create(source.document);
	}

	/** Removes one local piece without affecting other saved entries. */
	async delete(id: string): Promise<void> {
		await this.write(() => this.database.pieces.delete(id));
		if ((await this.getActiveId()) === id) await this.setActiveId(undefined);
	}

	/** Returns the local piece that was open most recently. */
	async getActiveId(): Promise<string | undefined> {
		const preference = await this.database.preferences.get(ACTIVE_PIECE_KEY);
		return preference?.value;
	}

	/** Records which local piece should reopen on the next visit. */
	async setActiveId(id: string | undefined): Promise<void> {
		await this.write(() =>
			id === undefined
				? this.database.preferences.delete(ACTIVE_PIECE_KEY)
				: this.database.preferences.put({ key: ACTIVE_PIECE_KEY, value: id })
		);
	}

	/** Closes this adapter's IndexedDB connection. */
	close(): void {
		this.database.close();
	}

	private async write(operation: () => Promise<unknown>): Promise<void> {
		try {
			await operation();
		} catch (error) {
			if (error instanceof PieceStorageError) throw error;
			if (isQuotaError(error)) {
				throw new PieceStorageError(
					'quota',
					'The browser is out of storage space. Your previous saved copy is unchanged.'
				);
			}
			throw new PieceStorageError('write-failed', 'The piece could not be saved in this browser.', error);
		}
	}
}

/** A storage failure with a stable recovery category for the Studio UI. */
export class PieceStorageError extends Error {
	/** Creates a storage error while retaining an underlying browser error when available. */
	constructor(
		readonly code: 'invalid-document' | 'not-found' | 'quota' | 'write-failed',
		message: string,
		options?: unknown
	) {
		super(message, options === undefined ? undefined : { cause: options });
		this.name = 'PieceStorageError';
	}
}

/** Requests browser protection against automatic storage eviction when supported. */
export async function requestPersistentStorage(): Promise<PersistenceStatus> {
	if (!navigator.storage?.persist) return 'not-supported';
	return (await navigator.storage.persist()) ? 'granted' : 'prompt-denied';
}

/** Downloads a canonical piece file without changing the saved document. */
export function downloadPiece(piece: StoredPieceDocument): void {
	const url = URL.createObjectURL(new Blob([piece.document], { type: 'application/json' }));
	const anchor = document.createElement('a');
	anchor.download = `${fileStem(piece.title)}.ambiente.json`;
	anchor.href = url;
	anchor.click();
	URL.revokeObjectURL(url);
}

/** Debounces saves while allowing navigation and teardown to flush pending work. */
export class DebouncedPieceAutosave {
	private timer: ReturnType<typeof setTimeout> | undefined;

	/** Creates an autosave queue with a short idle delay. */
	constructor(
		private readonly save: () => Promise<void>,
		private readonly delayMilliseconds = 600
	) {}

	/** Replaces any pending save with a new idle deadline. */
	schedule(): void {
		if (this.timer !== undefined) clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.timer = undefined;
			void this.save();
		}, this.delayMilliseconds);
	}

	/** Runs pending work immediately and waits for it to finish. */
	async flush(): Promise<void> {
		if (this.timer === undefined) return;
		clearTimeout(this.timer);
		this.timer = undefined;
		await this.save();
	}

	/** Discards a pending save, for example when opening another piece. */
	cancel(): void {
		if (this.timer !== undefined) clearTimeout(this.timer);
		this.timer = undefined;
	}
}

function readDocumentMetadata(
	document: SerializedDocument
): Pick<PieceRecord, 'documentId' | 'schemaVersion' | 'title'> {
	try {
		const value = JSON.parse(document) as {
			format?: unknown;
			id?: unknown;
			metadata?: { title?: unknown };
			schema_version?: unknown;
		};
		if (
			value.format !== 'ambiente' ||
			typeof value.id !== 'string' ||
			!Number.isInteger(value.schema_version) ||
			(value.schema_version as number) < 1
		) {
			throw new Error('missing canonical document fields');
		}
		return {
			documentId: value.id,
			schemaVersion: value.schema_version as number,
			title:
				typeof value.metadata?.title === 'string' && value.metadata.title.trim()
					? value.metadata.title
					: 'Untitled piece'
		};
	} catch (error) {
		throw new PieceStorageError('invalid-document', 'Only canonical Ambiente piece files can be stored.', error);
	}
}

function withoutDocument(record: PieceRecord): StoredPiece {
	return {
		createdAt: record.createdAt,
		documentId: record.documentId,
		id: record.id,
		schemaVersion: record.schemaVersion,
		title: record.title,
		updatedAt: record.updatedAt
	};
}

function isQuotaError(error: unknown): boolean {
	return (
		error instanceof DOMException &&
		(error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
	);
}

function fileStem(title: string): string {
	return (
		title
			.toLowerCase()
			.replaceAll(/[^a-z0-9]+/g, '-')
			.replaceAll(/^-|-$/g, '') || 'untitled-piece'
	);
}
