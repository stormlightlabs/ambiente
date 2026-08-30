import { Show, createSignal, onCleanup } from 'solid-js';

import type { LookAheadScheduler, TransportState } from '@ambiente/audio';

import type { ApplicationVoice, WasmApplication } from '../application/facade';

/** Focused production-runtime example shown in a guide. */
export type PlayableExampleKind = 'matrix' | 'phrase' | 'piano' | 'sound' | 'voice';

/** Properties for one focused playable documentation example. */
export type PlayableExampleProps = Readonly<{ kind: PlayableExampleKind }>;

/** Plays a focused lesson through the same WASM facade and audio package as Studio. */
export function PlayableExample(props: PlayableExampleProps) {
	const [state, setState] = createSignal<TransportState>('stopped');
	const [error, setError] = createSignal<string>();
	const [sound, setSound] = createSignal(props.kind === 'voice' ? 'glass' : 'felt-piano');
	let application: WasmApplication | undefined;
	let audio: LookAheadScheduler | undefined;
	let voiceId: string | undefined;
	let unsubscribe: (() => void) | undefined;
	let noteTimer: ReturnType<typeof setTimeout> | undefined;

	onCleanup(() => {
		if (noteTimer) clearTimeout(noteTimer);
		unsubscribe?.();
		audio?.dispose();
	});

	async function initialize() {
		if (application && audio && voiceId) return;
		const [{ createBrowserAudio }, facade] = await Promise.all([
			import('@ambiente/audio'),
			import('../application/facade')
		]);
		application = await facade.WasmApplication.createNew(`${exampleCopy(props.kind).title} example`);
		voiceId = crypto.randomUUID();
		const materialId = props.kind === 'phrase' || props.kind === 'matrix' ? crypto.randomUUID() : undefined;
		if (materialId) {
			apply(
				props.kind === 'phrase'
					? {
							kind: 'add_material',
							payload: {
								id: materialId,
								name: 'Four-note phrase',
								phrase: {
									notes: Object.fromEntries(
										[60, 64, 67, 72].map((pitch, index) => {
											const id = crypto.randomUUID();
											const onsets = ['0/1', '1/2', '1/1', '3/2'];
											return [
												id,
												{ id, pitch, time: { clock: 'metric', duration: '1/2', onset: onsets[index] }, velocity: 92 }
											];
										})
									)
								},
								type: 'phrase'
							}
						}
					: {
							kind: 'add_material',
							payload: {
								id: materialId,
								name: 'Five-note matrix',
								pattern: {
									rows: [72, 67, 64, 62, 60].map((pitch, row) => ({
										cells: Array.from({ length: 8 }, (_, step) => ({ active: (step + row * 2) % 8 === 0 })),
										pitch
									})),
									steps: 8,
									subdivision: '1/2'
								},
								type: 'step_pattern'
							}
						}
			);
		}
		apply({
			kind: 'add_voice',
			payload: {
				id: voiceId,
				settings: {
					enabled: true,
					name: props.kind === 'voice' ? 'Glass voice' : 'Example voice',
					parameters: props.kind === 'voice' ? { reverb: { type: 'integer', value: 55 } } : {},
					pattern: materialId ? { material_id: materialId, type: 'material' } : null,
					sound: sound()
				}
			}
		});
		audio = createBrowserAudio(application);
		unsubscribe = audio.subscribe((next) => setState(next));
	}

	function apply(operation: Readonly<{ kind: string; payload?: unknown }>) {
		const diagnostic = application?.apply(operation).find((item) => item.severity === 'error');
		if (diagnostic) throw new Error(diagnostic.message);
	}

	async function play() {
		setError(undefined);
		try {
			await initialize();
			if (!audio || !voiceId) return;
			if (props.kind === 'phrase' || props.kind === 'matrix') {
				if (state() === 'playing') audio.stop();
				else await audio.play();
				return;
			}
			await audio.previewNoteOn(voiceId, props.kind === 'voice' ? 67 : 60);
			if (noteTimer) clearTimeout(noteTimer);
			noteTimer = setTimeout(() => audio?.previewNoteOff(voiceId!, props.kind === 'voice' ? 67 : 60), 650);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'This example could not start audio.');
		}
	}

	function changeSound(nextSound: string) {
		setSound(nextSound);
		if (!application || !audio || !voiceId) return;
		const voice = application.inspect().voices.find((item) => item.id === voiceId);
		if (!voice) return;
		apply({ kind: 'update_voice_settings', payload: { id: voice.id, settings: voiceSettings(voice, nextSound) } });
		audio.refreshDocument();
	}

	const copy = () => exampleCopy(props.kind);
	return (
		<section class="playable-example" aria-label={`${copy().title} playable example`}>
			<div>
				<strong>{copy().title}</strong>
				<p>{copy().description}</p>
			</div>
			<Show when={props.kind === 'sound'}>
				<label>
					<span>Sound</span>
					<select value={sound()} onChange={(event) => changeSound(event.currentTarget.value)}>
						<option value="felt-piano">Felt piano</option>
						<option value="glass">Glass</option>
						<option value="warm-drone">Warm drone</option>
						<option value="soft-pluck">Soft pluck</option>
						<option value="air">Air</option>
						<option value="percussion">Percussion</option>
					</select>
				</label>
			</Show>
			<button type="button" onClick={() => void play()}>
				{state() === 'playing' ? 'Stop' : copy().action}
			</button>
			<Show when={error()}>{(message) => <p class="playable-example__error">{message()}</p>}</Show>
		</section>
	);
}

function voiceSettings(voice: ApplicationVoice, sound: string) {
	return { enabled: voice.enabled, name: voice.name, parameters: voice.parameters, pattern: voice.pattern, sound };
}

function exampleCopy(kind: PlayableExampleKind): Readonly<{ action: string; description: string; title: string }> {
	if (kind === 'phrase')
		return { action: 'Play phrase', description: 'Four recorded notes played from Phrase material.', title: 'Phrase' };
	if (kind === 'matrix')
		return {
			action: 'Play matrix',
			description: 'An eight-step pattern generated from canonical matrix cells.',
			title: 'Matrix'
		};
	if (kind === 'piano')
		return { action: 'Play C4', description: 'One direct note through the Studio piano preview path.', title: 'Piano' };
	if (kind === 'voice')
		return { action: 'Play voice', description: 'A glass voice with its persisted reverb setting.', title: 'Voice' };
	return {
		action: 'Play sound',
		description: 'Choose a production sound preset, then play the same pitch.',
		title: 'Sound'
	};
}
