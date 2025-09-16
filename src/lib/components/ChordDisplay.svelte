<script lang="ts">
	import type { Mode } from '$lib/theory';
	import {
		AMBIENT_PROGRESSIONS,
		ChordAnalysis,
		generateProgression,
		generateScale,
		NoteUtilities,
		type Note
	} from '$lib/theory';

	type Props = {
		currentChordNotes: Note[];
		currentChordIndex: number;
		key: Note;
		mode: Mode;
		progressionName?: 'classic' | 'emotional' | 'pop' | 'jazz' | 'modal';
	};

	const { currentChordNotes, currentChordIndex, key, mode, progressionName = 'classic' }: Props = $props();

	const currentChord = $derived(ChordAnalysis.analyzeChord(currentChordNotes));
	const scale = $derived(generateScale(key, mode));
	const progression = $derived(generateProgression(scale, [...AMBIENT_PROGRESSIONS[progressionName]]));
	const progressionChords = $derived(progression.map((chordNotes) => ChordAnalysis.analyzeChord(chordNotes)));
</script>

<div class="rounded-lg bg-gradient-to-br from-blue-500 to-primary-600 p-4 text-white shadow-lg">
	<div class="mb-3 text-center">
		<h3 class="text-sm font-medium opacity-80">Current Chord</h3>
		<div class="text-2xl font-bold">{currentChord.name}</div>
	</div>

	<div class="mb-3">
		<div class="mb-2 text-xs font-medium opacity-80">Progression ({progressionName})</div>
		<div class="flex gap-1">
			{#each progressionChords as chord, index (index)}
				<div
					class="flex-1 rounded px-2 py-1 text-center text-xs font-medium transition-all duration-300 {index ===
					currentChordIndex
						? 'bg-white text-blue-600'
						: 'bg-white/20 text-white'}">
					{chord.name}
				</div>
			{/each}
		</div>
	</div>

	<div class="flex justify-between text-xs opacity-80">
		<span>Key: {NoteUtilities.toString(key)} {mode}</span>
		<span>{currentChordIndex + 1}/{progressionChords.length}</span>
	</div>
</div>
