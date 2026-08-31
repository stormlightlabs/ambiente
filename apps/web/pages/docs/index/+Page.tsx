import { For } from 'solid-js';

import { documentation } from '../../../src/content/docs';

export default function Page() {
	return (
		<div class="content-index">
			<header class="content-index__intro">
				<h1>Learn how Ambiente turns musical material into repeatable events.</h1>
				<p>
					Read how Ambiente represents a piece, produces seeded variation, stores documents, and turns events into
					sound. Search from the top bar or browse every guide below.
				</p>
			</header>
			<div class="content-index__list">
				<For each={documentation}>
					{(document, index) => (
						<a href={document.path} class="content-index__item">
							<span>{String(index() + 1).padStart(2, '0')}</span>
							<div>
								<h2>{document.title}</h2>
								<p>{document.description}</p>
							</div>
							<span class="icon i-ri-arrow-right-line" aria-hidden="true" />
						</a>
					)}
				</For>
			</div>
		</div>
	);
}
