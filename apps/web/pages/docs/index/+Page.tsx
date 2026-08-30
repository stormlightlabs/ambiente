import { For } from 'solid-js';

import { DocsSearch } from '../../../src/components/DocsSearch';
import { documentation } from '../../../src/content/docs';

export default function Page() {
	return (
		<div class="content-index">
			<header class="content-index__intro">
				<p class="kicker">Documentation</p>
				<h1>
					See how the parts
					<br />
					fit together.
				</h1>
				<p>These guides explain the document model, event engine, browser boundary, and audio runtime.</p>
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
