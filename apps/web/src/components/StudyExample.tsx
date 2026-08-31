import { Show } from 'solid-js';

import type { StudyName } from '../application/facade';
import { playableStudy } from '../application/piece-catalog';
import { useSitePlayer } from '../application/site-player';

/** Properties for a first-party study player embedded in the listening guide. */
export type StudyExampleProps = Readonly<{ study: StudyName }>;

/** Controls one canonical Study through the site-wide shared transport. */
export function StudyExample(props: StudyExampleProps) {
	const player = useSitePlayer();
	const piece = () => playableStudy(props.study);
	const isSelected = () => player.selectedPiece().id === piece().id;
	const isPlaying = () => isSelected() && player.state() === 'playing';

	return (
		<section class="playable-example" aria-label={`${studyTitle(props.study)} study player`}>
			<div>
				<strong>{studyTitle(props.study)}</strong>
				<p>{studyDescription(props.study)}</p>
				<Show when={isSelected() && player.seed()}>
					<small>Seed {player.seed()}</small>
				</Show>
			</div>
			<div class="playable-example__actions">
				<button type="button" onClick={() => void player.playPiece(piece())}>
					{isPlaying() ? 'Stop' : 'Play study'}
				</button>
				<button type="button" onClick={() => void player.nextVariation(piece())}>
					Next variation
				</button>
				<button type="button" onClick={() => void player.download(piece())}>
					Download for Studio
				</button>
			</div>
			<Show when={isSelected() && player.error()}>
				{(message) => <p class="playable-example__error">{message()}</p>}
			</Show>
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
