<script lang="ts">
	import { AppStateManager } from '$lib/communication.svelte';
	import AmbientMusicPlayer from '$lib/components/AmbientMusicPlayer.svelte';
	const appState = new AppStateManager();
</script>

<AmbientMusicPlayer {appState} />
