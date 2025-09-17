<script lang="ts">
	import { titleCase } from '$lib/helpers';
	import { ModeUtilities, NoteUtilities } from '$lib/theory';
	import type { Preset } from '$lib/types/presets';
	import { twMerge } from 'tailwind-merge';

	type Props = { preset: Preset; isSelected: boolean; loadPreset: (preset: Preset) => void };

	const { preset, isSelected, loadPreset }: Props = $props();
</script>

<div
	class={twMerge(
		'cursor-pointer rounded-lg border-2 bg-surface-50 p-4',
		'transition-all duration-200 hover:border-surface-500 hover:shadow-md dark:bg-surface-900 dark:hover:border-surface-400',
		isSelected
			? 'border-primary-600 bg-primary-50 dark:bg-primary-900/50'
			: 'border-surface-200 dark:border-surface-700'
	)}
	onclick={() => loadPreset(preset)}
	role="button"
	tabindex="0"
	onkeydown={(event_) => event_.key === 'Enter' && loadPreset(preset)}>
	<div class="mb-3">
		<h3 class="mb-2 font-serif text-xl font-medium text-surface-800 dark:text-surface-200">{preset.name}</h3>
		<p class="mb-2 text-sm leading-relaxed text-surface-600 dark:text-surface-400">{preset.description}</p>
		<span
			class={twMerge(
				'inline-block rounded-full bg-primary-100 px-2 py-1 text-xs font-medium text-primary-800',
				'dark:bg-primary-900/50 dark:text-primary-400'
			)}>
			{preset.theme}
		</span>
	</div>

	<div class="space-y-1 border-t border-surface-100 pt-3 dark:border-surface-800">
		<div class="text-xs text-surface-600 dark:text-surface-400">
			Tempo: {preset.config.tempo || 'Variable'} BPM
		</div>
		<div class="text-xs text-surface-600 dark:text-surface-400">
			Key: {preset.config.key
				? `${NoteUtilities.toString(preset.config.key)} ${preset.config.mode ? ModeUtilities.toString(preset.config.mode) : ''}`
				: 'Variable'}
		</div>
		<div class="text-xs text-surface-600 dark:text-surface-400">
			Instruments: {preset.config.instruments?.size || 0}
		</div>
		{#if preset.texture}
			<div class="text-xs font-medium text-primary-600 dark:text-primary-400">
				Texture: {titleCase(preset.texture.structure.layering)} layering
			</div>
		{/if}
	</div>
</div>
