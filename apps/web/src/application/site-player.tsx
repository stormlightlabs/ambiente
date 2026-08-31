import { createContext, createSignal, onCleanup, useContext, type Accessor, type JSX } from 'solid-js';

import type { LookAheadScheduler, TransportState } from '@ambiente/audio';

import type { WasmApplication } from './facade';

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
	download: (piece: PlayablePiece) => Promise<void>;
	error: Accessor<string | undefined>;
	nextVariation: (piece?: PlayablePiece) => Promise<void>;
	pieces: readonly PlayablePiece[];
	playPiece: (piece: PlayablePiece) => Promise<void>;
	seed: Accessor<string>;
	selectedPiece: Accessor<PlayablePiece>;
	selectPiece: (piece: PlayablePiece) => void;
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
	const [state, setState] = createSignal<TransportState>('stopped');
	const [seed, setSeed] = createSignal('');
	const [volume, setVolumeSignal] = createSignal(0.8);
	const [error, setError] = createSignal<string>();
	let application: WasmApplication | undefined;
	let audio: LookAheadScheduler | undefined;
	let unsubscribe: (() => void) | undefined;
	let initialization: Promise<void> | undefined;

	function disposeAudio() {
		unsubscribe?.();
		audio?.dispose();
		unsubscribe = undefined;
		audio = undefined;
		application = undefined;
		initialization = undefined;
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
			setSeed(application.inspect().seed);
			audio = createBrowserAudio(application);
			audio.setVolume(volume());
			unsubscribe = audio.subscribe(setState);
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
		download,
		error,
		nextVariation,
		pieces: props.pieces,
		playPiece,
		seed,
		selectedPiece,
		selectPiece,
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
