<script lang="ts">
	import type { AppStateManager } from '$lib/communication.svelte.ts';
	import { type Note } from '$lib/theory';
	import CompositionCreator from './CompositionCreator.svelte';
	import PlayerControls from './PlayerControls.svelte';
	import PresetPlayer from './PresetPlayer.svelte';

	let { appState }: { appState: AppStateManager } = $props();
	let activeTab = $state<'player' | 'composer' | 'sequencer'>('player');
	let currentChordNotes = $state<Note[]>([]);

	function setActiveTab(tab: 'player' | 'composer' | 'sequencer') {
		activeTab = tab;
		appState.setActiveView(tab === 'player' ? 'player' : 'composer');
	}

	$effect(() => {
		const subscription = appState.getCurrentChord$().subscribe((notes) => (currentChordNotes = notes));
		return () => subscription.unsubscribe();
	});
</script>

<div class="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-300">
	<header class="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 text-center text-white shadow-lg">
		<h1 class="mb-2 text-4xl font-semibold tracking-widest md:text-5xl">Ambiente</h1>
		<p class="text-lg font-normal opacity-90">Reactive Ambient Music Generator</p>
	</header>

	<nav class="flex justify-center border-b border-gray-200 bg-white shadow-sm">
		<button
			class="cursor-pointer border-b-3 px-8 py-4 text-base transition-all duration-200 {activeTab === 'player'
				? 'border-indigo-600 bg-indigo-50 text-indigo-600'
				: 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-800'}"
			onclick={() => setActiveTab('player')}>
			🎵 Player
		</button>
		<button
			class="cursor-pointer border-b-3 px-8 py-4 text-base transition-all duration-200 {activeTab === 'composer'
				? 'border-indigo-600 bg-indigo-50 text-indigo-600'
				: 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-800'}"
			onclick={() => setActiveTab('composer')}>
			🎹 Composer
		</button>
		<button
			class="cursor-pointer border-b-3 px-8 py-4 text-base transition-all duration-200 {activeTab === 'sequencer'
				? 'border-indigo-600 bg-indigo-50 text-indigo-600'
				: 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-800'}"
			onclick={() => setActiveTab('sequencer')}
			disabled>
			Sequencer
		</button>
	</nav>

	<main class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-8">
		<PlayerControls
			audioState={appState.audio}
			canUndo={appState.canUndo}
			canRedo={appState.canRedo}
			onTogglePlayback={appState.togglePlayback.bind(appState)}
			onSetVolume={appState.setVolume.bind(appState)}
			onSetTempo={appState.setTempo.bind(appState)}
			onUndo={appState.undo.bind(appState)}
			onRedo={appState.redo.bind(appState)}
			onSetRandomization={appState.setRandomization.bind(appState)}
			{currentChordNotes}
			selectedPreset={appState.ui.selectedPreset} />

		{#if activeTab === 'player'}
			<div class="animate-fadeIn">
				<PresetPlayer
					currentInstruments={appState.audio.instruments}
					onSetSelectedPreset={appState.setSelectedPreset.bind(appState)}
					onSetTempo={appState.setTempo.bind(appState)}
					onSetKeyAndMode={appState.setKeyAndMode.bind(appState)}
					onSetVolume={appState.setVolume.bind(appState)}
					onToggleInstrument={appState.toggleInstrument.bind(appState)} />
			</div>
		{:else if activeTab === 'composer'}
			<div class="animate-fadeIn">
				<CompositionCreator
					audioState={appState.audio}
					onSetTempo={appState.setTempo.bind(appState)}
					onSetKeyAndMode={appState.setKeyAndMode.bind(appState)}
					onSetVolume={appState.setVolume.bind(appState)}
					onToggleInstrument={appState.toggleInstrument.bind(appState)} />
			</div>
		{:else}
			<div class="animate-fadeIn">Coming Soon!</div>
		{/if}
	</main>

	<footer class="border-t border-gray-200 bg-white p-4 shadow-sm md:p-8">
		<div class="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-600">
			<span class="flex items-center gap-2 font-medium">
				{appState.ui.isInitialized ? '🟢 Engine Ready' : '🔴 Engine Stopped '}
			</span>

			{#if appState.ui.selectedPreset}
				<span class="flex items-center gap-2">
					Preset: {appState.ui.selectedPreset}
				</span>
			{/if}

			<span class="flex items-center gap-2">
				View: {activeTab === 'player' ? 'Player' : 'Composer'}
			</span>
		</div>
	</footer>
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-fadeIn {
		animation: fadeIn 0.3s ease-in-out;
	}
</style>
