<script lang="ts">
	import { AppStateManager } from '$lib/communication.svelte';
	import CompositionCreator from '$lib/components/CompositionCreator.svelte';
	import PlayerControls from '$lib/components/PlayerControls.svelte';
	import { type Note } from '$lib/theory';
	import { onMount } from 'svelte';

	const appState = new AppStateManager();
	let currentChordNotes = $state<Note[]>([]);

	onMount(() => {
		appState.setActiveView('composer');
		const subscription = appState.getCurrentChord$().subscribe((notes) => (currentChordNotes = notes));
		return () => subscription.unsubscribe();
	});
</script>

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

<div class="animate-fadeIn">
	<CompositionCreator
		audioState={appState.audio}
		onSetTempo={appState.setTempo.bind(appState)}
		onSetKeyAndMode={appState.setKeyAndMode.bind(appState)}
		onSetVolume={appState.setVolume.bind(appState)}
		onToggleInstrument={appState.toggleInstrument.bind(appState)} />
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
