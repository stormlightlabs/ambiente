<script lang="ts">
	import type { Mode, NamedProgression, Note } from '$lib/theory';
	import { ChordAnalysis, generateProgression, generateScale, NoteUtilities, PROGRESSIONS } from '$lib/theory';

	type Props = { currentChord: { notes: Note[]; index: number }; key: Note; mode: Mode; name?: NamedProgression };

	const { currentChord, key, mode, name: progressionName = 'classic' }: Props = $props();

	const chord = $derived(ChordAnalysis.analyzeChord(currentChord.notes));
	const scale = $derived(generateScale(key, mode));
	const progression = $derived.by(() => {
		const base = generateProgression(scale, [...PROGRESSIONS[progressionName]]);
		const chords = base.map((chordNotes) => ChordAnalysis.analyzeChord(chordNotes));
		return { name: progressionName, base, chords };
	});
</script>

<div
	class="rounded-lg bg-gradient-to-br from-blue-500 to-primary-600 p-4 text-white shadow-lg"
	role="region"
	aria-label="Chord Display">
	<div class="mb-3 text-center">
		<h3 class="text-sm font-medium opacity-80">Current Chord</h3>
		<div class="text-2xl font-bold" data-testid="current-chord-name" aria-label="Current chord: {chord.name}">
			{chord.name}
		</div>
	</div>

	<div class="mb-3">
		<div class="mb-2 text-xs font-medium opacity-80" data-testid="progression-header">
			Progression ({progression.name})
		</div>
		<div class="flex gap-1" role="list" aria-label="Chord progression">
			{#each progression.chords as chord, index (index)}
				<div
					role="listitem"
					data-testid="progression-chord-{index}"
					aria-label="Chord {index + 1}: {chord.name}"
					aria-current={index === currentChord.index ? 'true' : 'false'}
					class="flex-1 rounded px-2 py-1 text-center text-xs font-medium transition-all duration-300 {index ===
					currentChord.index
						? 'bg-white text-blue-600'
						: 'bg-white/20 text-white'}">
					{chord.name}
				</div>
			{/each}
		</div>
	</div>

	<div class="flex justify-between text-xs opacity-80">
		<span data-testid="key-mode-info" aria-label="Key and mode: {NoteUtilities.toString(key)} {mode}">
			Key: {NoteUtilities.toString(key)}
			{mode}
		</span>
		<span
			data-testid="progression-position"
			aria-label="Chord position: {currentChord.index + 1} of {progression.chords.length}">
			{currentChord.index + 1}/{progression.chords.length}
		</span>
	</div>
</div>
