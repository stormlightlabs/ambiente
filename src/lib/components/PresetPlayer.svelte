<script lang="ts">
	import { PRESETS, getThemes, scaleToNotes } from '$lib/data/presets';
	import { titleCase } from '$lib/helpers';
	import { Mode, ModeUtilities, Note, NoteUtilities } from '$lib/theory';
	import { InstrumentType } from '$lib/types/instruments';
	import type { Preset } from '$lib/types/presets';
	import { twMerge } from 'tailwind-merge';

	type Props = {
		currentInstruments: Set<InstrumentType>;
		onSetSelectedPreset: (preset?: string) => void;
		onSetTempo: (tempo: number) => void;
		onSetKeyAndMode: (key: Note, mode: Mode) => void;
		onSetVolume: (volume: number) => void;
		onToggleInstrument: (instrument: InstrumentType) => void;
		onApplyPresetTexture?: (texture: any) => void;
		onApplyPreset?: (preset: Preset) => void;
	};

	const {
		currentInstruments,
		onSetSelectedPreset,
		onSetTempo,
		onSetKeyAndMode,
		onSetVolume,
		onToggleInstrument,
		onApplyPresetTexture,
		onApplyPreset
	}: Props = $props();
	const themes = getThemes();

	let selectedPresetId = $state<string>();
	let selectedTheme = $state<string>('All');

	const currentPreset = $derived(selectedPresetId ? PRESETS.find((p) => p.id === selectedPresetId) : undefined);
	const filteredPresets = $derived.by(() =>
		selectedTheme === 'All' ? PRESETS : PRESETS.filter((preset) => preset.theme === selectedTheme)
	);

	function loadPreset(preset: Preset) {
		selectedPresetId = preset.id;
		onSetSelectedPreset(preset.id);

		// Use the new comprehensive preset application if available
		if (onApplyPreset) {
			onApplyPreset(preset);
			return;
		}

		// Fallback to manual preset loading for backward compatibility
		if (preset.config.key && preset.config.mode) {
			onSetKeyAndMode(preset.config.key, preset.config.mode);
		}

		if (preset.texture) {
			const ambientPreset = preset.texture;

			const scaleNotes = scaleToNotes(ambientPreset.scale);
			if (scaleNotes.length > 0) {
				const key = scaleNotes[0];
				const mode = preset.config.mode || Mode.Aeolian;
				onSetKeyAndMode(key, mode);
			}

			onSetTempo(ambientPreset.tempo);
			onSetVolume(ambientPreset.mix.volume);
		} else {
			if (preset.config.tempo) onSetTempo(preset.config.tempo);
			if (preset.config.volume) onSetVolume(preset.config.volume);
		}

		const targetInstruments = new Set<InstrumentType>(preset.config.instruments || new Set());
		const currentInstrumentsCopy = new Set<InstrumentType>(currentInstruments);

		for (const instrument of currentInstrumentsCopy) {
			if (!targetInstruments.has(instrument)) {
				onToggleInstrument(instrument);
			}
		}

		for (const instrument of targetInstruments) {
			if (!currentInstrumentsCopy.has(instrument)) {
				onToggleInstrument(instrument);
			}
		}

		if (preset.texture && onApplyPresetTexture) {
			setTimeout(() => {
				onApplyPresetTexture(preset.texture);
			}, 100);
		}
	}

	function clearSelection() {
		selectedPresetId = undefined;
		onSetSelectedPreset();
	}
</script>

<div class="rounded-lg bg-surface-100/50 p-4 dark:bg-surface-800/50">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-2xl font-semibold text-surface-800 dark:text-surface-200">Presets</h2>

		<div class="flex items-center gap-2">
			<label for="theme-select" class="font-medium text-surface-700 dark:text-surface-300">Theme:</label>
			<select
				id="theme-select"
				bind:value={selectedTheme}
				class="rounded border border-surface-300 bg-surface-50 px-2 py-1 text-sm dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100">
				{#each themes as theme (theme)}
					<option value={theme}>{theme}</option>
				{/each}
			</select>
		</div>
	</div>

	<div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
		{#each filteredPresets as preset (preset.id)}
			<div
				class={twMerge(
					'cursor-pointer rounded-lg border-2 bg-surface-50 p-4',
					'transition-all duration-200 hover:border-surface-500 hover:shadow-md dark:bg-surface-900 dark:hover:border-surface-400',
					selectedPresetId === preset.id
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
		{/each}
	</div>

	{#if currentPreset}
		<div class="mt-4 rounded-lg border-2 border-primary-600 bg-surface-50 p-4 dark:bg-surface-900">
			<h3 class="mb-2 text-lg font-medium text-primary-800 dark:text-primary-400">Current: {currentPreset.name}</h3>
			<p class="mb-4 text-surface-600 dark:text-surface-400">{currentPreset.description}</p>

			<div class="mb-4">
				<span class="mr-2 font-medium text-surface-700">Active Instruments:</span>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each currentPreset.config.instruments || [] as instrument (instrument)}
						<span class="inline-block rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
							{instrument}
						</span>
					{/each}
				</div>
			</div>

			<div class="mb-4 grid grid-cols-2 gap-4 text-sm">
				<div>
					<span class="font-medium text-surface-700">Tempo:</span>
					{currentPreset.config.tempo || 'Variable'} BPM
				</div>
				<div>
					<span class="font-medium text-surface-700">Volume:</span>
					{Math.round((currentPreset.config.volume || 0.7) * 100)}%
				</div>
				<div>
					<span class="font-medium text-surface-700">Key:</span>
					{currentPreset.config.key ? `${currentPreset.config.key} ${currentPreset.config.mode}` : 'Variable'}
				</div>
				<div>
					<span class="font-medium text-surface-700">Theme:</span>
					{currentPreset.theme}
				</div>
			</div>

			{#if currentPreset.texture}
				<div class="mb-4 rounded bg-blue-50 p-3">
					<h4 class="mb-2 font-medium text-blue-800">Ambient Configuration</h4>
					<div class="grid grid-cols-2 gap-2 text-sm">
						<div>
							<span class="font-medium text-surface-700">Scale:</span>
							{currentPreset.texture.scale.join(', ')}
						</div>
						<div>
							<span class="font-medium text-surface-700">Pattern:</span>
							{currentPreset.texture.structure.generativePattern}
						</div>
						<div>
							<span class="font-medium text-surface-700">Layering:</span>
							{currentPreset.texture.structure.layering}
						</div>
						<div>
							<span class="font-medium text-surface-700">Reverb:</span>
							{Math.round(currentPreset.texture.processing.reverb.wet * 100)}%
						</div>
					</div>
				</div>
			{/if}

			<button
				onclick={clearSelection}
				class="rounded bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:bg-red-600">
				Clear Selection
			</button>
		</div>
	{/if}
</div>
