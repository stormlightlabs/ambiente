<script lang="ts">
	import { formatDuration, formatEventCount, formatTimestamp } from '$lib/formatters';
	import { NoteUtilities, type Note } from '$lib/theory';
	import { getInstrumentDisplayName } from '$lib/types/instruments';
	import type { InstrumentActivity, PlaybackEvent } from '$lib/types/playback';
	import { fade, slide } from 'svelte/transition';

	type Props = {
		isTracking: boolean;
		preset?: string;
		chord: Note[];
		active: InstrumentActivity[];
		currentlyPlaying: Note[];
		recentEvents: PlaybackEvent[];
		startTime?: number;
	};

	let { isTracking, preset, chord, active, currentlyPlaying, recentEvents, startTime }: Props = $props();

	function getActivityIndicator(lastActivity: number): string {
		const timeSince = Date.now() - lastActivity;
		if (timeSince < 1000) return 'animate-pulse bg-success-400';
		if (timeSince < 5000) return 'bg-warning-400';
		return 'bg-error-400';
	}
</script>

{#if isTracking}
	<div
		transition:slide={{ duration: 400 }}
		class="flex flex-col gap-4 rounded-lg bg-gradient-to-br from-surface-800 to-surface-900 p-4 text-surface-contrast-800 shadow-lg">
		<div class="flex items-center justify-between">
			<h3 class="font-display text-lg font-semibold">Live Playback</h3>
			<div class="flex items-center gap-2">
				<div class="h-2 w-2 animate-pulse rounded-full bg-success-500"></div>
				<span class="text-sm opacity-80">Active</span>
			</div>
		</div>

		{#if preset}
			<div transition:fade={{ duration: 250 }} class="rounded bg-surface-contrast-800/10 p-2">
				<div class="text-xs opacity-70">Current Preset</div>
				<div class="font-semibold">{preset}</div>
			</div>
		{/if}

		<!-- Current Chord -->
		{#if chord.length > 0}
			<div transition:slide={{ duration: 300 }} class="rounded bg-surface-contrast-800/10 p-3">
				<div class="mb-2 text-xs opacity-70">Current Chord</div>
				<div class="flex items-center gap-2">
					{#each chord as note, index (note)}
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-xs font-bold text-primary-contrast-400">
							{NoteUtilities.names[note] || '?'}
						</div>
						{#if index < chord.length - 1}
							<div class="text-xs opacity-60">+</div>
						{/if}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Active Instruments -->
		{#if active.length > 0}
			<div transition:slide={{ duration: 300 }} class="rounded bg-surface-contrast-800/10 p-3">
				<div class="mb-2 text-xs opacity-70">Active Instruments</div>
				<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
					{#each active as activity (activity.type)}
						<div class="flex items-center justify-between rounded bg-surface-contrast-800/5 p-2">
							<div class="flex items-center gap-2">
								<div class="h-2 w-2 rounded-full {getActivityIndicator(activity.lastActivity)}"></div>
								<span class="text-xs font-medium">{getInstrumentDisplayName(activity.type)}</span>
							</div>
							{#if activity.currentNotes.length > 0}
								<div class="flex gap-1">
									{#each activity.currentNotes.slice(0, 3) as note (note)}
										<div class="h-4 w-4 rounded bg-success-400/30 text-center text-xs leading-4">
											{NoteUtilities.names[note]?.[0] || '?'}
										</div>
									{/each}
									{#if activity.currentNotes.length > 3}
										<div class="text-xs opacity-60">+{activity.currentNotes.length - 3}</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Summary -->
		{#if currentlyPlaying.length > 0}
			<div transition:slide={{ duration: 300 }} class="rounded bg-surface-contrast-800/10 p-3">
				<div class="mb-2 text-xs opacity-70">Currently Playing</div>
				<div class="flex flex-wrap gap-1">
					{#each currentlyPlaying as note (note)}
						<div
							class="rounded bg-gradient-to-r from-success-400 to-success-500 px-2 py-1 text-xs font-semibold text-success-contrast-400">
							{NoteUtilities.names[note] || '?'}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if recentEvents.length > 0}
			<div transition:slide={{ duration: 300 }} class="rounded bg-surface-contrast-800/10 p-3">
				<div class="mb-2 text-xs opacity-70">Recent Events</div>
				<div class="max-h-32 space-y-1 overflow-y-auto">
					{#each recentEvents.slice(-5) as event (event.id)}
						<div class="flex items-center justify-between rounded bg-surface-contrast-800/5 p-1 text-xs">
							<div class="flex items-center gap-2">
								{#if event.type === 'note'}
									<div class="h-2 w-2 rounded-full bg-success-400"></div>
									<span>Note {event.notes?.map((n) => NoteUtilities.names[n]).join(', ') || 'Unknown'}</span>
								{:else if event.type === 'chord'}
									<div class="h-2 w-2 rounded-full bg-primary-400"></div>
									<span>Chord {event.notes?.map((n) => NoteUtilities.names[n]).join(', ') || 'Unknown'}</span>
								{:else if event.type === 'instrument-tick'}
									<div class="h-2 w-2 rounded-full bg-warning-400"></div>
									<span>{event.instrumentType ? getInstrumentDisplayName(event.instrumentType) : 'Unknown'} tick</span>
								{:else if event.type === 'instrument-toggle'}
									<div class="bg-info-400 h-2 w-2 rounded-full"></div>
									<span>
										{event.instrumentType ? getInstrumentDisplayName(event.instrumentType) : 'Unknown'} toggled
									</span>
								{:else}
									<div class="h-2 w-2 rounded-full bg-surface-400"></div>
									<span>Unknown event: {event.type}</span>
								{/if}
							</div>
							<span class="text-xs opacity-60">{formatTimestamp(event.timestamp)}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Session Info -->
		{#if startTime}
			<div transition:fade={{ duration: 200 }} class="rounded bg-surface-contrast-800/5 p-2 text-center">
				<span class="text-xs opacity-70">
					Session: {formatDuration(startTime)} • {formatEventCount(recentEvents.length)}
				</span>
			</div>
		{/if}
	</div>
{:else}
	<div
		transition:fade={{ duration: 300 }}
		class="flex items-center justify-center rounded-lg bg-surface-800/50 p-4 text-surface-contrast-800/60">
		<div class="text-center">
			<div class="text-sm">Playback tracking inactive</div>
			<div class="text-xs opacity-60">Start playback to see live activity</div>
		</div>
	</div>
{/if}
