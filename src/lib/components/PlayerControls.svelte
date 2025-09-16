<script lang="ts">
	import type { InstrumentType } from '$lib/audio';
	import { Mode, Note } from '$lib/theory';
	import type { SvelteSet } from 'svelte/reactivity';
	import ChordDisplay from './ChordDisplay.svelte';

	type AudioState = {
		isPlaying: boolean;
		tempo: number;
		key: Note;
		mode: Mode;
		volume: number;
		currentChord: number;
		instruments: SvelteSet<InstrumentType>;
	};

	type Props = {
		audioState: AudioState;
		canUndo: boolean;
		canRedo: boolean;
		onTogglePlayback: () => Promise<void>;
		onSetVolume: (volume: number) => void;
		onSetTempo: (tempo: number) => void;
		onUndo: () => void;
		onRedo: () => void;
		currentChordNotes?: Note[];
		selectedPreset?: string;
	};

	let {
		audioState,
		canUndo,
		canRedo,
		onTogglePlayback,
		onSetVolume,
		onSetTempo,
		onUndo,
		onRedo,
		currentChordNotes = [],
		selectedPreset
	}: Props = $props();

	const noteNames = Object.keys(Note).filter((key) => Number.isNaN(Number(key)));
	const modeNames = Object.keys(Mode).filter((key) => Number.isNaN(Number(key)));

	async function togglePlayback() {
		if (!selectedPreset) {
			return;
		}
		try {
			// User gesture triggered - safe to initialize audio context
			await onTogglePlayback();
		} catch (error) {
			console.error('🎮 Error in PlayerControls togglePlayback:', error);
		}
	}

	async function stopPlayback() {
		if (!selectedPreset) {
			return;
		}
		if (audioState.isPlaying) {
			await onTogglePlayback();
		}
	}

	function adjustVolume(delta: number) {
		const newVolume = Math.max(0, Math.min(1, audioState.volume + delta));
		onSetVolume(newVolume);
	}

	function adjustTempo(delta: number) {
		const newTempo = Math.max(40, Math.min(200, audioState.tempo + delta));
		onSetTempo(newTempo);
	}

	async function handleKeydown(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
			return;
		}

		switch (event.code) {
			case 'Space': {
				event.preventDefault();
				await togglePlayback();
				break;
			}
			case 'ArrowUp': {
				event.preventDefault();
				adjustVolume(0.05);
				break;
			}
			case 'ArrowDown': {
				event.preventDefault();
				adjustVolume(-0.05);
				break;
			}
			case 'ArrowRight': {
				event.preventDefault();
				adjustTempo(5);
				break;
			}
			case 'ArrowLeft': {
				event.preventDefault();
				adjustTempo(-5);
				break;
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex flex-col gap-4 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-4 text-white shadow-lg">
	<div class="flex justify-center gap-4">
		<button
			class="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-2xl transition-all duration-200 hover:scale-105 hover:border-white/50 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
			onclick={togglePlayback}
			disabled={!selectedPreset}
			title={selectedPreset ? (audioState.isPlaying ? 'Pause' : 'Play') : 'Select a preset to play'}
			aria-label={selectedPreset ? (audioState.isPlaying ? 'Pause' : 'Play') : 'Select a preset to play'}
		>
			{#if audioState.isPlaying}
				<i class="i-bi-pause-fill"></i>
			{:else}
				<i class="i-bi-play-fill"></i>
			{/if}
		</button>

		<button
			class="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-2xl transition-all duration-200 hover:scale-105 hover:border-white/50 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
			onclick={stopPlayback}
			disabled={!selectedPreset || !audioState.isPlaying}
			title={selectedPreset ? 'Stop' : 'Select a preset to play'}
			aria-label={selectedPreset ? 'Stop' : 'Select a preset to play'}
		>
			<i class="i-bi-stop-fill"></i>
		</button>
	</div>

	{#if selectedPreset}
		<div class="flex justify-around rounded-lg bg-white/10 p-3">
			<div class="text-center">
				<div class="mb-1 text-xs opacity-80">Tempo:</div>
				<div class="font-semibold">{audioState.tempo} BPM</div>
			</div>

			<div class="text-center">
				<div class="mb-1 text-xs opacity-80">Key:</div>
				<div class="font-semibold">
					{noteNames[Number(audioState.key)]}
					{modeNames[Number(audioState.mode)]}
				</div>
			</div>

			<div class="text-center">
				<div class="mb-1 text-xs opacity-80">Volume:</div>
				<div class="font-semibold">{Math.round(audioState.volume * 100)}%</div>
			</div>
		</div>
	{:else}
		<div class="flex items-center justify-center rounded-lg bg-white/10 p-4">
			<div class="text-center">
				<div class="text-sm opacity-80">Select a preset to begin</div>
			</div>
		</div>
	{/if}

	{#if selectedPreset}
		<div class="flex flex-col items-center justify-around gap-4 md:flex-row">
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs opacity-80">Volume</span>
				<div class="flex items-center gap-2">
					<span class="text-xs opacity-60">0%</span>
					<input
						type="range"
						min="0"
						max="1"
						step="0.01"
						value={audioState.volume}
						oninput={(e) => onSetVolume(Number(e.currentTarget.value))}
						class="h-2 w-24 cursor-pointer appearance-none rounded-lg bg-white/20 accent-white"
						style="background: linear-gradient(to right, white 0%, white {audioState.volume *
							100}%, rgba(255,255,255,0.2) {audioState.volume * 100}%, rgba(255,255,255,0.2) 100%)"
						aria-label="Volume slider"
					/>
					<span class="text-xs opacity-60">100%</span>
				</div>
			</div>

			<div class="flex flex-col items-center gap-2">
				<span class="text-xs opacity-80">Tempo</span>
				<div class="flex items-center gap-2">
					<span class="text-xs opacity-60">40</span>
					<input
						type="range"
						min="40"
						max="200"
						step="1"
						value={audioState.tempo}
						oninput={(e) => onSetTempo(Number(e.currentTarget.value))}
						class="h-2 w-24 cursor-pointer appearance-none rounded-lg bg-white/20 accent-white"
						style="background: linear-gradient(to right, white 0%, white {((audioState.tempo - 40) / (200 - 40)) *
							100}%, rgba(255,255,255,0.2) {((audioState.tempo - 40) / (200 - 40)) * 100}%, rgba(255,255,255,0.2) 100%)"
						aria-label="Tempo slider"
					/>
					<span class="text-xs opacity-60">200</span>
				</div>
			</div>

			<div class="flex flex-col items-center gap-2">
				<span class="text-xs opacity-80">History</span>
				<div class="flex gap-1">
					<button
						class="flex h-10 w-10 items-center justify-center rounded border border-white/30 bg-white/10 text-lg transition-all duration-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
						onclick={onUndo}
						disabled={!canUndo}
						title="Undo (Ctrl+Z)"
						aria-label="undo"
					>
						<i class="i-carbon-undo h-4 w-4"></i>
					</button>
					<button
						class="flex h-10 w-10 items-center justify-center rounded border border-white/30 bg-white/10 text-lg transition-all duration-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
						onclick={onRedo}
						disabled={!canRedo}
						title="Redo (Ctrl+Y)"
						aria-label="redo"
					>
						<i class="i-carbon-redo h-4 w-4"></i>
					</button>
				</div>
			</div>
		</div>

		<ChordDisplay
			{currentChordNotes}
			currentChordIndex={audioState.currentChord}
			key={audioState.key}
			mode={audioState.mode}
		/>

		<div class="flex items-center justify-center rounded-lg bg-white/10 p-3">
			<div class="text-center">
				<div class="text-sm opacity-80">Active Instruments</div>
				<div class="font-semibold">{audioState.instruments.size}</div>
			</div>
		</div>
	{/if}

	<div class="rounded bg-black/20 p-2 text-center">
		<div class="text-xs opacity-90">
			<span class="font-semibold">Shortcuts:</span>
			<span class="font-mono">Space=Play/Pause, ↑↓=Volume, ←→=Tempo</span>
		</div>
	</div>
</div>
