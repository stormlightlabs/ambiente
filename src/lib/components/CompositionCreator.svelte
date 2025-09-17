<script lang="ts">
	import { generateScale, Mode, ModeUtilities, Note, NoteUtilities } from '$lib/theory';
	import type { AudioEngineState } from '$lib/types/audio';
	import { InstrumentType, instrumentTypes } from '$lib/types/instruments';

	type Props = {
		audioState: AudioEngineState;
		onSetTempo: (tempo: number) => void;
		onSetKeyAndMode: (key: Note, mode: Mode) => void;
		onSetVolume: (volume: number) => void;
		onToggleInstrument: (instrument: InstrumentType) => void;
	};

	const { audioState, onSetTempo, onSetKeyAndMode, onSetVolume, onToggleInstrument }: Props = $props();

	let customTempo = $derived(audioState.tempo);
	let customKey = $derived(audioState.key);
	let customMode = $derived(audioState.mode);
	let customVolume = $derived(audioState.volume);
	const selectedInstruments = $derived(new Set(audioState.instruments));
	const currentScale = $derived.by(() => generateScale(customKey, customMode));

	const updateTempo = () => onSetTempo(customTempo);
	const updateKey = () => onSetKeyAndMode(customKey, customMode);
	const updateMode = () => onSetKeyAndMode(customKey, customMode);
	const updateVolume = () => onSetVolume(customVolume);

	function toggleInstrument(instrument: InstrumentType) {
		if (selectedInstruments.has(instrument)) {
			selectedInstruments.delete(instrument);
		} else {
			selectedInstruments.add(instrument);
		}
		onToggleInstrument(instrument);
	}

	function resetToDefaults() {
		customTempo = 80;
		customKey = Note.C;
		customMode = Mode.Ionian;
		customVolume = 0.7;

		for (const instrument of selectedInstruments) {
			onToggleInstrument(instrument);
		}
		selectedInstruments.clear();

		selectedInstruments.add(InstrumentType.Pad);
		selectedInstruments.add(InstrumentType.Atmosphere);

		onSetTempo(customTempo);
		onSetKeyAndMode(customKey, customMode);
		onSetVolume(customVolume);
		onToggleInstrument(InstrumentType.Pad);
		onToggleInstrument(InstrumentType.Atmosphere);
	}

	function applyAmbientPreset() {
		customTempo = 72;
		customKey = Note.A;
		customMode = Mode.Aeolian;
		customVolume = 0.6;

		for (const instrument of selectedInstruments) {
			if (audioState.instruments.has(instrument)) {
				onToggleInstrument(instrument);
			}
		}
		selectedInstruments.clear();

		const ambientInstruments = [InstrumentType.Pad, InstrumentType.Atmosphere, InstrumentType.Texture];

		for (const instrument of ambientInstruments) {
			selectedInstruments.add(instrument);
			if (!audioState.instruments.has(instrument)) {
				onToggleInstrument(instrument);
			}
		}

		updateTempo();
		updateKey();
		updateVolume();
	}
</script>

<div class="rounded-lg bg-black/5 p-4">
	<div class="mb-6 flex items-center justify-between">
		<h2 class="text-2xl font-semibold text-surface-800">Composition Creator</h2>
		<div class="flex gap-2">
			<button
				onclick={resetToDefaults}
				class="rounded border border-surface-300 bg-white px-4 py-2 text-sm transition-colors hover:bg-surface-50">
				Reset
			</button>
			<button
				onclick={applyAmbientPreset}
				class="rounded border border-blue-600 bg-blue-100 px-4 py-2 text-sm text-blue-800 transition-colors hover:bg-blue-200">
				Ambient Preset
			</button>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Musical Parameters -->
		<div class="rounded-lg border border-surface-200 bg-white p-4">
			<h3 class="mb-4 border-b border-surface-100 pb-2 text-lg font-medium text-surface-800">Musical Parameters</h3>

			<div class="space-y-4">
				<div>
					<label for="tempo" class="mb-2 block font-medium text-surface-700">Tempo: {customTempo} BPM</label>
					<input
						id="tempo"
						type="range"
						bind:value={customTempo}
						min="40"
						max="200"
						step="1"
						onchange={updateTempo}
						class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-200" />
				</div>

				<div>
					<label for="key" class="mb-2 block font-medium text-surface-700">Key:</label>
					<select
						id="key"
						bind:value={customKey}
						onchange={updateKey}
						class="w-full rounded border border-surface-300 bg-white p-2 text-base">
						{#each NoteUtilities.names as noteName, index (noteName)}
							<option value={index}>{noteName}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="mode" class="mb-2 block font-medium text-surface-700">Mode:</label>
					<select
						id="mode"
						bind:value={customMode}
						onchange={updateMode}
						class="w-full rounded border border-surface-300 bg-white p-2 text-base">
						{#each ModeUtilities.names as modeName, index (modeName)}
							<option value={index}>{modeName}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="volume" class="mb-2 block font-medium text-surface-700"
						>Volume: {Math.round(customVolume * 100)}%</label>
					<input
						id="volume"
						type="range"
						bind:value={customVolume}
						min="0"
						max="1"
						step="0.01"
						onchange={updateVolume}
						class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-200" />
				</div>
			</div>
		</div>

		<!-- Instruments -->
		<div class="rounded-lg border border-surface-200 bg-white p-4">
			<h3 class="mb-4 border-b border-surface-100 pb-2 text-lg font-medium text-surface-800">Instruments</h3>

			<div class="grid grid-cols-2 gap-2">
				{#each instrumentTypes as instrument (instrument)}
					<button
						class="rounded border-2 p-3 text-sm capitalize transition-all duration-200 {selectedInstruments.has(
							instrument
						)
							? 'border-blue-600 bg-blue-600 text-white'
							: 'border-surface-200 bg-white text-surface-700 hover:border-surface-400'}"
						onclick={() => toggleInstrument(instrument)}>
						{instrument}
					</button>
				{/each}
			</div>
		</div>

		<!-- Scale Information -->
		<div class="rounded-lg border border-surface-200 bg-white p-4">
			<h3 class="mb-4 border-b border-surface-100 pb-2 text-lg font-medium text-surface-800">Current Scale</h3>

			<div>
				<p class="mb-4 text-surface-700">
					<strong>Key:</strong>
					{NoteUtilities.names[Number(customKey)]}
					{ModeUtilities.names[Number(customMode)]}
				</p>
				<div class="flex flex-wrap items-center gap-2">
					<span class="font-medium text-surface-700">Notes:</span>
					{#each currentScale as note, index (note)}
						<span
							class="inline-block rounded px-2 py-1 text-xs font-medium {index === 0
								? 'bg-blue-600 text-white'
								: 'bg-blue-100 text-blue-800'}">
							{NoteUtilities.names[note]}
						</span>
					{/each}
				</div>
			</div>
		</div>

		<!-- Live Status -->
		<div class="rounded-lg border border-surface-200 bg-white p-4">
			<h3 class="mb-4 border-b border-surface-100 pb-2 text-lg font-medium text-surface-800">Live Status</h3>

			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<span class="font-medium text-surface-700">Playing:</span>
					<span class="font-semibold {audioState.isPlaying ? 'text-green-600' : 'text-surface-600'}">
						{audioState.isPlaying ? 'Yes' : 'No'}
					</span>
				</div>

				<div class="flex items-center justify-between">
					<span class="font-medium text-surface-700">Current Chord:</span>
					<span class="font-semibold text-surface-800">{audioState.currentChord + 1}</span>
				</div>

				<div class="flex items-center justify-between">
					<span class="font-medium text-surface-700">Active Instruments:</span>
					<span class="font-semibold text-surface-800">{audioState.instruments.size}</span>
				</div>
			</div>
		</div>
	</div>
</div>
