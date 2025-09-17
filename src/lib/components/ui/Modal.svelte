<script lang="ts">
	import type { Snippet } from 'svelte';
	import Dialog from './Dialog.svelte';

	type Props = {
		open: boolean;
		onClose: () => void;
		title?: string;
		description?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
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
		size = 'md',
		showCloseButton = true,
		closeOnEscape = true,
		closeOnOutsideClick = true,
		class: className = '',
		children
	}: Props = $props();

	const sizeClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', full: 'max-w-6xl' };

	const modalClass = `${sizeClasses[size]} ${className}`;
</script>

<Dialog
	{open}
	{onClose}
	{title}
	{description}
	{showCloseButton}
	{closeOnEscape}
	{closeOnOutsideClick}
	class={modalClass}>
	{@render children?.()}
</Dialog>
