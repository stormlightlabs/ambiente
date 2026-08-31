import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { usePageContext } from 'vike-solid/usePageContext';

import '@fontsource-variable/google-sans';
import '@fontsource-variable/instrument-sans';
import 'virtual:uno.css';

import { FIRST_PARTY_PIECES } from '../src/application/piece-catalog';
import { SitePlayerProvider } from '../src/application/site-player';
import { BrandMark } from '../src/components/BrandMark';
import { DocsSearch } from '../src/components/DocsSearch';
import { GlobalPlayer } from '../src/components/GlobalPlayer';
import { ThemeToggle } from '../src/components/ThemeToggle';
import '../src/styles/global.css';

const navigation = [
	{ href: '/docs', label: 'Docs' },
	{ href: '/learn', label: 'Learn' },
	{ href: '/examples', label: 'Examples' },
	{ href: '/studio', label: 'Studio' }
];

/** Shared application shell for public, documentation, and Studio routes. */
export function Layout(props: { children?: JSX.Element }) {
	const pageContext = usePageContext();
	const pathname = () => pageContext.urlPathname;
	const isStudio = () => pathname().startsWith('/studio');

	return (
		<SitePlayerProvider pieces={FIRST_PARTY_PIECES}>
			<div classList={{ 'site-frame': true, 'site-frame--studio': isStudio() }}>
				<a class="skip-link" href="#main-content">
					Skip to content
				</a>
				<header class="site-header" data-pagefind-ignore>
					<div class="site-header__inner">
						<a class="wordmark" href="/" aria-label="Ambiente home">
							<BrandMark class="wordmark__mark" />
							<span>ambiente</span>
						</a>
						<div class="site-header__actions">
							<DocsSearch />
							<nav class="site-nav" aria-label="Primary navigation">
								{navigation.map((item) => {
									const isActive = () =>
										item.href === '/' ? pathname() === item.href : pathname().startsWith(item.href);
									return (
										<a href={item.href} aria-current={isActive() ? 'page' : undefined}>
											{item.label}
										</a>
									);
								})}
							</nav>
							<ThemeToggle />
						</div>
					</div>
				</header>
				<main id="main-content" class="site-main">
					{props.children}
				</main>
				<Show when={!isStudio()}>
					<SiteFooter />
				</Show>
				<GlobalPlayer />
			</div>
		</SitePlayerProvider>
	);
}

function SiteFooter() {
	return (
		<footer class="site-footer" data-pagefind-ignore>
			<div class="site-footer__inner">
				<div class="site-footer__intro">
					<a class="site-footer__brand" href="/" aria-label="Ambiente home">
						<BrandMark />
						<span>ambiente</span>
					</a>
					<p>Compose repeatable music that keeps changing.</p>
				</div>
				<nav class="site-footer__links" aria-label="Footer navigation">
					<section>
						<h2>Ambiente</h2>
						<a href="/docs">Documentation</a>
						<a href="/studio">Studio</a>
						<a href="https://github.com/stormlightlabs/ambiente">Source</a>
					</section>
					<section>
						<h2>Stormlight Labs</h2>
						<a href="https://stormlightlabs.org">Website</a>
						<a href="https://github.com/stormlightlabs">GitHub</a>
					</section>
					<section>
						<h2>Contact</h2>
						<a href="https://bsky.app/profile/stormlightlabs.org">Bluesky</a>
						<a href="mailto:info@stormlightlabs.org">Email</a>
					</section>
				</nav>
			</div>
			<div class="site-footer__meta">
				<p>© {new Date().getFullYear()} Stormlight Labs</p>
				<p>Made in Austin, Texas</p>
			</div>
		</footer>
	);
}
