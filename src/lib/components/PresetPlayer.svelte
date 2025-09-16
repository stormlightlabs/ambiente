<script lang="ts">
	import { InstrumentType } from '$lib/audio';
	import { PRESETS, type Preset, getThemes, scaleToNotes } from '$lib/data/presets';
	import { Mode, Note } from '$lib/theory';

	type Props = {
		currentInstruments: Set<InstrumentType>;
		onSetSelectedPreset: (preset?: string) => void;
		onSetTempo: (tempo: number) => void;
		onSetKeyAndMode: (key: Note, mode: Mode) => void;
		onSetVolume: (volume: number) => void;
		onToggleInstrument: (instrument: InstrumentType) => void;
	};

	const {
		currentInstruments,
		onSetSelectedPreset,
		onSetTempo,
		onSetKeyAndMode,
		onSetVolume,
		onToggleInstrument
	}: Props = $props();

	let selectedPresetId = $state<string>();
	let selectedTheme = $state<string>('All');

	const themes = ['All', ...getThemes()];
	const filteredPresets = $derived.by(() => {
		if (selectedTheme === 'All') return PRESETS;
		return PRESETS.filter((preset) => preset.theme === selectedTheme);
	});

	const currentPreset = $derived.by(() => {
		return selectedPresetId ? PRESETS.find((p) => p.id === selectedPresetId) : undefined;
	});

	function loadPreset(preset: Preset) {
		selectedPresetId = preset.id;
		onSetSelectedPreset(preset.id);

		if (preset.config.tempo) onSetTempo(preset.config.tempo);
		if (preset.config.volume) onSetVolume(preset.config.volume);
		if (preset.config.key && preset.config.mode) {
			onSetKeyAndMode(preset.config.key, preset.config.mode);
		}

		if (preset.ambient) {
			const ambientPreset = preset.ambient;

			onSetTempo(ambientPreset.tempo);
			onSetVolume(ambientPreset.mix.volume);

			const scaleNotes = scaleToNotes(ambientPreset.scale);
			if (scaleNotes.length > 0) {
				onSetKeyAndMode(scaleNotes[0], Mode.Aeolian);
			}
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
	}

	function clearSelection() {
		selectedPresetId = undefined;
		onSetSelectedPreset();
	}
</script>

<div class="rounded-lg bg-black/5 p-4">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-2xl font-semibold text-gray-800">Presets</h2>

		<div class="flex items-center gap-2">
			<label for="theme-select" class="font-medium text-gray-700">Theme:</label>
			<select
				id="theme-select"
				bind:value={selectedTheme}
				class="rounded border border-gray-300 bg-white px-2 py-1 text-sm">
				{#each themes as theme (theme)}
					<option value={theme}>{theme}</option>
				{/each}
			</select>
		</div>
	</div>

	<div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
		{#each filteredPresets as preset (preset.id)}
			<div
				class="cursor-pointer rounded-lg border-2 bg-white p-4 transition-all duration-200 hover:border-gray-500 hover:shadow-md {selectedPresetId ===
				preset.id
					? 'border-blue-600 bg-blue-50'
					: 'border-gray-200'}"
				onclick={() => loadPreset(preset)}
				role="button"
				tabindex="0"
				onkeydown={(e) => e.key === 'Enter' && loadPreset(preset)}>
				<div class="mb-3">
					<h3 class="mb-2 text-lg font-medium text-gray-800">{preset.name}</h3>
					<p class="mb-2 text-sm leading-relaxed text-gray-600">{preset.description}</p>
					<span class="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
						{preset.theme}
					</span>
				</div>

				<div class="space-y-1 border-t border-gray-100 pt-3">
					<div class="text-xs text-gray-600">
						Tempo: {preset.config.tempo || 'Variable'} BPM
					</div>
					<div class="text-xs text-gray-600">
						Key: {preset.config.key ? `${preset.config.key} ${preset.config.mode}` : 'Variable'}
					</div>
					<div class="text-xs text-gray-600">
						Instruments: {preset.config.instruments?.size || 0}
					</div>
					{#if preset.ambient}
						<div class="text-xs font-medium text-blue-600">
							Ambient: {preset.ambient.structure.layering} layering
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	{#if currentPreset}
		<div class="mt-4 rounded-lg border-2 border-blue-600 bg-white p-4">
			<h3 class="mb-2 text-lg font-medium text-blue-800">Current: {currentPreset.name}</h3>
			<p class="mb-4 text-gray-600">{currentPreset.description}</p>

			<div class="mb-4">
				<span class="mr-2 font-medium text-gray-700">Active Instruments:</span>
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
					<span class="font-medium text-gray-700">Tempo:</span>
					{currentPreset.config.tempo || 'Variable'} BPM
				</div>
				<div>
					<span class="font-medium text-gray-700">Volume:</span>
					{Math.round((currentPreset.config.volume || 0.7) * 100)}%
				</div>
				<div>
					<span class="font-medium text-gray-700">Key:</span>
					{currentPreset.config.key ? `${currentPreset.config.key} ${currentPreset.config.mode}` : 'Variable'}
				</div>
				<div>
					<span class="font-medium text-gray-700">Theme:</span>
					{currentPreset.theme}
				</div>
			</div>

			{#if currentPreset.ambient}
				<div class="mb-4 rounded bg-blue-50 p-3">
					<h4 class="mb-2 font-medium text-blue-800">Ambient Configuration</h4>
					<div class="grid grid-cols-2 gap-2 text-sm">
						<div>
							<span class="font-medium text-gray-700">Scale:</span>
							{currentPreset.ambient.scale.join(', ')}
						</div>
						<div>
							<span class="font-medium text-gray-700">Pattern:</span>
							{currentPreset.ambient.structure.generativePattern}
						</div>
						<div>
							<span class="font-medium text-gray-700">Layering:</span>
							{currentPreset.ambient.structure.layering}
						</div>
						<div>
							<span class="font-medium text-gray-700">Reverb:</span>
							{Math.round(currentPreset.ambient.processing.reverb.wet * 100)}%
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
