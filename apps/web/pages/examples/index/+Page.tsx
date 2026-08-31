import { For } from 'solid-js';

import { PlayableExample, type PlayableExampleKind } from '../../../src/components/PlayableExample';

const examples: ReadonlyArray<
	Readonly<{ description: string; id: PlayableExampleKind; number: string; title: string }>
> = [
	{
		description: 'Hear four notes stored with exact onset and duration.',
		id: 'phrase',
		number: '01',
		title: 'Phrase material'
	},
	{
		description: 'Hear active cells from a canonical eight-step matrix.',
		id: 'matrix',
		number: '02',
		title: 'Matrix pattern'
	},
	{
		description: 'Preview one note through the same direct-input path as Studio.',
		id: 'piano',
		number: '03',
		title: 'Piano input'
	},
	{
		description: 'Hear how a voice connects musical material to a sound.',
		id: 'voice',
		number: '04',
		title: 'Voice settings'
	},
	{
		description: 'Compare the stable sound names available to every piece.',
		id: 'sound',
		number: '05',
		title: 'Sound palette'
	}
];

export default function Page() {
	return (
		<section class="examples-page">
			<header class="examples-page__intro">
				<h1>Hear Ambiente’s musical building blocks.</h1>
				<p>
					These focused examples use the same Rust document runtime and browser audio scheduler as Studio. Start with a
					phrase, matrix, voice, or sound, then hear them combined in the Three Studies.
				</p>
			</header>
			<div class="study-list">
				<For each={examples}>
					{(example) => (
						<article class="study-card" id={example.id}>
							<header>
								<span>{example.number}</span>
								<div>
									<h2>{example.title}</h2>
									<p>{example.description}</p>
								</div>
							</header>
							<PlayableExample kind={example.id} />
						</article>
					)}
				</For>
			</div>
			<footer class="examples-page__more">
				<div>
					<strong>Hear complete pieces</strong>
					<p>Phase, Drone, and Pattern combine these primitives into repeatable compositions.</p>
				</div>
				<a class="button button--primary" href="/docs/three-studies">
					Listen to the Three Studies
				</a>
			</footer>
		</section>
	);
}
