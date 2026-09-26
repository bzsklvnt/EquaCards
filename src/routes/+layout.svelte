<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/assets/fonts/fonts.css';
	import NavigationProgress from '$lib/components/NavigationProgress.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<!-- PNG-tartalék az SVG favicont nem ismerő böngészőknek és az iOS kezdőképernyőnek -->
	<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<meta name="theme-color" content="#1e5b4f" />
</svelte:head>

<NavigationProgress />

{@render children()}
