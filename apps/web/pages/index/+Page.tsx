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
		copy: 'Save the piece and its seed to return to the same musical realization whenever you want to hear it again.'
	}
];

export default function Page() {
	return (
		<>
			<section class="hero">
				<div class="hero__copy">
					<h1>Algorithmic Ambient Composition</h1>
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
				<figure class="composition-map" aria-label="A four-note phrase unfolding into three repeating voices">
					<header class="composition-map__header">
						<div>
							<span>Live document</span>
							<strong>Phase Study</strong>
						</div>
						<small>seed 5048415345000001</small>
					</header>
					<div class="composition-map__material">
						<span>Material</span>
						<div class="phrase-cell" aria-hidden="true">
							<i style="--step: 0; --pitch: 3" />
							<i style="--step: 1; --pitch: 1" />
							<i style="--step: 2; --pitch: 2" />
							<i style="--step: 3; --pitch: 0" />
						</div>
						<small>four-note phrase</small>
					</div>
					<div class="composition-map__process">
						<span>Process</span>
						<div>
							<i /> Repeat every 17.2s <b>high</b>
						</div>
						<div>
							<i /> Repeat every 23.8s <b>middle</b>
						</div>
						<div>
							<i /> Repeat every 31.1s <b>low</b>
						</div>
					</div>
					<div class="composition-map__events" aria-hidden="true">
						<span>Events · 60 seconds</span>
						{[0, 1, 2].map((lane) => (
							<div class={`event-lane event-lane--${lane + 1}`}>
								<i />
								<i />
								<i />
								<i />
								<i />
								<i />
								<i />
								<i />
							</div>
						))}
					</div>
					<figcaption>One phrase. Three exact clocks. The same result for the same seed.</figcaption>
				</figure>
			</section>

			<section class="pathways" aria-labelledby="pathways-title">
				<div class="section-heading">
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
					<p>
						“The considerations that are important, then, become questions of how the system works and most important of
						all what you feed into the system.”
					</p>
					<cite>
						Brian Eno, <a href="https://www.inmotionmagazine.com/eno1.html">“Generative Music” (1996)</a>
					</cite>
				</blockquote>
			</section>
		</>
	);
}
