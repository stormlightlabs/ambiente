import { createSignal, onMount } from 'solid-js';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'ambiente-theme';

/** Toggles the site palette and remembers the explicit browser preference. */
export function ThemeToggle() {
	const [theme, setTheme] = createSignal<Theme>('light');

	onMount(() => {
		const saved = localStorage.getItem(STORAGE_KEY);
		const preferred = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		const initial = saved === 'dark' || saved === 'light' ? saved : preferred;
		applyTheme(initial);
		setTheme(initial);
	});

	function toggleTheme() {
		const next = theme() === 'dark' ? 'light' : 'dark';
		localStorage.setItem(STORAGE_KEY, next);
		applyTheme(next);
		setTheme(next);
	}

	return (
		<button
			class="theme-toggle"
			type="button"
			onClick={toggleTheme}
			aria-label={`Use ${theme() === 'dark' ? 'light' : 'dark'} mode`}
			aria-pressed={theme() === 'dark'}>
			<span class={`icon ${theme() === 'dark' ? 'i-ri-sun-line' : 'i-ri-moon-line'}`} aria-hidden="true" />
		</button>
	);
}

function applyTheme(theme: Theme): void {
	document.documentElement.dataset.theme = theme;
	document.documentElement.style.colorScheme = theme;
}
