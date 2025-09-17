<script lang="ts">
	import type { AudioEngineState } from '$lib/types/audio';
	import { slide } from 'svelte/transition';

	type Props = {
		randomization: AudioEngineState['randomization'];
		onSetRandomization: (updates: Partial<AudioEngineState['randomization']>) => void;
		isVisible: boolean;
	};

	const { randomization, onSetRandomization, isVisible }: Props = $props();
</script>

{#if isVisible && randomization.enabled}
	<div
		class="mb-6 rounded-lg border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-800"
		transition:slide={{ duration: 300 }}>
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-lg font-medium text-surface-900 dark:text-surface-100">Randomization Settings</h3>
			<button
				onclick={() => onSetRandomization({ enabled: false })}
				class="rounded bg-surface-600 px-3 py-1 text-sm text-white transition-colors hover:bg-surface-700 dark:bg-surface-500 dark:hover:bg-surface-400"
				title="Disable Randomization"
				aria-label="disable randomization">
				<i class="i-bi-x-lg"></i>
			</button>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			<div class="space-y-2">
				<label for="rhythm-variability" class="block text-sm font-medium text-surface-800 dark:text-surface-200">
					Rhythm Variability
				</label>
				<input
					id="rhythm-variability"
					type="range"
					min="0"
					max="1"
					step="0.1"
					value={randomization.rhythmVariability}
					oninput={(event_) => onSetRandomization({ rhythmVariability: Number(event_.currentTarget.value) })}
					class="w-full cursor-pointer accent-primary-600" />
				<div class="text-xs text-surface-600 dark:text-surface-400">
					{Math.round(randomization.rhythmVariability * 100)}%
				</div>
			</div>

			<div class="space-y-2">
				<label for="melodic-variability" class="block text-sm font-medium text-surface-800 dark:text-surface-200">
					Melodic Variability
				</label>
				<input
					id="melodic-variability"
					type="range"
					min="0"
					max="1"
					step="0.1"
					value={randomization.melodicVariability}
					oninput={(event_) => onSetRandomization({ melodicVariability: Number(event_.currentTarget.value) })}
					class="w-full cursor-pointer accent-primary-600" />
				<div class="text-xs text-surface-600 dark:text-surface-400">
					{Math.round(randomization.melodicVariability * 100)}%
				</div>
			</div>

			<div class="space-y-2">
				<label for="chord-progression" class="block text-sm font-medium text-surface-800 dark:text-surface-200">
					Chord Progression
				</label>
				<input
					id="chord-progression"
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={randomization.chordProgression}
					oninput={(event_) => onSetRandomization({ chordProgression: Number(event_.currentTarget.value) })}
					class="w-full cursor-pointer accent-primary-600" />
				<div class="text-xs text-surface-600 dark:text-surface-400">
					{Math.round(randomization.chordProgression * 100)}%
				</div>
			</div>
		</div>
	</div>
{/if}
