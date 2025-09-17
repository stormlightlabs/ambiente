<script lang="ts">
	import { PRESETS, getThemes, scaleToNotes } from '$lib/data/presets';
	import { formatInstrumentName, formatPatternOrLayering, formatTheme } from '$lib/formatters';
	import { Mode, Note } from '$lib/theory';
	import { InstrumentType } from '$lib/types/instruments';
	import type { Preset as TPreset } from '$lib/types/presets';
	import { fade, slide } from 'svelte/transition';
	import Preset from './Preset.svelte';

	type Props = {
		currentInstruments: Set<InstrumentType>;
		onSetSelectedPreset: (preset?: string) => void;
		onSetTempo: (tempo: number) => void;
		onSetKeyAndMode: (key: Note, mode: Mode) => void;
		onSetVolume: (volume: number) => void;
		onToggleInstrument: (instrument: InstrumentType) => void;
		onApplyPresetTexture?: (texture: any) => void;
		onApplyPreset?: (preset: TPreset) => void;
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
	let requestedPage = $state(0);
	let presetsPerPage = $state<2 | 4 | 6>(2);

	const current = $derived(selectedPresetId ? PRESETS.find((p) => p.id === selectedPresetId) : undefined);
	const filtered = $derived(
		selectedTheme === 'All' ? PRESETS : PRESETS.filter((preset) => preset.theme === selectedTheme)
	);
	const totalPages = $derived(Math.ceil(filtered.length / presetsPerPage));
	const currentPage = $derived(Math.min(requestedPage, Math.max(0, totalPages - 1)));

	const paginated = $derived.by(() => {
		const start = currentPage * presetsPerPage;
		const end = start + presetsPerPage;
		return filtered.slice(start, end);
	});

	function loadPreset(preset: TPreset) {
		selectedPresetId = preset.id;
		onSetSelectedPreset(preset.id);

		if (onApplyPreset) {
			onApplyPreset(preset);
			return;
		}

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

		const targets = new Set<InstrumentType>(preset.config.instruments || new Set());
		const currentInstrumentsCopy = new Set<InstrumentType>(currentInstruments);

		for (const instrument of currentInstrumentsCopy) {
			if (!targets.has(instrument)) {
				onToggleInstrument(instrument);
			}
		}

		for (const instrument of targets) {
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

{#snippet presetPage()}
	<!-- Pagination Controls -->
	<div class="mb-4 flex items-center justify-between">
		<div class="flex min-w-1/5 items-center gap-2">
			<label for="presets-per-page" class="text-sm font-medium text-surface-700 dark:text-surface-300">
				Per page:
			</label>
			<select
				id="presets-per-page"
				bind:value={presetsPerPage}
				class="flex-1 form-select rounded border border-surface-300 bg-surface-50 px-2 py-1 text-sm dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100">
				<option value={2}>2</option>
				<option value={4}>4</option>
				<option value={6}>6</option>
			</select>
		</div>

		{#if totalPages > 1}
			<div class="flex items-center gap-2" transition:fade={{ duration: 200 }}>
				<button
					onclick={() => (requestedPage = Math.max(0, requestedPage - 1))}
					disabled={currentPage === 0}
					aria-label="Previous page"
					class="flex items-center rounded border border-surface-300 bg-surface-50 px-3 py-2 transition-colors hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-600 dark:bg-surface-900 dark:hover:bg-surface-800">
					<i class="i-bi-chevron-left"></i>
				</button>

				<span class="text-sm text-surface-700 dark:text-surface-300">
					Page {currentPage + 1} of {totalPages}
				</span>

				<button
					onclick={() => (requestedPage = Math.min(totalPages - 1, requestedPage + 1))}
					disabled={currentPage === totalPages - 1}
					aria-label="Next page"
					class="flex items-center rounded border border-surface-300 bg-surface-50 px-3 py-2 transition-colors hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-600 dark:bg-surface-900 dark:hover:bg-surface-800">
					<i class="i-bi-chevron-right"></i>
				</button>
			</div>
		{/if}
	</div>

	<!-- Presets Grid -->
	{#key currentPage}
		<div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2" transition:fade={{ duration: 200 }}>
			{#each paginated as preset (preset.id)}
				<Preset {preset} isSelected={selectedPresetId === preset.id} {loadPreset} />
			{/each}
		</div>
	{/key}

	{#if paginated.length === 0}
		<div class="py-8 text-center text-surface-600 dark:text-surface-400" transition:fade={{ duration: 300 }}>
			No presets found for the selected theme.
		</div>
	{/if}
{/snippet}

<div class="rounded-lg bg-surface-100/50 p-4 dark:bg-surface-800/50">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-2xl font-semibold text-surface-800 dark:text-surface-200">Presets</h2>

		<div class="flex items-center gap-2">
			<label for="theme-select" class="font-medium text-surface-700 dark:text-surface-300">Theme:</label>
			<select
				id="theme-select"
				bind:value={selectedTheme}
				class="form-select rounded border border-surface-300 bg-surface-50 px-4 py-1 text-sm dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100">
				{#each themes as theme (theme)}
					<option value={theme}>{theme}</option>
				{/each}
			</select>
		</div>
	</div>

	{@render presetPage()}
	{#if current}
		{@const config = current.config}
		<div
			transition:slide={{ duration: 300 }}
			class="mt-4 rounded-lg border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-800">
			<h3 class="mb-2 text-lg font-medium text-surface-900 dark:text-surface-100">Current: {current.name}</h3>
			<p class="mb-4 text-surface-600 dark:text-surface-400">{current.description}</p>
			<div class="mb-4">
				<span class="mr-2 font-medium text-surface-800 dark:text-surface-200">Active Instruments:</span>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each config.instruments || [] as instrument (instrument)}
						<span
							class="inline-block rounded bg-primary-100 px-2 py-1 text-xs text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
							{formatInstrumentName(instrument)}
						</span>
					{/each}
				</div>
			</div>
			<div class="mb-4 grid grid-cols-2 gap-4 text-sm">
				<div>
					<span class="font-medium text-surface-800 dark:text-surface-200">Tempo:</span>
					<span class="text-surface-700 dark:text-surface-300">{config.tempo || 'Variable'} BPM</span>
				</div>
				<div>
					<span class="font-medium text-surface-800 dark:text-surface-200">Volume:</span>
					<span class="text-surface-700 dark:text-surface-300">{Math.round((config.volume || 0.7) * 100)}%</span>
				</div>
				<div>
					<span class="font-medium text-surface-800 dark:text-surface-200">Key:</span>
					<span class="text-surface-700 dark:text-surface-300">
						{config.key ? `${config.key} ${config.mode}` : 'Variable'}
					</span>
				</div>
				<div>
					<span class="font-medium text-surface-800 dark:text-surface-200">Theme:</span>
					<span class="text-surface-700 dark:text-surface-300">{formatTheme(current.theme)}</span>
				</div>
			</div>
			{#if current.texture}
				{@const texture = current.texture}
				<div
					transition:fade={{ duration: 200 }}
					class="mb-4 rounded border border-surface-200 bg-surface-100 p-3 dark:border-surface-600 dark:bg-surface-700">
					<h4 class="mb-2 font-medium text-surface-900 dark:text-surface-100">Texture Configuration</h4>
					<div class="grid grid-cols-2 gap-2 text-sm">
						<div>
							<span class="font-medium text-surface-800 dark:text-surface-200">Scale:</span>
							<span class="text-surface-700 dark:text-surface-300">{texture.scale.join(', ')}</span>
						</div>
						<div>
							<span class="font-medium text-surface-800 dark:text-surface-200">Pattern:</span>
							<span class="text-surface-700 dark:text-surface-300"
								>{formatPatternOrLayering(texture.structure.generativePattern)}</span>
						</div>
						<div>
							<span class="font-medium text-surface-800 dark:text-surface-200">Layering:</span>
							<span class="text-surface-700 dark:text-surface-300"
								>{formatPatternOrLayering(texture.structure.layering)}</span>
						</div>
						<div>
							<span class="font-medium text-surface-800 dark:text-surface-200">Reverb:</span>
							<span class="text-surface-700 dark:text-surface-300">
								{Math.round(texture.processing.reverb.wet * 100)}%
							</span>
						</div>
					</div>
				</div>
			{/if}
			<button
				onclick={clearSelection}
				class="rounded-sm bg-error-600 px-4 py-2 text-xs text-white transition-all duration-400 hover:bg-error-700 dark:bg-error-500 dark:hover:bg-error-400">
				Clear Selection
			</button>
		</div>
	{/if}
</div>
