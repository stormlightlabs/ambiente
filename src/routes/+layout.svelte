<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '@fontsource-variable/public-sans';
	import '@fontsource-variable/work-sans';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Ambiente</title>
</svelte:head>

{@render children?.()}
