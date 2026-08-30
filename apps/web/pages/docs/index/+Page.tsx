import { For } from 'solid-js';

import { DocsSearch } from '../../../src/components/DocsSearch';
import { documentation } from '../../../src/content/docs';

export default function Page() {
	return (
		<div class="content-index">
			<header class="content-index__intro">
				<p class="kicker">Documentation</p>
				<h1>
					Understand
					<br />
					Ambiente.
				</h1>
				<p>
					Learn how Ambiente represents a piece, produces repeatable variation, stores documents, and turns events into
					sound.
				</p>
				<DocsSearch />
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
