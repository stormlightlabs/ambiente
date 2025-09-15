<script lang="ts">
	import type { InstrumentType } from '$lib/audio';
	import { Mode, Note } from '$lib/theory';

	type AudioState = {
		isPlaying: boolean;
		tempo: number;
		key: Note;
		mode: Mode;
		volume: number;
		currentChord: number;
		instruments: Set<InstrumentType>;
	};

	type Props = {
		audioState: AudioState;
		canUndo: boolean;
		canRedo: boolean;
		onTogglePlayback: () => void;
		onSetVolume: (volume: number) => void;
		onSetTempo: (tempo: number) => void;
		onUndo: () => void;
		onRedo: () => void;
	};

	let {
		audioState,
		canUndo,
		canRedo,
		onTogglePlayback,
		onSetVolume,
		onSetTempo,
		onUndo,
		onRedo
	}: Props = $props();

	const noteNames = Object.keys(Note).filter((key) => Number.isNaN(Number(key)));
	const modeNames = Object.keys(Mode).filter((key) => Number.isNaN(Number(key)));

	function togglePlayback() {
		onTogglePlayback();
	}

	function stopPlayback() {
		if (audioState.isPlaying) {
			onTogglePlayback();
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

	function handleKeydown(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
			return;
		}

		switch (event.code) {
			case 'Space': {
				event.preventDefault();
				togglePlayback();
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

<div
	class="flex flex-col gap-4 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-4 text-white shadow-lg"
>
	<div class="flex justify-center gap-4">
		<button
			class="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-2xl transition-all duration-200 hover:scale-105 hover:border-white/50 hover:bg-white/20"
			onclick={togglePlayback}
			aria-label={audioState.isPlaying ? 'Pause' : 'Play'}
		>
			{#if audioState.isPlaying}
				⏸️
			{:else}
				▶️
			{/if}
		</button>

		<button
			class="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 text-2xl transition-all duration-200 hover:scale-105 hover:border-white/50 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
			onclick={stopPlayback}
			disabled={!audioState.isPlaying}
			aria-label="Stop"
		>
			⏹️
		</button>
	</div>

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

	<div class="flex flex-col items-center justify-around gap-4 md:flex-row">
		<div class="flex flex-col items-center gap-2">
			<span class="text-xs opacity-80">Volume</span>
			<div class="flex gap-1">
				<button
					class="flex h-10 w-10 items-center justify-center rounded border border-white/30 bg-white/10 text-lg transition-all duration-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
					onclick={() => adjustVolume(-0.1)}
					disabled={audioState.volume <= 0}
				>
					🔉
				</button>
				<button
					class="flex h-10 w-10 items-center justify-center rounded border border-white/30 bg-white/10 text-lg transition-all duration-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
					onclick={() => adjustVolume(0.1)}
					disabled={audioState.volume >= 1}
				>
					🔊
				</button>
			</div>
		</div>

		<div class="flex flex-col items-center gap-2">
			<span class="text-xs opacity-80">Tempo</span>
			<div class="flex gap-1">
				<button
					class="flex h-10 w-10 items-center justify-center rounded border border-white/30 bg-white/10 text-lg transition-all duration-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
					onclick={() => adjustTempo(-10)}
					disabled={audioState.tempo <= 40}
				>
					⏪
				</button>
				<button
					class="flex h-10 w-10 items-center justify-center rounded border border-white/30 bg-white/10 text-lg transition-all duration-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
					onclick={() => adjustTempo(10)}
					disabled={audioState.tempo >= 200}
				>
					⏩
				</button>
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
				>
					↶
				</button>
				<button
					class="flex h-10 w-10 items-center justify-center rounded border border-white/30 bg-white/10 text-lg transition-all duration-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
					onclick={onRedo}
					disabled={!canRedo}
					title="Redo (Ctrl+Y)"
				>
					↷
				</button>
			</div>
		</div>
	</div>

	<div class="flex items-center justify-between rounded-lg bg-white/10 p-3">
		<div class="flex items-center gap-2">
			<span class="text-sm opacity-80">Chord:</span>
			<div class="relative h-5 w-24 overflow-hidden rounded-full bg-white/20">
				<div
					class="h-full rounded-full bg-gradient-to-r from-green-400 to-green-300 transition-all duration-300"
					style="width: {((audioState.currentChord + 1) / 4) * 100}%"
				></div>
				<span
					class="absolute inset-0 flex items-center justify-center text-xs font-semibold text-black/80"
				>
					{audioState.currentChord + 1}/4
				</span>
			</div>
		</div>

		<div class="text-right">
			<div class="text-sm opacity-80">Instruments:</div>
			<div class="font-semibold">{audioState.instruments.size} active</div>
		</div>
	</div>

	<div class="rounded bg-black/20 p-2 text-center">
		<div class="text-xs opacity-90">
			<span class="font-semibold">Shortcuts:</span>
			Space=Play/Pause, ↑↓=Volume, ←→=Tempo
		</div>
	</div>
</div>
