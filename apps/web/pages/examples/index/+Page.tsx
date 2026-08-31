import { For } from 'solid-js';

import type { StudyName } from '../../../src/application/facade';
import { StudyExample } from '../../../src/components/StudyExample';

const studies: ReadonlyArray<Readonly<{ description: string; id: StudyName; number: string; title: string }>> = [
	{
		description: 'A four-note phrase moving through three exact, independent clocks.',
		id: 'phase',
		number: '01',
		title: 'Phase'
	},
	{
		description: 'Sparse sustained layers shaped by omission, register, and silence.',
		id: 'drone',
		number: '02',
		title: 'Drone'
	},
	{
		description: 'One syncopated cell transformed across direction, density, register, and pace.',
		id: 'pattern',
		number: '03',
		title: 'Pattern'
	}
];

export default function Page() {
	return (
		<section class="examples-page">
			<header class="examples-page__intro">
				<p class="kicker">Three Studies</p>
				<h1>
					Small systems.
					<br />
					Recognizable identity.
				</h1>
				<p>
					Each study asks how far a small amount of material can travel without losing its identity. Listen here, change
					the seed, then read how the piece works.
				</p>
			</header>
			<div class="study-list">
				<For each={studies}>
					{(study) => (
						<article class="study-card" id={study.id}>
							<header>
								<span>{study.number}</span>
								<div>
									<h2>{study.title}</h2>
									<p>{study.description}</p>
								</div>
								<a class="text-link" href={`/docs/three-studies#${study.id}`}>
									Read the study <span class="icon i-ri-arrow-right-line" aria-hidden="true" />
								</a>
							</header>
							<StudyExample study={study.id} />
						</article>
					)}
				</For>
			</div>
			<footer class="examples-page__more">
				<p>Want to hear the building blocks on their own?</p>
				<a class="button" href="/docs/solid-components">
					Open instrument examples
				</a>
			</footer>
		</section>
	);
}
