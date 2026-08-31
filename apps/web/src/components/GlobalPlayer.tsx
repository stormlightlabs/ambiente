import { Show, createSignal, onMount } from 'solid-js';

import { useSitePlayer } from '../application/site-player';

/** Persistent site-wide controls for the shared piece transport. */
export function GlobalPlayer() {
	const player = useSitePlayer();
	const [hydrated, setHydrated] = createSignal(false);

	onMount(() => setHydrated(true));

	return (
		<aside class="global-player" aria-label="Site music player" data-pagefind-ignore>
			<div class="global-player__inner">
				<div class="global-player__identity">
					<span
						class="global-player__pulse"
						classList={{ 'is-playing': player.state() === 'playing' }}
						aria-hidden="true"
					/>
					<div>
						<strong>{player.selectedPiece().title}</strong>
						<Show when={player.seed()}>{(seed) => <small>Seed {seed()}</small>}</Show>
					</div>
				</div>
				<label class="global-player__piece">
					<span>Piece</span>
					<select
						disabled={!hydrated()}
						value={player.selectedPiece().id}
						onChange={(event) => {
							const piece = player.pieces.find((candidate) => candidate.id === event.currentTarget.value);
							if (piece) player.selectPiece(piece);
						}}>
						{player.pieces.map((piece) => (
							<option value={piece.id}>{piece.title}</option>
						))}
					</select>
				</label>
				<div class="global-player__controls">
					<button
						type="button"
						class="global-player__play"
						aria-label={player.state() === 'playing' ? 'Pause site music' : 'Play site music'}
						disabled={!hydrated()}
						onClick={() => void player.togglePlayback()}>
						<span
							classList={{
								icon: true,
								'i-bi-pause-fill': player.state() === 'playing',
								'i-bi-play-fill': player.state() !== 'playing'
							}}
							aria-hidden="true"
						/>
						<span>{player.state() === 'playing' ? 'Pause' : 'Play'}</span>
					</button>
					<button
						type="button"
						aria-label="Stop site music"
						onClick={player.stop}
						disabled={player.state() === 'stopped'}>
						Stop
					</button>
					<button type="button" disabled={!hydrated()} onClick={() => void player.nextVariation()}>
						Next variation
					</button>
				</div>
				<label class="global-player__volume">
					<span class="icon i-ri-volume-up-line" aria-hidden="true" />
					<span class="sr-only">Site player volume</span>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={player.volume()}
						onInput={(event) => player.setVolume(event.currentTarget.valueAsNumber)}
					/>
				</label>
				<a href={player.selectedPiece().href}>About this piece</a>
			</div>
			<Show when={player.error()}>{(message) => <p class="global-player__error">{message()}</p>}</Show>
		</aside>
	);
}
