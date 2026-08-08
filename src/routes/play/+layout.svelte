<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<link rel="manifest" href="/manifest.json" />
	<link rel="apple-touch-icon" href="/icon.svg" />
	<meta name="theme-color" content="#150e2c" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
</svelte:head>

{@render children()}
