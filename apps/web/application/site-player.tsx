import { createContext, createSignal, onCleanup, useContext, type Accessor, type JSX } from 'solid-js';

import type { LookAheadScheduler, TransportState } from '@ambiente/audio';

import type { ApplicationEvent, ApplicationMacro, ApplicationPurposePreset, WasmApplication } from './facade';

/** A canonical piece that the persistent site player can load. */
export type PlayablePiece = Readonly<{
	downloadName: string;
	href: string;
	id: string;
	load: () => Promise<WasmApplication>;
	title: string;
}>;

/** Shared state and controls for persistent piece playback across the site shell. */
export type SitePlayer = Readonly<{
	activeEvents: Accessor<readonly ApplicationEvent[]>;
	activePurposePreset: Accessor<string | undefined>;
	applyPurposePreset: (presetId: string) => Promise<void>;
	download: (piece: PlayablePiece) => Promise<void>;
	error: Accessor<string | undefined>;
	macros: Accessor<readonly ApplicationMacro[]>;
	nextVariation: (piece?: PlayablePiece) => Promise<void>;
	pieces: readonly PlayablePiece[];
	playPiece: (piece: PlayablePiece) => Promise<void>;
	prepare: () => Promise<void>;
	position: Accessor<number>;
	purposePresets: Accessor<readonly ApplicationPurposePreset[]>;
	seed: Accessor<string>;
	selectedPiece: Accessor<PlayablePiece>;
	selectPiece: (piece: PlayablePiece) => void;
	setMacro: (macroId: string, value: number) => Promise<void>;
	setVolume: (volume: number) => void;
	state: Accessor<TransportState>;
	stop: () => void;
	togglePlayback: () => Promise<void>;
	volume: Accessor<number>;
}>;

const SitePlayerContext = createContext<SitePlayer>();

/** Properties for the persistent site player owner. */
export type SitePlayerProviderProps = Readonly<{
	children?: JSX.Element;
	pieces: readonly [PlayablePiece, ...PlayablePiece[]];
}>;

/** Owns the single audio scheduler shared by global and embedded piece controls. */
export function SitePlayerProvider(props: SitePlayerProviderProps) {
	const [selectedPiece, setSelectedPiece] = createSignal(props.pieces[0]);
	const [macros, setMacros] = createSignal<readonly ApplicationMacro[]>([]);
	const [purposePresets, setPurposePresets] = createSignal<readonly ApplicationPurposePreset[]>([]);
	const [activePurposePreset, setActivePurposePreset] = createSignal<string>();
	const [state, setState] = createSignal<TransportState>('stopped');
	const [position, setPosition] = createSignal(0);
	const [activeEvents, setActiveEvents] = createSignal<readonly ApplicationEvent[]>([]);
	const [seed, setSeed] = createSignal('');
	const [volume, setVolumeSignal] = createSignal(0.8);
	const [error, setError] = createSignal<string>();
	let application: WasmApplication | undefined;
	let audio: LookAheadScheduler | undefined;
	let unsubscribe: (() => void) | undefined;
	let initialization: Promise<void> | undefined;
	let activityTick = -1;

	function disposeAudio() {
		unsubscribe?.();
		audio?.dispose();
		unsubscribe = undefined;
		audio = undefined;
		application = undefined;
		initialization = undefined;
		activityTick = -1;
		setActiveEvents([]);
		setMacros([]);
		setPurposePresets([]);
		setActivePurposePreset(undefined);
	}

	onCleanup(disposeAudio);

	async function initialize() {
		if (application && audio) return;
		if (initialization) return initialization;
		const piece = selectedPiece();
		initialization = (async () => {
			const [{ createBrowserAudio }, nextApplication] = await Promise.all([import('@ambiente/audio'), piece.load()]);
			if (piece.id !== selectedPiece().id) return;
			application = nextApplication;
			const inspection = application.inspect();
			setSeed(inspection.seed);
			setMacros(inspection.macros);
			setPurposePresets(inspection.purposePresets);
			audio = createBrowserAudio(application);
			audio.setVolume(volume());
			unsubscribe = audio.subscribe((nextState, nextPosition) => {
				setState(nextState);
				setPosition(nextPosition);
				const nextTick = Math.floor(nextPosition * 10);
				if (nextState !== 'playing') {
					activityTick = -1;
					setActiveEvents([]);
				} else if (nextTick !== activityTick && application) {
					activityTick = nextTick;
					setActiveEvents(queryActiveEvents(application, nextPosition));
				}
			});
		})();
		try {
			await initialization;
		} finally {
			initialization = undefined;
		}
	}

	function selectPiece(piece: PlayablePiece) {
		if (piece.id === selectedPiece().id) return;
		disposeAudio();
		setState('stopped');
		setPosition(0);
		setSeed('');
		setError(undefined);
		setSelectedPiece(piece);
	}

	async function run(action: () => Promise<void>, fallback: string) {
		setError(undefined);
		try {
			await action();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : fallback);
		}
	}

	async function prepare() {
		await run(initialize, 'This piece could not be loaded.');
	}

	async function togglePlayback() {
		await run(async () => {
			await initialize();
			if (!audio) return;
			if (state() === 'playing') audio.pause();
			else await audio.play();
		}, 'Audio could not be started.');
	}

	async function playPiece(piece: PlayablePiece) {
		selectPiece(piece);
		await run(async () => {
			await initialize();
			if (!audio) return;
			if (state() === 'playing') audio.stop();
			else await audio.play();
		}, 'This piece could not start audio.');
	}

	function stop() {
		audio?.stop();
	}

	function setVolume(nextVolume: number) {
		const normalized = Math.min(1, Math.max(0, nextVolume));
		setVolumeSignal(normalized);
		audio?.setVolume(normalized);
	}

	async function setMacro(macroId: string, value: number) {
		await run(async () => {
			await initialize();
			if (!application || !audio) return;
			const diagnostic = application
				.apply({ kind: 'set_macro_value', payload: { id: macroId, value: Math.round(value) } })
				.find((item) => item.severity === 'error');
			if (diagnostic) throw new Error(diagnostic.message);
			setMacros(application.inspect().macros);
			setActivePurposePreset(undefined);
			audio.refreshDocument();
		}, 'The control could not be changed.');
	}

	async function applyPurposePreset(presetId: string) {
		await run(async () => {
			await initialize();
			if (!application || !audio) return;
			const diagnostic = application
				.apply({ kind: 'apply_purpose_preset', payload: presetId })
				.find((item) => item.severity === 'error');
			if (diagnostic) throw new Error(diagnostic.message);
			setMacros(application.inspect().macros);
			setActivePurposePreset(presetId);
			audio.refreshDocument();
		}, 'The listening mode could not be applied.');
	}

	async function nextVariation(piece = selectedPiece()) {
		selectPiece(piece);
		await run(async () => {
			await initialize();
			if (!application || !audio) return;
			const nextSeed = (BigInt(`0x${application.inspect().seed}`) + 1n).toString(16).padStart(16, '0');
			const diagnostic = application
				.apply({ kind: 'set_seed', payload: nextSeed })
				.find((item) => item.severity === 'error');
			if (diagnostic) throw new Error(diagnostic.message);
			setSeed(nextSeed);
			audio.refreshDocument();
		}, 'The variation could not be loaded.');
	}

	async function download(piece: PlayablePiece) {
		selectPiece(piece);
		await run(async () => {
			await initialize();
			if (!application) return;
			const url = URL.createObjectURL(new Blob([application.serialize()], { type: 'application/json' }));
			const anchor = document.createElement('a');
			anchor.download = piece.downloadName;
			anchor.href = url;
			anchor.click();
			URL.revokeObjectURL(url);
		}, 'The piece could not be downloaded.');
	}

	const player: SitePlayer = {
		activeEvents,
		activePurposePreset,
		applyPurposePreset,
		download,
		error,
		macros,
		nextVariation,
		pieces: props.pieces,
		playPiece,
		prepare,
		position,
		purposePresets,
		seed,
		selectedPiece,
		selectPiece,
		setMacro,
		setVolume,
		state,
		stop,
		togglePlayback,
		volume
	};

	return <SitePlayerContext.Provider value={player}>{props.children}</SitePlayerContext.Provider>;
}

/** Returns the persistent player owned by the shared application layout. */
export function useSitePlayer(): SitePlayer {
	const player = useContext(SitePlayerContext);
	if (!player) throw new Error('SitePlayerProvider is missing from the application layout.');
	return player;
}

function queryActiveEvents(application: WasmApplication, position: number): readonly ApplicationEvent[] {
	const inspection = application.inspect();
	const tempo = exactToNumber(inspection.tempo);
	const start = Math.max(0, position - 0.05);
	const end = position + 0.35;
	return [
		...application.queryEvents({ clock: 'absolute', start: numberToExact(start), end: numberToExact(end) }),
		...application.queryEvents({
			clock: 'metric',
			start: numberToExact((start * tempo) / 60),
			end: numberToExact((end * tempo) / 60)
		})
	];
}

function exactToNumber(value: string): number {
	const [numerator, denominator] = value.split('/').map(Number);
	return denominator ? numerator! / denominator : Number.NaN;
}

function numberToExact(value: number): string {
	const denominator = 1000;
	const numerator = Math.max(0, Math.round(value * denominator));
	const divisor = greatestCommonDivisor(numerator, denominator);
	return `${numerator / divisor}/${denominator / divisor}`;
}

function greatestCommonDivisor(left: number, right: number): number {
	while (right !== 0) [left, right] = [right, left % right];
	return left;
}
