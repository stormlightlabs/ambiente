import { Show, createSignal, onMount } from 'solid-js';

import type { LookAheadScheduler, TransportState } from '@ambiente/audio';

import type { StudyName, WasmApplication } from '../application/facade';

const studies: ReadonlyArray<Readonly<{ label: string; value: StudyName }>> = [
	{ label: 'Phase Study', value: 'phase' },
	{ label: 'Drone Study', value: 'drone' },
	{ label: 'Pattern Study', value: 'pattern' }
];

/** Persistent site-wide transport for listening while navigating between pages. */
export function GlobalPlayer() {
	const [selectedStudy, setSelectedStudy] = createSignal<StudyName>('phase');
	const [state, setState] = createSignal<TransportState>('stopped');
	const [hydrated, setHydrated] = createSignal(false);
	const [seed, setSeed] = createSignal('');
	const [error, setError] = createSignal<string>();
	let application: WasmApplication | undefined;
	let audio: LookAheadScheduler | undefined;
	let unsubscribe: (() => void) | undefined;

	onMount(() => setHydrated(true));

	async function initialize() {
		if (application && audio) return;
		const [{ createBrowserAudio }, facade] = await Promise.all([
			import('@ambiente/audio'),
			import('../application/facade')
		]);
		application = await facade.WasmApplication.createStudy(selectedStudy());
		setSeed(application.inspect().seed);
		audio = createBrowserAudio(application);
		unsubscribe = audio.subscribe((next) => setState(next));
	}

	async function togglePlayback() {
		setError(undefined);
		try {
			await initialize();
			if (!audio) return;
			if (state() === 'playing') audio.pause();
			else await audio.play();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Audio could not be started.');
		}
	}

	function stop() {
		audio?.stop();
	}

	function changeStudy(study: StudyName) {
		unsubscribe?.();
		audio?.dispose();
		unsubscribe = undefined;
		audio = undefined;
		application = undefined;
		setState('stopped');
		setSeed('');
		setError(undefined);
		setSelectedStudy(study);
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

	return (
		<aside class="global-player" aria-label="Site music player" data-pagefind-ignore>
			<div class="global-player__inner">
				<div class="global-player__identity">
					<span class="global-player__pulse" classList={{ 'is-playing': state() === 'playing' }} aria-hidden="true" />
					<div>
						<strong>Now listening</strong>
						<small>{seed() ? `Seed ${seed()}` : 'Choose a study and press play'}</small>
					</div>
				</div>
				<label class="global-player__study">
					<span>Study</span>
					<select
						disabled={!hydrated()}
						value={selectedStudy()}
						onChange={(event) => changeStudy(event.currentTarget.value as StudyName)}>
						{studies.map((study) => (
							<option value={study.value}>{study.label}</option>
						))}
					</select>
				</label>
				<div class="global-player__controls">
					<button
						type="button"
						class="global-player__play"
						aria-label={state() === 'playing' ? 'Suspend site music' : 'Listen to site music'}
						disabled={!hydrated()}
						onClick={() => void togglePlayback()}>
						<span
							classList={{
								icon: true,
								'i-bi-pause-fill': state() === 'playing',
								'i-bi-play-fill': state() !== 'playing'
							}}
							aria-hidden="true"
						/>
						<span>{state() === 'playing' ? 'Pause' : 'Play'}</span>
					</button>
					<button type="button" aria-label="End site music" onClick={stop} disabled={state() === 'stopped'}>
						Stop
					</button>
					<button type="button" disabled={!hydrated()} onClick={() => void nextVariation()}>
						Next variation
					</button>
				</div>
				<a href={`/docs/three-studies#${selectedStudy()}`}>About this study</a>
			</div>
			<Show when={error()}>{(message) => <p class="global-player__error">{message()}</p>}</Show>
		</aside>
	);
}
