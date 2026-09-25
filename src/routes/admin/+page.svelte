<script lang="ts">
	import { registerPageTour } from '$lib/tours/state.svelte';

	registerPageTour(() => 'dashboard');
</script>

<svelte:head>
	<title>Vezérlőpult — Kezelőfelület</title>
</svelte:head>

<h1>Vezérlőpult</h1>
<p>
	Válassz az oldalsávból: kérdésbank, témák, vizuális témák, kvízesték. Első alkalommal indítsd el a
	jobb felső „Bemutató ▶” gombot.
</p>

<style>
	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		color: var(--cyan);
	}

	p {
		color: var(--marquee-dim);
	}
</style>
