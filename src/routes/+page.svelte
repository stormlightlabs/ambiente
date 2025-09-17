<script lang="ts">
	import { AppStateManager } from '$lib/communication.svelte';
	import PlaybackDisplay from '$lib/components/PlaybackDisplay.svelte';
	import PlayerControls from '$lib/components/PlayerControls.svelte';
	import PresetPlayer from '$lib/components/PresetPlayer.svelte';
	import { playbackStore } from '$lib/stores/playback-store.svelte';
	import { type Note } from '$lib/theory';

	const appState = new AppStateManager();
	let currentChordNotes = $state<Note[]>([]);

	$effect(() => {
		appState.setActiveView('player');
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

<div class="animate-fadeIn grid gap-6 lg:grid-cols-3">
	<div class="lg:col-span-2">
		<PresetPlayer
			currentInstruments={appState.audio.instruments}
			onSetSelectedPreset={appState.setSelectedPreset.bind(appState)}
			onSetTempo={appState.setTempo.bind(appState)}
			onSetKeyAndMode={appState.setKeyAndMode.bind(appState)}
			onSetVolume={appState.setVolume.bind(appState)}
			onToggleInstrument={appState.toggleInstrument.bind(appState)}
			onApplyPresetTexture={appState.applyPresetTexture.bind(appState)}
			onApplyPreset={appState.applyPreset.bind(appState)} />
	</div>

	<div class="lg:col-span-1">
		<PlaybackDisplay
			isTracking={playbackStore.isTracking}
			currentChord={playbackStore.currentChord}
			activeInstrumentsList={playbackStore.activeInstrumentsList}
			currentlyPlayingNotes={playbackStore.currentlyPlayingNotes}
			recentEvents={playbackStore.recentEvents} />
	</div>
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
