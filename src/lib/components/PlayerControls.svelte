<script lang="ts">
	import { Mode, Note } from '$lib/theory';
	import type { RandomizationParams } from '$lib/types/audio';
	import type { InstrumentType } from '$lib/types/instruments';
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
		randomization: RandomizationParams;
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
		onSetRandomization: (params: Partial<RandomizationParams>) => void;
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
		onSetRandomization,
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
			// NOTE: User gesture triggered - safe to initialize audio context
			await onTogglePlayback();
		} catch (error) {
			console.error('🎮 Error in PlayerControls togglePlayback:', error);
		}
	}

	async function stopPlayback() {
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
			aria-label={selectedPreset ? (audioState.isPlaying ? 'Pause' : 'Play') : 'Select a preset to play'}>
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
			aria-label={selectedPreset ? 'Stop' : 'Select a preset to play'}>
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
		<!-- Controls Grid: 3 columns on large screens, 2 on medium, 1 on small -->
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			<!-- Volume Control -->
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
						aria-label="Volume slider" />
					<span class="text-xs opacity-60">100%</span>
				</div>
			</div>

			<!-- Tempo Control -->
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
						aria-label="Tempo slider" />
					<span class="text-xs opacity-60">200</span>
				</div>
			</div>

			<!-- Randomization Control -->
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs opacity-80">Randomization</span>
				<div class="flex gap-1">
					<button
						class="flex h-10 w-10 items-center justify-center rounded border border-white/30 bg-white/10 text-lg transition-all duration-200 hover:bg-white/20 {audioState
							.randomization.enabled
							? 'bg-white/30 text-yellow-300'
							: ''}"
						onclick={() => onSetRandomization({ enabled: !audioState.randomization.enabled })}
						title={audioState.randomization.enabled ? 'Disable Randomization' : 'Enable Randomization'}
						aria-label="toggle randomization">
						🎲
					</button>
				</div>
				{#if audioState.randomization.enabled}
					<div class="flex flex-col gap-1 text-xs">
						<div class="flex items-center gap-2">
							<span class="w-12 opacity-80">Rhythm</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={audioState.randomization.rhythmVariability}
								oninput={(e) => onSetRandomization({ rhythmVariability: Number(e.currentTarget.value) })}
								class="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-white/20 accent-yellow-300"
								aria-label="Rhythm variability" />
						</div>
						<div class="flex items-center gap-2">
							<span class="w-12 opacity-80">Melody</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.1"
								value={audioState.randomization.melodicVariability}
								oninput={(e) => onSetRandomization({ melodicVariability: Number(e.currentTarget.value) })}
								class="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-white/20 accent-yellow-300"
								aria-label="Melody variability" />
						</div>
						<div class="flex items-center gap-2">
							<span class="w-12 opacity-80">Chords</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={audioState.randomization.chordProgression}
								oninput={(e) => onSetRandomization({ chordProgression: Number(e.currentTarget.value) })}
								class="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-white/20 accent-yellow-300"
								aria-label="Chord progression variability" />
						</div>
					</div>
				{/if}
			</div>

			<!-- History Control -->
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs opacity-80">History</span>
				<div class="flex gap-1">
					<button
						class="flex h-10 w-10 items-center justify-center rounded border border-white/30 bg-white/10 text-lg transition-all duration-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
						onclick={onUndo}
						disabled={!canUndo}
						title="Undo (Ctrl+Z)"
						aria-label="undo">
						<i class="i-carbon-undo h-4 w-4"></i>
					</button>
					<button
						class="flex h-10 w-10 items-center justify-center rounded border border-white/30 bg-white/10 text-lg transition-all duration-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
						onclick={onRedo}
						disabled={!canRedo}
						title="Redo (Ctrl+Y)"
						aria-label="redo">
						<i class="i-carbon-redo h-4 w-4"></i>
					</button>
				</div>
			</div>

			<!-- Active Instruments -->
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs opacity-80">Instruments</span>
				<div class="flex items-center justify-center rounded-lg bg-white/10 p-2">
					<div class="text-center">
						<div class="font-semibold">{audioState.instruments.size}</div>
						<div class="text-xs opacity-60">Active</div>
					</div>
				</div>
			</div>

			<!-- Key & Mode Info -->
			<div class="flex flex-col items-center gap-2">
				<span class="text-xs opacity-80">Key & Mode</span>
				<div class="flex items-center justify-center rounded-lg bg-white/10 p-2">
					<div class="text-center">
						<div class="font-semibold">
							{noteNames[Number(audioState.key)]}
							{modeNames[Number(audioState.mode)]}
						</div>
						<div class="text-xs opacity-60">Current</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Chord Display and Visualization Grid: 2 columns for chord, 1 for visualization -->
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<!-- Chord Display spans 2 columns on large screens -->
			<div class="lg:col-span-2">
				<ChordDisplay
					{currentChordNotes}
					currentChordIndex={audioState.currentChord}
					key={audioState.key}
					mode={audioState.mode} />
			</div>

			<!-- Harmony & Rhythm Visualization -->
			<div class="flex flex-col gap-2">
				<div class="flex-1 rounded-lg bg-white/10 p-4">
					<div class="space-y-3">
						<!-- Harmony Visualization -->
						<div>
							<div class="mb-2 text-xs opacity-70">Harmony</div>
							<div class="flex items-center gap-2">
								{#each currentChordNotes as note, index (note)}
									<div
										class="flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500"
										style="animation-delay: {index * 200}ms">
									</div>
									<span class="text-xs font-bold">{noteNames[note] || '?'}</span>
								{/each}
							</div>
						</div>

						<!-- Rhythm Visualization -->
						<div>
							<div class="mb-2 text-xs opacity-70">Rhythm</div>
							<div class="flex gap-1">
								{#each Array.from({ length: 8 }) as _, index (index)}
									<div
										class="h-2 w-4 rounded-sm bg-gradient-to-r from-green-400 to-emerald-500 {audioState.isPlaying
											? 'animate-pulse'
											: 'opacity-50'}"
										style="animation-delay: {index * 125}ms">
									</div>
								{/each}
							</div>
						</div>

						<!-- Randomization Status -->
						{#if audioState.randomization.enabled}
							<div>
								<div class="mb-2 text-xs opacity-70">Variation</div>
								<div class="flex items-center gap-2">
									<div class="h-3 w-3 animate-bounce rounded-full bg-yellow-300" style="animation-duration: 2s"></div>
									<div class="text-xs opacity-80">
										R: {Math.round(audioState.randomization.rhythmVariability * 100)}%
									</div>
									<div class="text-xs opacity-80">
										M: {Math.round(audioState.randomization.melodicVariability * 100)}%
									</div>
									<div class="text-xs opacity-80">
										C: {Math.round(audioState.randomization.chordProgression * 100)}%
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}

	<div class="rounded bg-black/20 p-2 text-center">
		<div class="text-xs opacity-90">
			<span class="font-semibold">Shortcuts:</span>
			<span class="font-mono">Space</span>=Play/Pause,
			<span class="font-mono">↑↓</span>=Volume,
			<span class="font-mono">←→</span>=Tempo
		</div>
	</div>
</div>
