import { For, createSignal, onCleanup, onMount } from 'solid-js';

import documentFixture from '../../../../crates/wasm/tests/fixtures/conformance-document.json?raw';
import type { LookAheadScheduler, TransportState } from '@ambiente/audio';

import { createShellFixtureApplication } from '../../src/application/shell-fixture';

const initialInspection = createShellFixtureApplication().inspect();
const views = ['Matrix', 'Phrase', 'System'];

export default function Page() {
	const [inspection, setInspection] = createSignal(initialInspection);
	const [position, setPosition] = createSignal(0);
	const [state, setState] = createSignal<TransportState>('stopped');
	const [ready, setReady] = createSignal(false);
	const [audioError, setAudioError] = createSignal<string>();
	let audio: LookAheadScheduler | undefined;
	let unsubscribe: (() => void) | undefined;

	onMount(() => {
		void initializeAudio();
	});
	onCleanup(() => {
		unsubscribe?.();
		audio?.dispose();
	});

	async function initializeAudio() {
		try {
			const [{ createBrowserAudio }, { WasmApplication }] = await Promise.all([
				import('@ambiente/audio'),
				import('../../src/application/facade')
			]);
			const application = await WasmApplication.create(documentFixture);
			setInspection(application.inspect());
			audio = createBrowserAudio(application);
			unsubscribe = audio.subscribe((nextState, nextPosition) => {
				setState(nextState);
				setPosition(nextPosition);
			});
			setReady(true);
		} catch (error) {
			setAudioError(error instanceof Error ? error.message : 'Browser audio could not be initialized.');
		}
	}

	async function togglePlayback() {
		if (!audio) return;
		setAudioError(undefined);
		if (audio.state === 'playing') {
			audio.pause();
			return;
		}
		try {
			await audio.play();
		} catch (error) {
			setAudioError(error instanceof Error ? error.message : 'Browser audio could not be started.');
		}
	}

	return (
		<div class="studio-shell">
			<aside class="studio-rail" aria-label="Studio views">
				<p>Views</p>
				<nav>
					<For each={views}>
						{(view, index) => (
							<button type="button" classList={{ 'is-active': index() === 0 }} disabled={index() !== 0}>
								<span aria-hidden="true">{index() + 1}</span>
								{view}
							</button>
						)}
					</For>
				</nav>
				<div class="studio-rail__status">
					<span aria-hidden="true" />
					{ready() ? 'Rust audio ready' : 'Loading audio'}
				</div>
			</aside>

			<section class="studio-workspace">
				<header class="transport" aria-label="Transport">
					<div class="transport__identity">
						<p>{inspection().title}</p>
						<span>Seed {inspection().seed}</span>
					</div>
					<div class="transport__controls">
						<button type="button" disabled={!ready()} aria-label="Stop" onClick={() => audio?.stop()}>
							<span class="icon i-bi-skip-start-fill" aria-hidden="true" />
						</button>
						<button
							type="button"
							disabled={!ready() || state() === 'starting'}
							class="transport__play"
							aria-label={state() === 'playing' ? 'Pause' : 'Play'}
							onClick={() => void togglePlayback()}>
							<span class={`icon ${state() === 'playing' ? 'i-bi-pause-fill' : 'i-bi-play-fill'}`} aria-hidden="true" />
						</button>
						<span class="transport__time">{formatTime(position())}</span>
					</div>
					<button class="transport__save" type="button" disabled>
						<span class="icon i-ri-save-line" aria-hidden="true" />
						Save
					</button>
				</header>

				<div class="studio-canvas">
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

function formatTime(seconds: number): string {
	const wholeMinutes = Math.floor(seconds / 60);
	const remaining = seconds - wholeMinutes * 60;
	return `${String(wholeMinutes).padStart(2, '0')}:${remaining.toFixed(3).padStart(6, '0')}`;
}
