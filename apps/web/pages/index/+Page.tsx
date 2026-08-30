import { For } from 'solid-js';

const pathways = [
	{
		index: '01',
		title: 'Start with material',
		copy: 'Play a phrase or draw a step pattern. Its notes and timing remain recognizable as the piece changes.'
	},
	{
		index: '02',
		title: 'Shape a process',
		copy: 'Choose how the material repeats, shifts, transforms, and varies. Each result can be inspected and reproduced.'
	},
	{
		index: '03',
		title: 'Keep the realization',
		copy: 'Save the document and seed to return to the same event stream in the CLI, browser, and future desktop app.'
	}
];

export default function Page() {
	return (
		<>
			<section class="hero">
				<div class="hero__copy">
					<p class="kicker">A generative music instrument</p>
					<h1>
						Compose the system.
						<br />
						Play what emerges.
					</h1>
					<p class="hero__lede">
						Play a phrase or draw a pattern, then shape how it repeats, transforms, and varies. Ambiente keeps each
						result repeatable.
					</p>
					<div class="hero__actions">
						<a class="button button--primary" href="/studio">
							Open Studio
						</a>
						<a class="text-link" href="/docs/composition-model">
							Read the model
							<span class="icon i-ri-arrow-right-line" aria-hidden="true" />
						</a>
					</div>
				</div>
				<div class="score-field" aria-hidden="true">
					<div class="score-field__orbit score-field__orbit--one" />
					<div class="score-field__orbit score-field__orbit--two" />
					<span class="score-note score-note--one" />
					<span class="score-note score-note--two" />
					<span class="score-note score-note--three" />
					<p>
						material <i>→</i> process <i>→</i> events
					</p>
				</div>
			</section>

			<section class="pathways" aria-labelledby="pathways-title">
				<div class="section-heading">
					<p class="kicker">One musical document</p>
					<h2 id="pathways-title">
						Start with a phrase.
						<br />
						Build a piece that keeps moving.
					</h2>
				</div>
				<div class="pathway-list">
					<For each={pathways}>
						{(pathway) => (
							<article class="pathway">
								<span>{pathway.index}</span>
								<h3>{pathway.title}</h3>
								<p>{pathway.copy}</p>
							</article>
						)}
					</For>
				</div>
			</section>

			<section class="principle-band">
				<blockquote>
					“A musician should be able to author recognizable material, let it evolve, and return to the same realization
					later.”
				</blockquote>
				<a class="text-link text-link--light" href="/docs/architecture">
					Explore the architecture
					<span class="icon i-ri-arrow-right-line" aria-hidden="true" />
				</a>
			</section>
		</>
	);
}
