import { For, Show, createEffect, createMemo, createSignal, onMount } from 'solid-js';

import type { ApplicationEvent } from '../../application/facade';
import type { PlayablePiece } from '../../application/site-player';
import { useSitePlayer } from '../../application/site-player';
import { BrandMark } from '../../components/BrandMark';

const listenerCopy = {
	phase: {
		description: 'Bright, spacious lines drift apart and return in changing combinations.',
		mood: 'Open and gently active',
		title: 'Phase'
	},
	drone: {
		description: 'Low sustained tones, soft air, and long stretches of quiet unfold without urgency.',
		mood: 'Still and spacious',
		title: 'Drone'
	},
	pattern: {
		description: 'A soft, syncopated pulse changes shape while keeping a familiar center.',
		mood: 'Steady and lightly rhythmic',
		title: 'Pattern'
	}
} as const;

const sessionDurations = [
	{ label: 'Endless', value: 0 },
	{ label: '15 min', value: 15 },
	{ label: '30 min', value: 30 },
	{ label: '60 min', value: 60 }
] as const;

/** Listener-facing player for Ambiente's first-party pieces. */
export default function Page() {
	const player = useSitePlayer();
	const [durationMinutes, setDurationMinutes] = createSignal(0);
	const [deadline, setDeadline] = createSignal<number>();
	const [sessionComplete, setSessionComplete] = createSignal(false);
	const selectedCopy = createMemo(() => listenerCopy[player.selectedPiece().id as keyof typeof listenerCopy]);
	const remaining = createMemo(() => {
		const end = deadline();
		return end === undefined ? undefined : Math.max(0, end - player.position());
	});
	let selectedId = player.selectedPiece().id;

	onMount(() => void player.prepare());

	createEffect(() => {
		const nextId = player.selectedPiece().id;
		if (nextId !== selectedId) {
			selectedId = nextId;
			setDeadline(undefined);
			setSessionComplete(false);
		}
	});

	createEffect(() => {
		const end = deadline();
		if (end !== undefined && player.state() === 'playing' && player.position() >= end) {
			player.stop();
			setDeadline(undefined);
			setSessionComplete(true);
		}
	});

	function choosePiece(piece: PlayablePiece) {
		player.selectPiece(piece);
		void player.prepare();
	}

	function chooseDuration(minutes: number) {
		setDurationMinutes(minutes);
		setSessionComplete(false);
		setDeadline(minutes > 0 && player.state() === 'playing' ? player.position() + minutes * 60 : undefined);
	}

	async function togglePlayback() {
		if (player.state() !== 'playing') {
			setSessionComplete(false);
			const minutes = durationMinutes();
			if (minutes > 0 && deadline() === undefined) setDeadline(player.position() + minutes * 60);
		}
		await player.togglePlayback();
	}

	return (
		<div class="listen-mode">
			<header class="listen-header">
				<a class="listen-header__brand" href="/" aria-label="Ambiente home">
					<BrandMark />
					<span>ambiente</span>
				</a>
				<p>Listen</p>
				<a href="/studio">Open Studio</a>
			</header>

			<main class="listen-layout">
				<aside class="listen-browser" aria-labelledby="listen-browser-title">
					<div>
						<p class="listen-kicker">Choose a piece</p>
						<h1 id="listen-browser-title">Music for the time you are in</h1>
					</div>
					<div class="listen-browser__pieces">
						<For each={player.pieces}>
							{(piece) => {
								const copy = () => listenerCopy[piece.id as keyof typeof listenerCopy];
								return (
									<button
										type="button"
										class="listen-piece"
										classList={{ 'is-selected': player.selectedPiece().id === piece.id }}
										aria-pressed={player.selectedPiece().id === piece.id}
										onClick={() => choosePiece(piece)}>
										<span>{copy().title}</span>
										<small>{copy().mood}</small>
									</button>
								);
							}}
						</For>
					</div>
				</aside>

				<section class="listen-stage" aria-labelledby="listen-piece-title">
					<ListenerArtwork
						events={player.processEvents()}
						playing={player.state() === 'playing'}
						position={player.position()}
						profile={player.selectedPiece().id as keyof typeof visualProfiles}
						seed={player.seed()}
						tempo={player.tempo()}
					/>
					<div class="listen-now-playing">
						<p>{player.state() === 'playing' ? 'Now playing' : 'Ready to play'}</p>
						<h2 id="listen-piece-title">{selectedCopy().title}</h2>
						<p>{selectedCopy().description}</p>
					</div>
					<div class="listen-transport" aria-label="Playback controls">
						<button
							type="button"
							class="listen-transport__play"
							disabled={player.state() === 'starting'}
							onClick={() => void togglePlayback()}>
							<span
								classList={{
									icon: true,
									'i-bi-pause-fill': player.state() === 'playing',
									'i-bi-play-fill': player.state() !== 'playing'
								}}
								aria-hidden="true"
							/>
							{player.state() === 'playing' ? 'Pause' : 'Play'}
						</button>
						<button type="button" onClick={() => void player.nextVariation()}>
							<span class="icon i-ri-refresh-line" aria-hidden="true" />
							New variation
						</button>
						<label class="listen-volume">
							<span class="icon i-ri-volume-up-line" aria-hidden="true" />
							<span class="sr-only">Listen volume</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={player.volume()}
								onInput={(event) => player.setVolume(event.currentTarget.valueAsNumber)}
							/>
						</label>
					</div>
					<Show when={player.error()}>{(message) => <p class="listen-error">{message()}</p>}</Show>
				</section>

				<aside class="listen-session" aria-labelledby="session-title">
					<div>
						<p class="listen-kicker">Listening mode</p>
						<h2 id="session-title">Shape the piece for this moment</h2>
					</div>
					<div class="listen-purpose" role="group" aria-label="Listening mode">
						<For each={player.purposePresets()}>
							{(preset) => (
								<button
									type="button"
									classList={{ 'is-selected': player.activePurposePreset() === preset.id }}
									aria-pressed={player.activePurposePreset() === preset.id}
									onClick={() => void player.applyPurposePreset(preset.id)}>
									{preset.name}
								</button>
							)}
						</For>
					</div>
					<div class="listen-macros">
						<For each={player.macros()}>
							{(macro) => (
								<label>
									<span>{macro.name}</span>
									<input
										type="range"
										min="0"
										max="100"
										value={macro.value}
										onChange={(event) => void player.setMacro(macro.id, event.currentTarget.valueAsNumber)}
									/>
								</label>
							)}
						</For>
					</div>
					<div>
						<p class="listen-kicker">Session length</p>
					</div>
					<div class="listen-session__durations" role="group" aria-label="Session duration">
						<For each={sessionDurations}>
							{(option) => (
								<button
									type="button"
									classList={{ 'is-selected': durationMinutes() === option.value }}
									aria-pressed={durationMinutes() === option.value}
									onClick={() => chooseDuration(option.value)}>
									{option.label}
								</button>
							)}
						</For>
					</div>
					<p class="listen-session__status" aria-live="polite">
						<Show when={!sessionComplete()} fallback="Session complete. Choose Play when you want to continue.">
							{remaining() === undefined
								? 'Playback will continue until you stop it.'
								: `${formatRemaining(remaining()!)} left`}
						</Show>
					</p>
				</aside>
			</main>
		</div>
	);
}

type VisualProfile = Readonly<{ cycles: readonly number[]; pitchRange: readonly [number, number] }>;

/** Restrained profiles matched to the authored repeat lengths and pitch fields of the Three Studies. */
const visualProfiles: Readonly<Record<'drone' | 'pattern' | 'phase', VisualProfile>> = {
	drone: { cycles: [90, 85, 110], pitchRange: [30, 74] },
	pattern: { cycles: [10 / 3, 20 / 3, 10 / 3], pitchRange: [34, 86] },
	phase: { cycles: [17.2, 23.8, 31.1], pitchRange: [56, 84] }
};

const artworkWindow = { future: 18, past: 12 } as const;

type ListenerArtworkProps = Readonly<{
	events: readonly ApplicationEvent[];
	playing: boolean;
	position: number;
	profile: keyof typeof visualProfiles;
	seed: string;
	tempo: number;
}>;

/** Process artwork derived from canonical event spans, pitch, voices, seed, and playback time. */
function ListenerArtwork(props: ListenerArtworkProps) {
	const profile = () => visualProfiles[props.profile];
	const notes = () => props.events.filter((event) => event.kind.type === 'note');
	const activeNotes = () => notes().filter((event) => eventIsActive(event, props.position, props.tempo));
	const activeVoices = () =>
		new Set(activeNotes().flatMap((event) => (event.target.type === 'voice' ? [event.target.id] : []))).size;
	const density = () => Math.min(1, notes().length / (props.profile === 'pattern' ? 48 : 16));
	const description = () => {
		if (!props.playing) return 'Process artwork waiting for playback.';
		const voiceCount = activeVoices();
		if (voiceCount === 0) return 'Process artwork showing a quiet passage.';
		return `Process artwork showing ${voiceCount} ${voiceCount === 1 ? 'voice' : 'voices'} sounding.`;
	};

	return (
		<figure
			class={`listener-artwork listener-artwork--${props.profile}`}
			classList={{ 'is-playing': props.playing, 'is-silent': props.playing && activeVoices() === 0 }}
			role="img"
			aria-label={description()}>
			<div class="listener-artwork__field" style={`--artwork-density:${density()}`} aria-hidden="true">
				<For each={profile().cycles}>
					{(duration, index) => (
						<i
							class={`listener-artwork__cycle listener-artwork__cycle--${index() + 1}`}
							style={cycleStyle(duration, props.position, props.seed, index())}
						/>
					)}
				</For>
				<For each={notes()}>
					{(event, index) => (
						<i
							class="listener-artwork__event"
							classList={{ 'is-active': eventIsActive(event, props.position, props.tempo) }}
							style={eventStyle(event, index(), props.position, props.tempo, props.seed, profile())}
						/>
					)}
				</For>
			</div>
		</figure>
	);
}

function cycleStyle(duration: number, position: number, seed: string, index: number): string {
	const seedOffset = (hash(`${seed}:${index}`) % 360) / 360;
	const phase = ((position / duration + seedOffset) % 1) * 360;
	return `--cycle-phase:${phase}deg`;
}

function eventStyle(
	event: ApplicationEvent,
	index: number,
	position: number,
	tempo: number,
	seed: string,
	profile: VisualProfile
): string {
	const pitch = event.kind.type === 'note' ? event.kind.note.pitch : 60;
	const velocity = event.kind.type === 'note' ? event.kind.note.velocity : 64;
	const start = eventTimeInSeconds(event.span.start, tempo);
	const end = eventTimeInSeconds(event.span.end, tempo);
	const windowDuration = artworkWindow.past + artworkWindow.future;
	const x = clamp(((start - position + artworkWindow.past) / windowDuration) * 100, 0, 100);
	const width = clamp(((end - start) / windowDuration) * 100, 0.8, 100 - x);
	const register = clamp((pitch - profile.pitchRange[0]) / (profile.pitchRange[1] - profile.pitchRange[0]), 0, 1);
	const identity = event.target.type === 'voice' ? hash(`${seed}:${event.target.id}`) : index;
	const drift = (identity % 9) - 4;
	const color = ['var(--gold)', 'var(--moss)', 'var(--inverse-paper)'][identity % 3];
	return `--event-x:${x}%;--event-y:${88 - register * 76}%;--event-width:${width}%;--event-height:${0.24 + (velocity / 127) * 0.55}rem;--event-drift:${drift}px;--event-color:${color}`;
}

function eventIsActive(event: ApplicationEvent, position: number, tempo: number): boolean {
	return (
		eventTimeInSeconds(event.span.start, tempo) <= position && eventTimeInSeconds(event.span.end, tempo) > position
	);
}

function eventTimeInSeconds(point: ApplicationEvent['span']['start'], tempo: number): number {
	const value = exactToNumber(point.value);
	return point.clock === 'absolute' ? value : (value * 60) / tempo;
}

function exactToNumber(value: string): number {
	const [numerator, denominator] = value.split('/').map(Number);
	return denominator ? numerator! / denominator : Number.NaN;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function hash(value: string): number {
	let result = 0;
	for (const character of value) result = (result * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
	return result;
}

function formatRemaining(seconds: number): string {
	const wholeMinutes = Math.floor(seconds / 60);
	const wholeSeconds = Math.floor(seconds % 60);
	return `${wholeMinutes}:${String(wholeSeconds).padStart(2, '0')}`;
}
