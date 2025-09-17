<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';

	type Props = {
		open: boolean;
		onClose: () => void;
		side: 'bottom' | 'top';
		title?: string;
		description?: string;
		showCloseButton?: boolean;
		closeOnEscape?: boolean;
		closeOnOutsideClick?: boolean;
		snapPoints?: string[];
		defaultSnapPoint?: string;
		class?: string;
		children?: Snippet;
	};

	let {
		open = $bindable(),
		onClose,
		side = 'bottom',
		title,
		description,
		showCloseButton = true,
		closeOnEscape = true,
		closeOnOutsideClick = true,
		snapPoints = ['400px'],
		defaultSnapPoint = snapPoints[0],
		class: className = '',
		children
	}: Props = $props();

	let currentSnapPoint = $state(defaultSnapPoint);

	const sideClasses = { bottom: 'bottom-0 left-0 w-full rounded-t-xl', top: 'left-0 top-0 w-full rounded-b-xl' };

	const flyOptions = {
		bottom: { y: 400, duration: 300, easing: cubicOut },
		top: { y: -400, duration: 300, easing: cubicOut }
	};

	function handleKeydown(event: KeyboardEvent) {
		if (closeOnEscape && event.key === 'Escape') {
			onClose();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (closeOnOutsideClick && event.target === event.currentTarget) {
			onClose();
		}
	}

	function handleDragHandleClick() {
		const currentIndex = snapPoints.indexOf(currentSnapPoint);
		const nextIndex = (currentIndex + 1) % snapPoints.length;
		currentSnapPoint = snapPoints[nextIndex];
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		transition:fade={{ duration: 300, easing: cubicOut }}
		class="fixed inset-0 z-50 bg-surface-950/80 backdrop-blur-sm"
		onclick={handleBackdropClick}
		role="presentation">
		<!-- Sheet -->
		<div
			transition:fly={flyOptions[side]}
			class="fixed z-50 overflow-y-auto bg-surface-50 shadow-2xl dark:bg-surface-900 {sideClasses[side]} {className}"
			style="height: {currentSnapPoint}; max-height: 90vh;"
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? 'sheet-title' : undefined}
			aria-describedby={description ? 'sheet-description' : undefined}>
			<!-- Drag Handle -->
			<div class="flex justify-center p-2">
				<button
					class="h-1 w-12 rounded-full bg-surface-300 transition-colors hover:bg-surface-400 dark:bg-surface-600 dark:hover:bg-surface-500"
					onclick={handleDragHandleClick}
					aria-label="Resize sheet">
				</button>
			</div>

			{#if showCloseButton}
				<button
					class="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-100 text-surface-700 transition-colors hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
					onclick={onClose}
					aria-label="Close sheet">
					<i class="i-bi-x text-lg"></i>
				</button>
			{/if}

			{#if title || description}
				<div class="border-b border-surface-200 p-6 pb-4 dark:border-surface-700">
					{#if title}
						<h2 id="sheet-title" class="text-xl font-semibold text-surface-900 dark:text-surface-100">
							{title}
						</h2>
					{/if}
					{#if description}
						<p id="sheet-description" class="mt-2 text-sm text-surface-600 dark:text-surface-400">
							{description}
						</p>
					{/if}
				</div>
			{/if}

			<div class="p-6">
				{@render children?.()}
			</div>

			{#if snapPoints.length > 1}
				<div class="flex justify-center gap-2 p-4">
					{#each snapPoints as snapPoint (snapPoint)}
						<button
							class="h-2 w-2 rounded-full transition-colors {currentSnapPoint === snapPoint
								? 'bg-primary-500'
								: 'bg-surface-300 hover:bg-surface-400 dark:bg-surface-600 dark:hover:bg-surface-500'}"
							onclick={() => (currentSnapPoint = snapPoint)}
							aria-label="Set height to {snapPoint}">
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
