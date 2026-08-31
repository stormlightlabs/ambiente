/* eslint-disable react/jsx-max-depth -- The Studio shell keeps its visual and semantic hierarchy together. */
import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';

import documentFixture from '../../../../crates/wasm/tests/fixtures/conformance-document.json?raw';
import type { LookAheadScheduler, TransportState } from '@ambiente/audio';

import type {
	ApplicationMaterial,
	ApplicationParameterValue,
	ApplicationPhraseNote,
	ApplicationVoice,
	DocumentInspection,
	DocumentOperation,
	WasmApplication
} from '../../src/application/facade';
import type {
	BrowserPieceStorage,
	DebouncedPieceAutosave,
	PersistenceStatus,
	StoredPiece,
	StoredPieceDocument
} from '../../src/application/piece-storage';
import { MatrixEditor } from '../../src/components/MatrixEditor';
import { PianoKeyboard, pitchName } from '../../src/components/PianoKeyboard';

const initialInspection: DocumentInspection = {
	documentId: '',
	materialCount: 0,
	materials: [],
	seed: '0000000000000000',
	tempo: '120/1',
	title: 'Loading piece',
	voiceCount: 0,
	voices: []
};
const views = ['Phrase', 'Matrix', 'System'] as const;
const keyboardPitches: Readonly<Record<string, number>> = {
	KeyA: 0,
	KeyW: 1,
	KeyS: 2,
	KeyE: 3,
	KeyD: 4,
	KeyF: 5,
	KeyT: 6,
	KeyG: 7,
	KeyY: 8,
	KeyH: 9,
	KeyU: 10,
	KeyJ: 11,
	KeyK: 12
};
const sounds = [
	{ id: 'felt-piano', label: 'Felt piano' },
	{ id: 'glass', label: 'Glass' },
	{ id: 'warm-drone', label: 'Warm drone' },
	{ id: 'soft-pluck', label: 'Soft pluck' },
	{ id: 'air', label: 'Air' },
	{ id: 'percussion', label: 'Percussion' }
] as const;

type StudioView = (typeof views)[number];
type RecordedNote = Readonly<{ duration: number; onset: number; pitch: number; velocity: number }>;

export default function Page() {
	const [inspection, setInspection] = createSignal<DocumentInspection>(initialInspection);
	const [position, setPosition] = createSignal(0);
	const [state, setState] = createSignal<TransportState>('stopped');
	const [volume, setVolume] = createSignal(0.8);
	const [ready, setReady] = createSignal(false);
	const [audioError, setAudioError] = createSignal<string>();
	const [libraryError, setLibraryError] = createSignal<string>();
	const [pieces, setPieces] = createSignal<readonly StoredPiece[]>([]);
	const [activePiece, setActivePiece] = createSignal<StoredPiece>();
	const [saveState, setSaveState] = createSignal<'idle' | 'saved' | 'saving'>('idle');
	const [persistence, setPersistence] = createSignal<PersistenceStatus>();
	const [seedDraft, setSeedDraft] = createSignal(initialInspection.seed);
	const [tempoDraft, setTempoDraft] = createSignal(exactToDisplay(initialInspection.tempo));
	const [activeView, setActiveView] = createSignal<StudioView>('Phrase');
	const [selectedVoiceId, setSelectedVoiceId] = createSignal<string>();
	const [selectedMaterialId, setSelectedMaterialId] = createSignal<string>();
	const [baseOctave, setBaseOctave] = createSignal(4);
	const [activePitches, setActivePitches] = createSignal<ReadonlySet<number>>(new Set());
	const [recording, setRecording] = createSignal(false);
	const [recordedNotes, setRecordedNotes] = createSignal<readonly RecordedNote[]>([]);
	const [quantizeRecording, setQuantizeRecording] = createSignal(true);
	const selectedVoice = createMemo(() => inspection().voices.find((voice) => voice.id === selectedVoiceId()));
	const selectedMaterial = createMemo(() =>
		inspection().materials.find((material) => material.id === selectedMaterialId())
	);
	const selectedMatrix = createMemo(() => {
		const material = selectedMaterial();
		return material?.type === 'step_pattern' ? material : undefined;
	});
	let application: WasmApplication | undefined;
	let audio: LookAheadScheduler | undefined;
	let storage: BrowserPieceStorage | undefined;
	let autosave: DebouncedPieceAutosave | undefined;
	let unsubscribe: (() => void) | undefined;
	let importInput: HTMLInputElement | undefined;
	let recordingStartedAt = 0;
	let recordingVoiceId: string | undefined;
	const heldInputs = new Map<string, number>();
	const recordingStarts = new Map<number, number>();

	const flushOnPageHide = () => void autosave?.flush();

	onMount(() => {
		globalThis.addEventListener('pagehide', flushOnPageHide);
		globalThis.addEventListener('keydown', handleKeyDown);
		globalThis.addEventListener('keyup', handleKeyUp);
		void initializeStudio();
	});
	onCleanup(() => {
		globalThis.removeEventListener('pagehide', flushOnPageHide);
		globalThis.removeEventListener('keydown', handleKeyDown);
		globalThis.removeEventListener('keyup', handleKeyUp);
		releaseAllNotes();
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
			audio.setVolume(volume());
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
			setLibraryError(error.help ? `${error.message} ${error.help}` : error.message);
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
		releaseAllNotes();
		const diagnostics = application.load(stored.document);
		const error = diagnostics.find((diagnostic) => diagnostic.severity === 'error');
		if (error) {
			setLibraryError(error.message);
			return;
		}
		await storage.setActiveId(id);
		setActivePiece(withoutDocument(stored));
		setSelectedVoiceId(undefined);
		setSelectedMaterialId(undefined);
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
		if (!next.voices.some((voice) => voice.id === selectedVoiceId())) setSelectedVoiceId(next.voices[0]?.id);
		if (!next.materials.some((material) => material.id === selectedMaterialId())) {
			const voiceMaterial = next.voices.find((voice) => voice.id === selectedVoiceId())?.materialId;
			setSelectedMaterialId(voiceMaterial ?? next.materials[0]?.id);
		}
	}

	function addVoice() {
		const id = crypto.randomUUID();
		const material = selectedMaterial();
		if (
			applyOperation({
				kind: 'add_voice',
				payload: {
					id,
					settings: {
						enabled: true,
						name: `Voice ${inspection().voiceCount + 1}`,
						parameters: {},
						pattern: material ? { material_id: material.id, type: 'material' } : null,
						sound: 'felt-piano'
					}
				}
			})
		) {
			setSelectedVoiceId(id);
		}
	}

	function deleteVoice(voice: ApplicationVoice) {
		if (!confirm(`Delete “${voice.name}”? This cannot be undone.`)) return;
		if (applyOperation({ kind: 'remove_voice', payload: voice.id })) releaseAllNotes();
	}

	function updateVoice(voice: ApplicationVoice, changes: Partial<ApplicationVoice>) {
		applyOperation({
			kind: 'update_voice_settings',
			payload: {
				id: voice.id,
				settings: {
					enabled: changes.enabled ?? voice.enabled,
					name: changes.name ?? voice.name,
					parameters: changes.parameters ?? voice.parameters,
					pattern: changes.pattern === undefined ? voice.pattern : changes.pattern,
					sound: changes.sound ?? voice.sound
				}
			}
		});
	}

	function updateVoiceParameter(voice: ApplicationVoice, name: string, value: number) {
		updateVoice(voice, {
			parameters: { ...voice.parameters, [name]: { type: 'integer', value } satisfies ApplicationParameterValue }
		});
	}

	function addMaterial(kind: 'phrase' | 'step_pattern') {
		const id = crypto.randomUUID();
		const count = inspection().materials.filter((material) => material.type === kind).length + 1;
		const payload =
			kind === 'phrase'
				? { id, name: `Phrase ${count}`, phrase: { notes: {} }, type: 'phrase' }
				: {
						id,
						name: `Matrix ${count}`,
						pattern: {
							rows: [72, 71, 69, 67, 65, 64, 62, 60].map((pitch) => ({
								cells: Array.from({ length: 8 }, () => ({ active: false })),
								pitch
							})),
							steps: 8,
							subdivision: '1/2'
						},
						type: 'step_pattern'
					};
		if (applyOperation({ kind: 'add_material', payload })) setSelectedMaterialId(id);
	}

	function deleteMaterial(material: ApplicationMaterial) {
		const linkedVoice = inspection().voices.find((voice) => voice.materialId === material.id);
		if (linkedVoice) {
			setLibraryError(`“${material.name}” is used by “${linkedVoice.name}”. Choose No material for that voice first.`);
			return;
		}
		if (!confirm(`Delete “${material.name}”? This cannot be undone.`)) return;
		applyOperation({ kind: 'remove_material', payload: material.id });
	}

	function beginNote(token: string, pitch: number) {
		const voice = selectedVoice();
		if (!voice || heldInputs.has(token)) return;
		heldInputs.set(token, pitch);
		const alreadyHeld = [...heldInputs.entries()].some(
			([heldToken, heldPitch]) => heldToken !== token && heldPitch === pitch
		);
		if (!alreadyHeld) {
			setActivePitches((current) => new Set([...current, pitch]));
			if (recording()) recordingStarts.set(pitch, performance.now());
			void audio?.previewNoteOn(voice.id, pitch).catch((error) => {
				setAudioError(message(error, 'This note could not be played.'));
			});
		}
	}

	function endNote(token: string) {
		const pitch = heldInputs.get(token);
		if (pitch === undefined) return;
		heldInputs.delete(token);
		if ([...heldInputs.values()].includes(pitch)) return;
		const voice = selectedVoice();
		if (voice) audio?.previewNoteOff(voice.id, pitch);
		setActivePitches((current) => {
			const next = new Set(current);
			next.delete(pitch);
			return next;
		});
		finishRecordedNote(pitch, performance.now());
	}

	function releaseAllNotes() {
		for (const token of heldInputs.keys()) endNote(token);
	}

	function handleKeyDown(event: KeyboardEvent) {
		const offset = keyboardPitches[event.code];
		if (
			offset === undefined ||
			event.repeat ||
			activeView() !== 'Phrase' ||
			isTextInput(event.target) ||
			event.metaKey ||
			event.ctrlKey ||
			event.altKey
		)
			return;
		event.preventDefault();
		beginNote(`keyboard:${event.code}`, (baseOctave() + 1) * 12 + offset);
	}

	function handleKeyUp(event: KeyboardEvent) {
		if (keyboardPitches[event.code] === undefined) return;
		endNote(`keyboard:${event.code}`);
	}

	function startRecording() {
		if (!selectedVoice()) {
			setLibraryError('Add or select a voice before recording.');
			return;
		}
		releaseAllNotes();
		setRecordedNotes([]);
		recordingStarts.clear();
		recordingStartedAt = performance.now();
		recordingVoiceId = selectedVoice()!.id;
		setRecording(true);
		setLibraryError(undefined);
	}

	function finishRecordedNote(pitch: number, endedAt: number) {
		const startedAt = recordingStarts.get(pitch);
		if (!recording() || startedAt === undefined) return;
		recordingStarts.delete(pitch);
		const beatsPerSecond = Number(tempoDraft()) / 60;
		setRecordedNotes((notes) => [
			...notes,
			{
				duration: Math.max((endedAt - startedAt) / 1000, 0.01) * beatsPerSecond,
				onset: ((startedAt - recordingStartedAt) / 1000) * beatsPerSecond,
				pitch,
				velocity: 100
			}
		]);
	}

	function stopRecording() {
		const endedAt = performance.now();
		for (const pitch of recordingStarts.keys()) finishRecordedNote(pitch, endedAt);
		setRecording(false);
		const notes = recordedNotes();
		if (notes.length === 0) return;
		const materialId = crypto.randomUUID();
		const phraseNotes = Object.fromEntries(
			notes.map((note) => {
				const id = crypto.randomUUID();
				return [
					id,
					{
						id,
						pitch: note.pitch,
						time: { clock: 'metric', duration: numberToExact(note.duration, true), onset: numberToExact(note.onset) },
						velocity: note.velocity
					}
				];
			})
		);
		const materialName = `Recording ${inspection().materials.filter((material) => material.type === 'phrase').length + 1}`;
		if (
			applyOperation({
				kind: 'add_material',
				payload: { id: materialId, name: materialName, phrase: { notes: phraseNotes }, type: 'phrase' }
			})
		) {
			setSelectedMaterialId(materialId);
			const voice = application?.inspect().voices.find((item) => item.id === recordingVoiceId);
			if (voice) updateVoice(voice, { pattern: { material_id: materialId, type: 'material' } });
			if (quantizeRecording()) quantizePhrase(materialId);
		}
	}

	function quantizePhrase(materialId: string) {
		applyOperation({
			kind: 'quantize_phrase',
			payload: { grid: { clock: 'metric', value: '1/4' }, material_id: materialId }
		});
	}

	return (
		<div class="studio-shell">
			<aside class="studio-rail" aria-label="Studio views and local pieces">
				<div class="studio-rail__views">
					<p>Studio</p>
					<nav aria-label="Studio views">
						<For each={views}>
							{(view, index) => (
								<button
									type="button"
									classList={{ 'is-active': activeView() === view }}
									onClick={() => setActiveView(view)}>
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
										<small>Format {piece.schemaVersion}</small>
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
				<Show when={!ready()}>
					<div class="studio-rail__status" role="status">
						<span aria-hidden="true" />
						Loading Studio
					</div>
				</Show>
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
						<label class="transport__volume">
							<span class="icon i-ri-volume-up-line" aria-hidden="true" />
							<span class="sr-only">Playback volume</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={volume()}
								onInput={(event) => {
									setVolume(event.currentTarget.valueAsNumber);
									audio?.setVolume(event.currentTarget.valueAsNumber);
								}}
							/>
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
						<h1>{viewTitle(activeView())}</h1>
						<span>
							{inspection().materialCount} {plural(inspection().materialCount, 'material')} · {inspection().voiceCount}{' '}
							{plural(inspection().voiceCount, 'voice')}
						</span>
					</header>

					<div class="studio-editor-layout">
						<StudioBrowser
							inspection={inspection()}
							selectedMaterialId={selectedMaterialId()}
							selectedVoiceId={selectedVoiceId()}
							onAddMaterial={addMaterial}
							onAddVoice={addVoice}
							onDeleteMaterial={deleteMaterial}
							onDeleteVoice={deleteVoice}
							onSelectMaterial={setSelectedMaterialId}
							onSelectVoice={setSelectedVoiceId}
						/>

						<main class="instrument-surface">
							<Show when={activeView() === 'Phrase'}>
								<div class="piano-toolbar">
									<div>
										<p>Computer keys</p>
										<span>A–K, with W E T Y U for sharps</span>
									</div>
									<div class="octave-control" aria-label="Piano octave">
										<button
											type="button"
											aria-label="Lower octave"
											disabled={baseOctave() <= 1}
											onClick={() => setBaseOctave((value) => value - 1)}>
											−
										</button>
										<span>
											C{baseOctave()}–B{baseOctave() + 1}
										</span>
										<button
											type="button"
											aria-label="Raise octave"
											disabled={baseOctave() >= 7}
											onClick={() => setBaseOctave((value) => value + 1)}>
											+
										</button>
									</div>
								</div>
								<PianoKeyboard
									activePitches={activePitches()}
									baseOctave={baseOctave()}
									disabled={!ready() || !selectedVoice()}
									onNoteOn={beginNote}
									onNoteOff={endNote}
								/>
								<Show when={!selectedVoice()}>
									<p class="instrument-hint">Add a voice to play the piano.</p>
								</Show>
								<div class="recording-bar">
									<button
										type="button"
										classList={{ 'record-button': true, 'is-recording': recording() }}
										disabled={!ready() || !selectedVoice()}
										onClick={() => (recording() ? stopRecording() : startRecording())}>
										<span aria-hidden="true" />
										{recording() ? 'Stop recording' : 'Record phrase'}
									</button>
									<label>
										<input
											type="checkbox"
											checked={quantizeRecording()}
											onChange={(event) => setQuantizeRecording(event.currentTarget.checked)}
										/>
										Quantize to 1/16 notes
									</label>
								</div>
								<PhraseDisplay
									material={selectedMaterial()}
									liveNotes={recordedNotes()}
									recording={recording()}
									onQuantize={quantizePhrase}
								/>
							</Show>
							<Show when={activeView() === 'Matrix'}>
								<MatrixEditor
									material={selectedMatrix()}
									onOperation={applyOperation}
									positionSeconds={position()}
									tempo={inspection().tempo}
								/>
							</Show>
							<Show when={activeView() === 'System'}>
								<section class="system-summary">
									<h2>Piece settings</h2>
									<dl>
										<div>
											<dt>Title</dt>
											<dd>{inspection().title}</dd>
										</div>
										<div>
											<dt>Tempo</dt>
											<dd>{exactToDisplay(inspection().tempo)} BPM</dd>
										</div>
										<div>
											<dt>Seed</dt>
											<dd>{inspection().seed}</dd>
										</div>
										<div>
											<dt>Document</dt>
											<dd>{inspection().documentId}</dd>
										</div>
									</dl>
									<p>Tempo and seed are available in the transport. Voice playback settings are in the inspector.</p>
								</section>
							</Show>
						</main>

						<VoiceInspector
							voice={selectedVoice()}
							materials={inspection().materials}
							onChange={updateVoice}
							onParameterChange={updateVoiceParameter}
						/>
					</div>

					<Show when={audioError()}>
						<div class="audio-notice" role="alert">
							<strong>Audio needs attention.</strong>
							<span>{audioError()}</span>
						</div>
					</Show>
				</div>
			</section>
		</div>
	);
}

type StudioBrowserProps = Readonly<{
	inspection: DocumentInspection;
	onAddMaterial: (kind: 'phrase' | 'step_pattern') => void;
	onAddVoice: () => void;
	onDeleteMaterial: (material: ApplicationMaterial) => void;
	onDeleteVoice: (voice: ApplicationVoice) => void;
	onSelectMaterial: (id: string) => void;
	onSelectVoice: (id: string) => void;
	selectedMaterialId: string | undefined;
	selectedVoiceId: string | undefined;
}>;

function StudioBrowser(props: StudioBrowserProps) {
	return (
		<aside class="studio-browser" aria-label="Voices and materials">
			<section>
				<header>
					<h2>Voices</h2>
					<button type="button" onClick={props.onAddVoice}>
						<span class="icon i-ri-add-line" aria-hidden="true" />
						Add voice
					</button>
				</header>
				<div class="studio-browser__list">
					<For
						each={props.inspection.voices}
						fallback={<p class="studio-browser__empty">Voices connect material to a sound.</p>}>
						{(voice) => (
							<div classList={{ 'browser-item': true, 'is-active': voice.id === props.selectedVoiceId }}>
								<button type="button" onClick={() => props.onSelectVoice(voice.id)}>
									<span>{voice.name}</span>
									<small>{soundLabel(voice.sound)}</small>
								</button>
								<button type="button" aria-label={`Delete ${voice.name}`} onClick={() => props.onDeleteVoice(voice)}>
									<span class="icon i-ri-delete-bin-line" aria-hidden="true" />
								</button>
							</div>
						)}
					</For>
				</div>
			</section>
			<section>
				<header>
					<h2>Materials</h2>
					<div class="browser-add">
						<button type="button" onClick={() => props.onAddMaterial('phrase')}>
							+ Phrase
						</button>
						<button type="button" onClick={() => props.onAddMaterial('step_pattern')}>
							+ Matrix
						</button>
					</div>
				</header>
				<div class="studio-browser__list">
					<For
						each={props.inspection.materials}
						fallback={<p class="studio-browser__empty">Record a phrase or add a blank material.</p>}>
						{(material) => (
							<div classList={{ 'browser-item': true, 'is-active': material.id === props.selectedMaterialId }}>
								<button type="button" onClick={() => props.onSelectMaterial(material.id)}>
									<span>{material.name}</span>
									<small>{materialTypeLabel(material)}</small>
								</button>
								<button
									type="button"
									aria-label={`Delete ${material.name}`}
									onClick={() => props.onDeleteMaterial(material)}>
									<span class="icon i-ri-delete-bin-line" aria-hidden="true" />
								</button>
							</div>
						)}
					</For>
				</div>
			</section>
		</aside>
	);
}

type VoiceInspectorProps = Readonly<{
	materials: readonly ApplicationMaterial[];
	onChange: (voice: ApplicationVoice, changes: Partial<ApplicationVoice>) => void;
	onParameterChange: (voice: ApplicationVoice, name: string, value: number) => void;
	voice: ApplicationVoice | undefined;
}>;

function VoiceInspector(props: VoiceInspectorProps) {
	return (
		<aside class="voice-inspector" aria-label="Voice inspector">
			<header>
				<p>Inspector</p>
				<h2>{props.voice?.name ?? 'No voice selected'}</h2>
			</header>
			<Show
				when={props.voice}
				fallback={<p class="voice-inspector__empty">Select or add a voice to choose its material and sound.</p>}>
				{(voice) => (
					<div class="voice-controls">
						<label class="toggle-control">
							<input
								type="checkbox"
								checked={voice().enabled}
								onChange={(event) => props.onChange(voice(), { enabled: event.currentTarget.checked })}
							/>
							<span>Enabled for playback</span>
						</label>
						<label>
							<span>Name</span>
							<input
								type="text"
								value={voice().name}
								onChange={(event) =>
									props.onChange(voice(), { name: event.currentTarget.value.trim() || voice().name })
								}
							/>
						</label>
						<label>
							<span>Material</span>
							<select
								aria-label="Voice material"
								value={voice().materialId ?? ''}
								onChange={(event) =>
									props.onChange(voice(), {
										pattern: event.currentTarget.value
											? { material_id: event.currentTarget.value, type: 'material' }
											: null
									})
								}>
								<option value="" selected={!voice().materialId}>
									No material
								</option>
								<For each={props.materials}>
									{(material) => (
										<option value={material.id} selected={voice().materialId === material.id}>
											{material.name}
										</option>
									)}
								</For>
							</select>
						</label>
						<label>
							<span>Sound</span>
							<select
								aria-label="Voice sound"
								value={voice().sound}
								onChange={(event) => props.onChange(voice(), { sound: event.currentTarget.value })}>
								<For each={sounds}>
									{(sound) => (
										<option value={sound.id} selected={voice().sound === sound.id}>
											{sound.label}
										</option>
									)}
								</For>
							</select>
						</label>
						<RangeControl
							label="Gain"
							value={integerParameter(voice(), 'gain', 80)}
							min={0}
							max={100}
							onChange={(value) => props.onParameterChange(voice(), 'gain', value)}
						/>
						<RangeControl
							label="Pan"
							value={integerParameter(voice(), 'pan', 0)}
							min={-100}
							max={100}
							onChange={(value) => props.onParameterChange(voice(), 'pan', value)}
						/>
						<RangeControl
							label="Reverb"
							value={integerParameter(voice(), 'reverb', 15)}
							min={0}
							max={100}
							onChange={(value) => props.onParameterChange(voice(), 'reverb', value)}
						/>
						<label>
							<span>
								Filter cutoff <output>{integerParameter(voice(), 'filter_hz', 12_000)} Hz</output>
							</span>
							<input
								type="range"
								min="80"
								max="20000"
								step="100"
								value={integerParameter(voice(), 'filter_hz', 12_000)}
								onChange={(event) => props.onParameterChange(voice(), 'filter_hz', Number(event.currentTarget.value))}
							/>
						</label>
					</div>
				)}
			</Show>
		</aside>
	);
}

type RangeControlProps = Readonly<{
	label: string;
	max: number;
	min: number;
	onChange: (value: number) => void;
	value: number;
}>;

function RangeControl(props: RangeControlProps) {
	return (
		<label>
			<span>
				{props.label}
				<output>{props.value}</output>
			</span>
			<input
				type="range"
				min={props.min}
				max={props.max}
				value={props.value}
				onChange={(event) => props.onChange(Number(event.currentTarget.value))}
			/>
		</label>
	);
}

type PhraseDisplayProps = Readonly<{
	liveNotes: readonly RecordedNote[];
	material: ApplicationMaterial | undefined;
	onQuantize: (id: string) => void;
	recording: boolean;
}>;

function PhraseDisplay(props: PhraseDisplayProps) {
	const phrase = () => (props.material?.type === 'phrase' ? props.material : undefined);
	const notes = () =>
		phrase() ? Object.values(phrase()!.phrase.notes).map((note) => noteToDisplay(note)) : props.liveNotes;
	return (
		<section class="phrase-display" aria-live="polite">
			<header>
				<div>
					<p>{props.recording ? 'Recording' : 'Phrase'}</p>
					<h2>
						{props.recording
							? `${props.liveNotes.length} captured ${plural(props.liveNotes.length, 'note')}`
							: (phrase()?.name ?? 'No phrase selected')}
					</h2>
				</div>
				<Show when={phrase()}>
					{(material) => (
						<button type="button" onClick={() => props.onQuantize(material().id)}>
							Quantize to 1/16
						</button>
					)}
				</Show>
			</header>
			<PhraseRoll notes={notes()} />
			<Show when={!props.recording && notes().length === 0}>
				<p class="phrase-display__empty">Play the keyboard, then record a phrase to see its notes and timing here.</p>
			</Show>
		</section>
	);
}

function PhraseRoll(props: Readonly<{ notes: readonly RecordedNote[] }>) {
	const length = () => Math.max(1, ...props.notes.map((note) => note.onset + note.duration));
	return (
		<Show when={props.notes.length > 0}>
			<div class="phrase-roll" aria-label={`${props.notes.length} recorded ${plural(props.notes.length, 'note')}`}>
				<For each={props.notes}>
					{(note) => (
						<div class="phrase-roll__row">
							<span>{pitchName(note.pitch)}</span>
							<div>
								<i
									style={`--note-left: ${(note.onset / length()) * 100}%; --note-width: ${Math.max((note.duration / length()) * 100, 1.5)}%`}
									title={`${pitchName(note.pitch)}, beat ${note.onset.toFixed(2)}, ${note.duration.toFixed(2)} beats`}
								/>
							</div>
						</div>
					)}
				</For>
			</div>
		</Show>
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

function exactToNumber(value: string): number {
	return Number(exactToDisplay(value));
}

function numberToExact(value: number, positive = false): string {
	const denominator = 1_000_000;
	const numerator = Math.max(positive ? 1 : 0, Math.round(value * denominator));
	const divisor = greatestCommonDivisor(numerator, denominator);
	return `${numerator / divisor}/${denominator / divisor}`;
}

function greatestCommonDivisor(left: number, right: number): number {
	while (right !== 0) [left, right] = [right, left % right];
	return left;
}

function noteToDisplay(note: ApplicationPhraseNote): RecordedNote {
	return {
		duration: exactToNumber(note.time.duration),
		onset: exactToNumber(note.time.onset),
		pitch: note.pitch,
		velocity: note.velocity
	};
}

function formatTime(seconds: number): string {
	const wholeMinutes = Math.floor(seconds / 60);
	const remaining = seconds - wholeMinutes * 60;
	return `${String(wholeMinutes).padStart(2, '0')}:${remaining.toFixed(3).padStart(6, '0')}`;
}

function materialTypeLabel(material: ApplicationMaterial): string {
	if (material.type === 'step_pattern') return 'Matrix';
	if (material.type === 'pitch_set') return 'Pitch set';
	return 'Phrase';
}

function soundLabel(sound: string): string {
	return sounds.find((item) => item.id === sound)?.label ?? sound;
}

function integerParameter(voice: ApplicationVoice, name: string, fallback: number): number {
	const value = voice.parameters[name];
	return value?.type === 'integer' ? value.value : fallback;
}

function viewTitle(view: StudioView): string {
	if (view === 'Matrix') return 'Build a matrix pattern';
	if (view === 'System') return 'Piece overview';
	return 'Play and record';
}

function plural(count: number, singular: string): string {
	return count === 1 ? singular : `${singular}s`;
}

function isTextInput(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
	);
}

function message(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}
