<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';

	type Props = {
		open: boolean;
		onClose: () => void;
		side: 'left' | 'right' | 'top' | 'bottom';
		title?: string;
		description?: string;
		showCloseButton?: boolean;
		closeOnEscape?: boolean;
		closeOnOutsideClick?: boolean;
		class?: string;
		children?: Snippet;
	};

	let {
		open = $bindable(),
		onClose,
		side = 'right',
		title,
		description,
		showCloseButton = true,
		closeOnEscape = true,
		closeOnOutsideClick = true,
		class: className = '',
		children
	}: Props = $props();

	const sideClasses = {
		left: 'left-0 top-0 h-full w-80 max-w-[90vw]',
		right: 'right-0 top-0 h-full w-80 max-w-[90vw]',
		top: 'left-0 top-0 h-80 max-h-[90vh] w-full',
		bottom: 'bottom-0 left-0 h-80 max-h-[90vh] w-full'
	};

	const flyOptions = {
		left: { x: -320, duration: 300, easing: cubicOut },
		right: { x: 320, duration: 300, easing: cubicOut },
		top: { y: -320, duration: 300, easing: cubicOut },
		bottom: { y: 320, duration: 300, easing: cubicOut }
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
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		transition:fade={{ duration: 300, easing: cubicOut }}
		class="fixed inset-0 z-50 bg-surface-950/80 backdrop-blur-sm"
		onclick={handleBackdropClick}
		role="presentation">
		<!-- Drawer -->
		<div
			transition:fly={flyOptions[side]}
			class="fixed z-50 overflow-y-auto bg-surface-50 shadow-2xl dark:bg-surface-900 {sideClasses[side]} {className}"
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? 'drawer-title' : undefined}
			aria-describedby={description ? 'drawer-description' : undefined}>
			{#if showCloseButton}
				<button
					class="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-100 text-surface-700 transition-colors hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
					onclick={onClose}
					aria-label="Close drawer">
					<i class="i-bi-x text-lg"></i>
				</button>
			{/if}

			{#if title || description}
				<div class="border-b border-surface-200 p-6 pb-4 dark:border-surface-700">
					{#if title}
						<h2 id="drawer-title" class="text-xl font-semibold text-surface-900 dark:text-surface-100">
							{title}
						</h2>
					{/if}
					{#if description}
						<p id="drawer-description" class="mt-2 text-sm text-surface-600 dark:text-surface-400">
							{description}
						</p>
					{/if}
				</div>
			{/if}

			<div class="p-6">
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}
