<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, scale } from 'svelte/transition';

	type Props = {
		open: boolean;
		onClose: () => void;
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
		title,
		description,
		showCloseButton = true,
		closeOnEscape = true,
		closeOnOutsideClick = true,
		class: className = '',
		children
	}: Props = $props();

	function handleKeydown(event_: KeyboardEvent) {
		if (closeOnEscape && event_.key === 'Escape') {
			onClose();
		}
	}

	function handleBackdropClick(event_: MouseEvent) {
		if (closeOnOutsideClick && event_.target === event_.currentTarget) {
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
		role="presentation">
		<!-- Dialog Container -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center p-4"
			onclick={handleBackdropClick}
			onkeydown={(event_) => event_.key === 'Enter' && handleKeydown(event_)}
			role="button"
			tabindex="-1"
			aria-label="Dialog backdrop">
			<div
				transition:scale={{ duration: 300, easing: cubicOut, start: 0.9 }}
				class="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl bg-surface-50 shadow-2xl dark:bg-surface-900 {className}"
				role="dialog"
				aria-modal="true"
				tabindex="-1"
				aria-labelledby={title ? 'dialog-title' : undefined}
				aria-describedby={description ? 'dialog-description' : undefined}
				onclick={(event_) => event_.stopPropagation()}
				onkeydown={(event_) => event_.stopPropagation()}>
				{#if showCloseButton}
					<button
						class="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-100 text-surface-700 transition-colors hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
						onclick={onClose}
						aria-label="Close dialog">
						<i class="i-bi-x text-lg"></i>
					</button>
				{/if}

				{#if title || description}
					<div class="border-b border-surface-200 p-6 pb-4 dark:border-surface-700">
						{#if title}
							<h2 id="dialog-title" class="text-xl font-semibold text-surface-900 dark:text-surface-100">
								{title}
							</h2>
						{/if}
						{#if description}
							<p id="dialog-description" class="mt-2 text-sm text-surface-600 dark:text-surface-400">
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
	</div>
{/if}
