import { Show, createSignal, onCleanup } from 'solid-js';

import type { LookAheadScheduler, TransportState } from '@ambiente/audio';

import type { StudyName, WasmApplication } from '../application/facade';

/** Properties for a first-party study player embedded in the learning guide. */
export type StudyExampleProps = Readonly<{ study: StudyName }>;

/** Plays and varies one canonical first-party study through the production runtime. */
export function StudyExample(props: StudyExampleProps) {
	const [state, setState] = createSignal<TransportState>('stopped');
	const [seed, setSeed] = createSignal('');
	const [error, setError] = createSignal<string>();
	let application: WasmApplication | undefined;
	let audio: LookAheadScheduler | undefined;
	let unsubscribe: (() => void) | undefined;

	onCleanup(() => {
		unsubscribe?.();
		audio?.dispose();
	});

	async function initialize() {
		if (application && audio) return;
		const [{ createBrowserAudio }, facade] = await Promise.all([
			import('@ambiente/audio'),
			import('../application/facade')
		]);
		application = await facade.WasmApplication.createStudy(props.study);
		setSeed(application.inspect().seed);
		audio = createBrowserAudio(application);
		unsubscribe = audio.subscribe((next) => setState(next));
	}

	async function togglePlayback() {
		setError(undefined);
		try {
			await initialize();
			if (!audio) return;
			if (state() === 'playing') audio.stop();
			else await audio.play();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'This study could not start audio.');
		}
	}

	async function nextVariation() {
		setError(undefined);
		try {
			await initialize();
			if (!application || !audio) return;
			const nextSeed = (BigInt(`0x${application.inspect().seed}`) + 1n).toString(16).padStart(16, '0');
			const diagnostic = application
				.apply({ kind: 'set_seed', payload: nextSeed })
				.find((item) => item.severity === 'error');
			if (diagnostic) throw new Error(diagnostic.message);
			setSeed(nextSeed);
			audio.refreshDocument();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'The variation could not be loaded.');
		}
	}

	async function download() {
		setError(undefined);
		try {
			await initialize();
			if (!application) return;
			const url = URL.createObjectURL(new Blob([application.serialize()], { type: 'application/json' }));
			const anchor = document.createElement('a');
			anchor.download = `${props.study}.ambiente.json`;
			anchor.href = url;
			anchor.click();
			URL.revokeObjectURL(url);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'The study could not be downloaded.');
		}
	}

	return (
		<section class="playable-example" aria-label={`${studyTitle(props.study)} study player`}>
			<div>
				<strong>{studyTitle(props.study)}</strong>
				<p>{studyDescription(props.study)}</p>
				<Show when={seed()}>
					<small>Seed {seed()}</small>
				</Show>
			</div>
			<div class="playable-example__actions">
				<button type="button" onClick={() => void togglePlayback()}>
					{state() === 'playing' ? 'Stop' : 'Play study'}
				</button>
				<button type="button" onClick={() => void nextVariation()}>
					Next variation
				</button>
				<button type="button" onClick={() => void download()}>
					Download for Studio
				</button>
			</div>
			<Show when={error()}>{(message) => <p class="playable-example__error">{message()}</p>}</Show>
		</section>
	);
}

function studyTitle(study: StudyName): string {
	return `${study.charAt(0).toUpperCase()}${study.slice(1)} Study`;
}

function studyDescription(study: StudyName): string {
	if (study === 'phase') return 'One phrase moving through three exact, independent clocks.';
	if (study === 'drone') return 'Four sparse layers of sustained tone, air, motion, and silence.';
	return 'One metric cell transformed across direction, register, density, and pace.';
}
