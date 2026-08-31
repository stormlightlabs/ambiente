import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';

import type { ApplicationEvent } from '../../src/application/facade';
import type { PlayablePiece } from '../../src/application/site-player';
import { useSitePlayer } from '../../src/application/site-player';
import { BrandMark } from '../../src/components/BrandMark';

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
						events={player.activeEvents()}
						playing={player.state() === 'playing'}
						profile={player.selectedPiece().id}
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
						<p class="listen-kicker">Session</p>
						<h2 id="session-title">How long would you like to listen?</h2>
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

type ListenerArtworkProps = Readonly<{ events: readonly ApplicationEvent[]; playing: boolean; profile: string }>;

/** Event-driven artwork that reflects the notes active in the current piece. */
function ListenerArtwork(props: ListenerArtworkProps) {
	const notes = () => props.events.filter((event) => event.kind.type === 'note');
	return (
		<figure
			class={`listener-artwork listener-artwork--${props.profile}`}
			classList={{ 'is-playing': props.playing }}
			role="img"
			aria-label="Artwork responding to the notes currently sounding">
			<div class="listener-artwork__field" aria-hidden="true">
				<i class="listener-artwork__cycle listener-artwork__cycle--one" />
				<i class="listener-artwork__cycle listener-artwork__cycle--two" />
				<i class="listener-artwork__cycle listener-artwork__cycle--three" />
				<For each={notes()}>
					{(event, index) => <i class="listener-artwork__event" style={eventStyle(event, index())} />}
				</For>
			</div>
		</figure>
	);
}

function eventStyle(event: ApplicationEvent, index: number): string {
	const pitch = event.kind.type === 'note' ? event.kind.note.pitch : 60;
	const velocity = event.kind.type === 'note' ? event.kind.note.velocity : 64;
	const identity = event.target.type === 'voice' ? hash(event.target.id) : index;
	const x = 12 + ((pitch * 13 + identity) % 76);
	const y = 12 + ((pitch * 7 + identity * 3) % 76);
	const size = 0.6 + (velocity / 127) * 1.4;
	return `--event-x:${x}%;--event-y:${y}%;--event-size:${size}rem;--event-delay:${-(identity % 20) / 10}s`;
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
