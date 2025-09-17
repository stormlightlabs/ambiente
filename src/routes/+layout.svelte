<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import { AppStateManager } from '$lib/communication.svelte';
	import '@fontsource-variable/public-sans';
	import '@fontsource-variable/sora';
	import '@fontsource-variable/work-sans';
	import '@fontsource/spectral';
	import { twMerge } from 'tailwind-merge';
	import '../app.css';

	let { children } = $props();
	let isDarkMode = $state(true);
	const appState = new AppStateManager();

	function toggleDarkMode() {
		isDarkMode = !isDarkMode;
		if (browser) {
			document.documentElement.classList.toggle('dark', isDarkMode);
		}
	}

	$effect(() => {
		if (browser) {
			document.documentElement.classList.toggle('dark', isDarkMode);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Ambiente</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-surface-100 dark:bg-surface-900">
	<header
		class="bg-gradient-to-br from-primary-500 to-secondary-500 p-8 text-center text-white shadow-lg dark:from-primary-600 dark:to-secondary-600">
		<h1 class="mb-2 font-title text-4xl font-semibold tracking-widest md:text-5xl">Ambiente</h1>
		<p class="font-display text-lg font-normal opacity-90">Reactive Ambient Music Generator</p>
		<button
			onclick={toggleDarkMode}
			class="absolute top-4 right-4 flex items-center rounded-lg bg-white/20 p-2 text-xl text-white transition-colors hover:bg-white/30"
			title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
			{#if isDarkMode}
				<i class="i-bi-sun-fill"></i>
			{:else}
				<i class="i-bi-moon-stars-fill"></i>
			{/if}
		</button>
	</header>

	<nav
		class="flex items-center justify-center border-b border-surface-200 bg-surface-50 shadow-sm dark:border-surface-700 dark:bg-surface-950">
		<a
			href={resolve('/')}
			class={twMerge(
				'cursor-pointer border-b-3 px-8 py-4 text-base transition-all duration-200',
				'flex items-center gap-2',
				page.route.id === '/'
					? 'border-primary-600 bg-primary-50 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400'
					: [
							'border-transparent text-surface-600 hover:bg-surface-100 hover:text-surface-800',
							'dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-surface-100'
						].join(',')
			)}>
			<span class="i-bi-play-circle"></span><span>Player</span>
		</a>
		<a
			href={resolve('/composer')}
			class={twMerge(
				'cursor-pointer border-b-3 px-8 py-4 text-base transition-all duration-200',
				'flex items-center gap-2',
				page.route.id === '/composer'
					? 'border-primary-600 bg-primary-50 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400'
					: [
							'border-transparent text-surface-600 hover:bg-surface-100 hover:text-surface-800',
							'dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-surface-100'
						].join(',')
			)}>
			<span class="i-bi-music-note-beamed"></span><span>Composer</span>
		</a>
		<a
			href={resolve('/sequencer')}
			class={twMerge(
				'flex items-center gap-2',
				'cursor-pointer border-b-3 px-8 py-4 text-base transition-all duration-200',
				page.route.id === '/sequencer'
					? 'border-primary-600 bg-primary-50 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400'
					: [
							'border-transparent text-surface-600 hover:bg-surface-100 hover:text-surface-800',
							'dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-surface-100'
						].join(','),
				'opacity-75'
			)}>
			<span class="i-bi-grid-3x3-gap"></span><span>Sequencer</span>
		</a>
	</nav>

	<main class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-8">
		{@render children?.()}
	</main>

	<footer
		class="border-t border-surface-200 bg-surface-50 p-4 shadow-sm md:p-8 dark:border-surface-700 dark:bg-surface-950">
		<div class="flex flex-wrap items-center justify-center gap-8 text-sm text-surface-600 dark:text-surface-300">
			<span class="flex items-center gap-2 font-medium">
				{appState.ui.isInitialized ? '🟢 Engine Ready' : '🔴 Engine Stopped '}
			</span>

			{#if appState.ui.selectedPreset}
				<span class="flex items-center gap-2">
					Preset: {appState.ui.selectedPreset}
				</span>
			{/if}

			<span class="flex items-center gap-2">
				View: {page.route.id === '/' ? 'Player' : page.route.id === '/composer' ? 'Composer' : 'Sequencer'}
			</span>
		</div>
	</footer>
</div>
