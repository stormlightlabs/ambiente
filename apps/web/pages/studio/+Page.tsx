import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';

import documentFixture from '../../../../crates/wasm/tests/fixtures/conformance-document.json?raw';
import type { LookAheadScheduler, TransportState } from '@ambiente/audio';

import type { DocumentInspection, DocumentOperation, WasmApplication } from '../../src/application/facade';
import { createShellFixtureApplication } from '../../src/application/shell-fixture';
import type {
	BrowserPieceStorage,
	DebouncedPieceAutosave,
	PersistenceStatus,
	StoredPiece,
	StoredPieceDocument
} from '../../src/application/piece-storage';

const initialInspection = createShellFixtureApplication().inspect();
const views = ['Matrix', 'Phrase', 'System'];

export default function Page() {
	const [inspection, setInspection] = createSignal<DocumentInspection>(initialInspection);
	const [position, setPosition] = createSignal(0);
	const [state, setState] = createSignal<TransportState>('stopped');
	const [ready, setReady] = createSignal(false);
	const [audioError, setAudioError] = createSignal<string>();
	const [libraryError, setLibraryError] = createSignal<string>();
	const [pieces, setPieces] = createSignal<readonly StoredPiece[]>([]);
	const [activePiece, setActivePiece] = createSignal<StoredPiece>();
	const [saveState, setSaveState] = createSignal<'idle' | 'saved' | 'saving'>('idle');
	const [persistence, setPersistence] = createSignal<PersistenceStatus>();
	const [seedDraft, setSeedDraft] = createSignal(initialInspection.seed);
	const [tempoDraft, setTempoDraft] = createSignal(exactToDisplay(initialInspection.tempo));
	let application: WasmApplication | undefined;
	let audio: LookAheadScheduler | undefined;
	let storage: BrowserPieceStorage | undefined;
	let autosave: DebouncedPieceAutosave | undefined;
	let unsubscribe: (() => void) | undefined;
	let importInput: HTMLInputElement | undefined;

	const flushOnPageHide = () => void autosave?.flush();

	onMount(() => {
		window.addEventListener('pagehide', flushOnPageHide);
		void initializeStudio();
	});
	onCleanup(() => {
		window.removeEventListener('pagehide', flushOnPageHide);
		const pendingSave = autosave?.flush();
		if (pendingSave) void pendingSave.finally(() => storage?.close());
		else storage?.close();
		unsubscribe?.();
		audio?.dispose();
	});

	async function initializeStudio() {
		try {
			const [{ createBrowserAudio }, facade, pieceStorage] = await Promise.all([
				import('@ambiente/audio'),
				import('../../src/application/facade'),
				import('../../src/application/piece-storage')
			]);
			storage = new pieceStorage.BrowserPieceStorage();
			setPersistence(await pieceStorage.requestPersistentStorage().catch(() => 'prompt-denied' as const));
			let library = await storage.list();
			const activeId = await storage.getActiveId();
			let stored = activeId ? await storage.get(activeId) : undefined;
			stored ??= library[0] ? await storage.get(library[0].id) : undefined;
			if (!stored) {
				application = await facade.WasmApplication.create(documentFixture);
				const created = await storage.create(application.serialize());
				stored = await storage.get(created.id);
				library = await storage.list();
			} else {
				application = await facade.WasmApplication.create(stored.document);
			}
			if (!stored) throw new Error('The initial piece could not be saved.');
			await storage.setActiveId(stored.id);
			setPieces(library);
			setActivePiece(withoutDocument(stored));
			updateInspection();
			audio = createBrowserAudio(application);
			unsubscribe = audio.subscribe((nextState, nextPosition) => {
				setState(nextState);
				setPosition(nextPosition);
			});
			autosave = new pieceStorage.DebouncedPieceAutosave(saveActivePiece);
			setReady(true);
		} catch (error) {
			setAudioError(message(error, 'Studio could not be initialized.'));
		}
	}

	async function togglePlayback() {
		if (!audio) return;
		setAudioError(undefined);
		try {
			await audio.play();
		} catch (error) {
			setAudioError(message(error, 'Browser audio could not be started.'));
		}
	}

	function applyOperation(operation: DocumentOperation): boolean {
		if (!application) return false;
		const diagnostics = application.apply(operation);
		const error = diagnostics.find((diagnostic) => diagnostic.severity === 'error');
		if (error) {
			setLibraryError(error.message);
			return false;
		}
		setLibraryError(undefined);
		updateInspection();
		audio?.refreshDocument();
		setSaveState('idle');
		autosave?.schedule();
		return true;
	}

	function commitSeed() {
		const seed = seedDraft().trim().toLowerCase();
		if (!/^[0-9a-f]{16}$/.test(seed)) {
			setLibraryError('Enter a seed as exactly 16 hexadecimal characters.');
			return;
		}
		applyOperation({ kind: 'set_seed', payload: seed });
	}

	function commitTempo() {
		const tempo = Number(tempoDraft());
		if (!Number.isInteger(tempo) || tempo < 20 || tempo > 300) {
			setLibraryError('Enter a whole-number tempo from 20 to 300 BPM.');
			return;
		}
		applyOperation({ kind: 'set_tempo', payload: `${tempo}/1` });
	}

	function seekFromInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const seconds = Number(target.value);
		if (Number.isFinite(seconds) && seconds >= 0) audio?.seek(seconds);
		else target.value = String(Math.floor(position()));
	}

	async function saveActivePiece() {
		const active = activePiece();
		if (!storage || !application || !active) return;
		setSaveState('saving');
		try {
			const saved = await storage.save(active.id, application.serialize());
			setActivePiece(saved);
			await refreshLibrary();
			setSaveState('saved');
			setLibraryError(undefined);
		} catch (error) {
			setSaveState('idle');
			setLibraryError(message(error, 'This piece could not be saved.'));
		}
	}

	async function openPiece(id: string) {
		if (!storage || !application || activePiece()?.id === id) return;
		await autosave?.flush();
		const stored = await storage.get(id);
		if (!stored) {
			setLibraryError('This piece is no longer in the local library.');
			return;
		}
		audio?.stop();
		const diagnostics = application.load(stored.document);
		const error = diagnostics.find((diagnostic) => diagnostic.severity === 'error');
		if (error) {
			setLibraryError(error.message);
			return;
		}
		await storage.setActiveId(id);
		setActivePiece(withoutDocument(stored));
		updateInspection();
		audio?.refreshDocument();
		setSaveState('saved');
		setLibraryError(undefined);
	}

	async function createPiece() {
		if (!storage || !application) return;
		try {
			await autosave?.flush();
			const { WasmApplication } = await import('../../src/application/facade');
			const createdApplication = await WasmApplication.createNew('Untitled piece');
			const created = await storage.create(createdApplication.serialize());
			await refreshLibrary();
			await openPiece(created.id);
		} catch (error) {
			setLibraryError(message(error, 'A new piece could not be created.'));
		}
	}

	async function duplicatePiece(id: string) {
		if (!storage) return;
		try {
			await autosave?.flush();
			const duplicate = await storage.duplicate(id);
			await refreshLibrary();
			await openPiece(duplicate.id);
		} catch (error) {
			setLibraryError(message(error, 'The piece could not be duplicated.'));
		}
	}

	async function deletePiece(piece: StoredPiece) {
		if (!storage || !confirm(`Delete “${piece.title}” from this browser? This cannot be undone.`)) return;
		try {
			const wasActive = activePiece()?.id === piece.id;
			if (wasActive) autosave?.cancel();
			await storage.delete(piece.id);
			await refreshLibrary();
			if (wasActive) {
				const next = pieces()[0];
				if (next) await openPiece(next.id);
				else await createPiece();
			}
		} catch (error) {
			setLibraryError(message(error, 'The piece could not be deleted.'));
		}
	}

	async function importPiece(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !storage) return;
		try {
			const { WasmApplication } = await import('../../src/application/facade');
			const imported = await WasmApplication.create(await file.text());
			const created = await storage.create(imported.serialize());
			await refreshLibrary();
			await openPiece(created.id);
		} catch (error) {
			setLibraryError(message(error, 'That file is not a valid Ambiente piece.'));
		}
	}

	async function exportActivePiece() {
		const active = activePiece();
		if (!storage || !active) return;
		await autosave?.flush();
		const stored = await storage.get(active.id);
		if (!stored) return;
		const { downloadPiece } = await import('../../src/application/piece-storage');
		downloadPiece(stored);
	}

	async function refreshLibrary() {
		if (storage) setPieces(await storage.list());
	}

	function updateInspection() {
		if (!application) return;
		const next = application.inspect();
		setInspection(next);
		setSeedDraft(next.seed);
		setTempoDraft(exactToDisplay(next.tempo));
	}

	return (
		<div class="studio-shell">
			<aside class="studio-rail" aria-label="Studio views and local pieces">
				<div class="studio-rail__views">
					<p>Views</p>
					<nav aria-label="Studio views">
						<For each={views}>
							{(view, index) => (
								<button type="button" classList={{ 'is-active': index() === 0 }} disabled={index() !== 0}>
									<span aria-hidden="true">{index() + 1}</span>
									{view}
								</button>
							)}
						</For>
					</nav>
				</div>
				<section class="piece-library" aria-labelledby="piece-library-heading">
					<header>
						<h2 id="piece-library-heading">Local pieces</h2>
						<button type="button" aria-label="Create new piece" onClick={() => void createPiece()} disabled={!ready()}>
							<span class="icon i-ri-add-line" aria-hidden="true" />
						</button>
					</header>
					<div class="piece-library__list">
						<For each={pieces()}>
							{(piece) => (
								<div classList={{ 'piece-library__item': true, 'is-active': piece.id === activePiece()?.id }}>
									<button type="button" class="piece-library__open" onClick={() => void openPiece(piece.id)}>
										<span>{piece.title}</span>
										<small>Schema {piece.schemaVersion}</small>
									</button>
									<div class="piece-library__actions">
										<button
											type="button"
											aria-label={`Duplicate ${piece.title}`}
											onClick={() => void duplicatePiece(piece.id)}>
											<span class="icon i-ri-file-copy-line" aria-hidden="true" />
										</button>
										<button type="button" aria-label={`Delete ${piece.title}`} onClick={() => void deletePiece(piece)}>
											<span class="icon i-ri-delete-bin-line" aria-hidden="true" />
										</button>
									</div>
								</div>
							)}
						</For>
					</div>
					<div class="piece-library__files">
						<button type="button" onClick={() => importInput?.click()}>
							Import
						</button>
						<button type="button" onClick={() => void exportActivePiece()} disabled={!activePiece()}>
							Export
						</button>
						<input
							ref={importInput}
							type="file"
							accept=".json,.ambiente.json,application/json"
							onChange={(event) => void importPiece(event)}
						/>
					</div>
					<Show when={persistence() === 'prompt-denied'}>
						<p class="piece-library__persistence">
							Browser cleanup may remove local pieces. Export anything important.
						</p>
					</Show>
				</section>
				<div class="studio-rail__status">
					<span aria-hidden="true" />
					{ready() ? 'Rust audio ready' : 'Loading Studio'}
				</div>
			</aside>

			<section class="studio-workspace">
				<header class="transport" aria-label="Transport">
					<div class="transport__identity">
						<p>{inspection().title}</p>
						<label>
							<span>Seed</span>
							<input
								value={seedDraft()}
								onInput={(event) => setSeedDraft(event.currentTarget.value)}
								onChange={commitSeed}
								aria-label="Composition seed"
								spellcheck={false}
							/>
						</label>
					</div>
					<div class="transport__controls">
						<button type="button" disabled={!ready()} aria-label="Stop" onClick={() => audio?.stop()}>
							<span class="icon i-bi-skip-start-fill" aria-hidden="true" />
						</button>
						<button
							type="button"
							disabled={!ready() || state() === 'starting' || state() === 'playing'}
							class="transport__play"
							aria-label="Play"
							onClick={() => void togglePlayback()}>
							<span class="icon i-bi-play-fill" aria-hidden="true" />
						</button>
						<button type="button" disabled={state() !== 'playing'} aria-label="Pause" onClick={() => audio?.pause()}>
							<span class="icon i-bi-pause-fill" aria-hidden="true" />
						</button>
						<label class="transport__position">
							<span class="transport__time">{formatTime(position())}</span>
							<input
								type="number"
								min="0"
								step="1"
								value={Math.floor(position())}
								onChange={seekFromInput}
								aria-label="Seek position in seconds"
							/>
							<span>s</span>
						</label>
						<label class="transport__tempo">
							<input
								type="number"
								min="20"
								max="300"
								value={tempoDraft()}
								onInput={(event) => setTempoDraft(event.currentTarget.value)}
								onChange={commitTempo}
								aria-label="Tempo in beats per minute"
							/>
							<span>BPM</span>
						</label>
					</div>
					<button
						class="transport__save"
						type="button"
						disabled={!ready()}
						onClick={() => {
							autosave?.cancel();
							void saveActivePiece();
						}}>
						<span class="icon i-ri-save-line" aria-hidden="true" />
						{saveLabel(saveState())}
					</button>
				</header>

				<div class="studio-canvas">
					<Show when={libraryError()}>
						<div class="studio-notice" role="alert">
							{libraryError()}
						</div>
					</Show>
					<header>
						<div>
							<p class="kicker">Matrix</p>
							<h1>Pattern workspace</h1>
						</div>
						<span>
							{inspection().materialCount} material · {inspection().voiceCount} voice
						</span>
					</header>

					<div class="matrix-preview" aria-hidden="true">
						<div class="matrix-preview__labels">
							<span>C5</span>
							<span>A4</span>
							<span>G4</span>
							<span>E4</span>
							<span>C4</span>
						</div>
						<div class="matrix-preview__grid">
							<For each={Array.from({ length: 40 })}>
								{(_, index) => <span classList={{ 'is-on': [1, 8, 14, 19, 27, 34].includes(index()) }} />}
							</For>
						</div>
					</div>

					<div class="studio-empty" aria-live="polite">
						<span class="studio-empty__glyph icon i-ri-sound-module-line" aria-hidden="true" />
						<div>
							<h2>{audioError() ? 'Audio needs attention.' : 'Rust events are ready to play.'}</h2>
							<p>
								{audioError() ?? 'Press Play to hear the canonical step pattern through the browser sound library.'}
							</p>
						</div>
						<a class="text-link" href="/docs/audio">
							How browser audio works
							<span class="icon i-ri-arrow-right-line" aria-hidden="true" />
						</a>
					</div>
				</div>
			</section>
		</div>
	);
}

function withoutDocument(piece: StoredPieceDocument): StoredPiece {
	return {
		createdAt: piece.createdAt,
		documentId: piece.documentId,
		id: piece.id,
		schemaVersion: piece.schemaVersion,
		title: piece.title,
		updatedAt: piece.updatedAt
	};
}

function saveLabel(state: 'idle' | 'saved' | 'saving'): string {
	if (state === 'saving') return 'Saving…';
	return state === 'saved' ? 'Saved' : 'Save';
}

function exactToDisplay(value: string): string {
	const [numerator, denominator] = value.split('/').map(Number);
	return denominator ? String(numerator! / denominator) : value;
}

function formatTime(seconds: number): string {
	const wholeMinutes = Math.floor(seconds / 60);
	const remaining = seconds - wholeMinutes * 60;
	return `${String(wholeMinutes).padStart(2, '0')}:${remaining.toFixed(3).padStart(6, '0')}`;
}

function message(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
