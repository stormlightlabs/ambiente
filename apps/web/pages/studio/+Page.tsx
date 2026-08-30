import { For } from 'solid-js';

import { createShellFixtureApplication } from '../../src/application/shell-fixture';

const application = createShellFixtureApplication();
const inspection = application.inspect();

const views = ['Matrix', 'Phrase', 'System'];

export default function Page() {
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
					Preview mode
				</div>
			</aside>

			<section class="studio-workspace">
				<header class="transport" aria-label="Transport">
					<div class="transport__identity">
						<p>{inspection.title}</p>
						<span>Seed {inspection.seed}</span>
					</div>
					<div class="transport__controls">
						<button type="button" disabled aria-label="Return to start">
							<span class="icon i-bi-skip-start-fill" aria-hidden="true" />
						</button>
						<button type="button" disabled class="transport__play" aria-label="Play">
							<span class="icon i-bi-play-fill" aria-hidden="true" />
						</button>
						<span class="transport__time">00:00.000</span>
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
						<span>1 material · 1 voice</span>
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

					<div class="studio-empty">
						<span class="studio-empty__glyph icon i-ri-sound-module-line" aria-hidden="true" />
						<div>
							<h2>Studio is in preview.</h2>
							<p>
								Editing and playback are not connected yet. This preview shows the Matrix workspace while the Rust
								engine is added.
							</p>
						</div>
						<a class="text-link" href="/docs/architecture">
							View the browser boundary
							<span class="icon i-ri-arrow-right-line" aria-hidden="true" />
						</a>
					</div>
				</div>
			</section>
		</div>
	);
}
