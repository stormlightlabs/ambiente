import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';

type PagefindMatch = { excerpt: string; meta?: { title?: string }; url: string };
type PagefindResult = { data: () => Promise<PagefindMatch> };
type Pagefind = { search: (query: string) => Promise<{ results: PagefindResult[] }> };

const pagefindPath = '/pagefind/pagefind.js';
// Vite rejects source imports from public/. Keeping this browser import opaque lets
// the same generated Pagefind module load in development and production.
const importPublicModule = new Function('path', 'return import(path)') as (path: string) => Promise<Pagefind>;
let pagefind: Promise<Pagefind> | undefined;

function getPagefind(): Promise<Pagefind> {
	pagefind ??= importPublicModule(pagefindPath);
	return pagefind;
}

/** Opens a keyboard-accessible command palette backed by the local Pagefind index. */
export function DocsSearch() {
	const [open, setOpen] = createSignal(false);
	const [hydrated, setHydrated] = createSignal(false);
	const [matches, setMatches] = createSignal<PagefindMatch[]>([]);
	const [message, setMessage] = createSignal('Start typing to search the documentation.');
	const [activeIndex, setActiveIndex] = createSignal(-1);
	let dialog: HTMLDialogElement | undefined;
	let input: HTMLInputElement | undefined;
	let returnFocus: HTMLElement | undefined;
	let searchVersion = 0;
	let debounce: ReturnType<typeof setTimeout> | undefined;

	function showSearch() {
		if (!dialog || dialog.open) {
			input?.focus();
			return;
		}
		returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
		setOpen(true);
		dialog.showModal();
		requestAnimationFrame(() => input?.focus());
	}

	function closeSearch() {
		if (dialog?.open) dialog.close();
	}

	function resetSearch() {
		if (input) input.value = '';
		setMatches([]);
		setMessage('Start typing to search the documentation.');
		setActiveIndex(-1);
	}

	async function search(query: string, version: number) {
		setMessage('Searching…');
		try {
			const index = await getPagefind();
			const response = await index.search(query);
			const settled = await Promise.allSettled(response.results.slice(0, 8).map((result) => result.data()));
			const results = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
			if (version !== searchVersion) return;
			if (response.results.length > 0 && results.length === 0)
				throw new Error('Search result fragments were unavailable.');
			setMatches(results);
			setMessage(results.length === 0 ? `No pages match “${query}”.` : `${results.length} results found.`);
			setActiveIndex(-1);
		} catch {
			if (version !== searchVersion) return;
			pagefind = undefined;
			setMatches([]);
			setMessage('Search is unavailable. Browse the documentation index instead.');
		}
	}

	function queueSearch(query: string) {
		if (debounce) clearTimeout(debounce);
		const normalizedQuery = query.trim();
		const version = ++searchVersion;
		setActiveIndex(-1);
		if (!normalizedQuery) {
			setMatches([]);
			setMessage('Start typing to search the documentation.');
			return;
		}
		setMessage('Searching…');
		debounce = setTimeout(() => void search(normalizedQuery, version), 120);
	}

	function moveSelection(direction: number) {
		const count = matches().length;
		if (count === 0) return;
		setActiveIndex((current) => (current + direction + count + (current < 0 && direction < 0 ? 1 : 0)) % count);
	}

	function handleInputKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			moveSelection(event.key === 'ArrowDown' ? 1 : -1);
		} else if (event.key === 'Enter' && activeIndex() >= 0) {
			event.preventDefault();
			const match = matches()[activeIndex()];
			if (match) globalThis.location.href = match.url;
		} else if (event.key === 'Escape') {
			event.preventDefault();
			closeSearch();
		}
	}

	function handleShortcut(event: KeyboardEvent) {
		if (event.defaultPrevented || event.isComposing || event.altKey) return;
		if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
		event.preventDefault();
		showSearch();
	}

	onMount(() => {
		setHydrated(true);
		document.addEventListener('keydown', handleShortcut);
		onCleanup(() => document.removeEventListener('keydown', handleShortcut));
	});

	onCleanup(() => {
		if (debounce) clearTimeout(debounce);
	});

	return (
		<div class="docs-search" data-pagefind-ignore>
			<button
				class="docs-search__trigger"
				type="button"
				aria-label="Open documentation search (Ctrl+K or Cmd+K)"
				disabled={!hydrated()}
				aria-haspopup="dialog"
				aria-expanded={open()}
				onClick={showSearch}>
				<span class="icon i-ri-search-line" aria-hidden="true" />
				<span>Search docs</span>
				<span class="docs-search__shortcut" aria-hidden="true">
					<kbd>⌘</kbd>
					<kbd>K</kbd>
				</span>
			</button>
			<dialog
				ref={dialog}
				class="docs-search__dialog"
				aria-labelledby="docs-search-title"
				onCancel={(event) => {
					event.preventDefault();
					closeSearch();
				}}
				onClose={() => {
					setOpen(false);
					resetSearch();
					returnFocus?.focus({ preventScroll: true });
				}}
				onClick={(event) => {
					if (event.target === dialog) closeSearch();
				}}>
				<div class="docs-search__panel">
					<header>
						<h2 id="docs-search-title">Search documentation</h2>
						<button type="button" aria-label="Close search" onClick={closeSearch}>
							<span class="icon i-ri-close-line" aria-hidden="true" />
						</button>
					</header>
					<label class="docs-search__field">
						<span class="sr-only">Search documentation</span>
						<span class="icon i-ri-search-line" aria-hidden="true" />
						<input
							ref={input}
							type="search"
							role="combobox"
							aria-autocomplete="list"
							aria-expanded={matches().length > 0}
							aria-controls="docs-search-results"
							aria-activedescendant={activeIndex() >= 0 ? `docs-search-result-${activeIndex()}` : undefined}
							placeholder="Search guides and concepts…"
							autocomplete="off"
							onInput={(event) => queueSearch(event.currentTarget.value)}
							onKeyDown={handleInputKeyDown}
						/>
					</label>
					<p class="docs-search__message" role="status">
						{message()}
					</p>
					<Show when={matches().length > 0}>
						<div id="docs-search-results" class="docs-search__results" role="listbox" aria-label="Search results">
							<For each={matches()}>
								{(match, index) => (
									<a
										id={`docs-search-result-${index()}`}
										href={match.url}
										role="option"
										aria-selected={activeIndex() === index()}
										onMouseEnter={() => setActiveIndex(index())}
										onClick={closeSearch}>
										<strong>{match.meta?.title ?? 'Documentation page'}</strong>
										<span innerHTML={match.excerpt} />
									</a>
								)}
							</For>
						</div>
					</Show>
					<footer>
						<kbd>↑</kbd>
						<kbd>↓</kbd> select <kbd>Enter</kbd> open <kbd>Esc</kbd> close
					</footer>
				</div>
			</dialog>
		</div>
	);
}
