<script lang="ts">
	import { onMount } from 'svelte';
	import { getActiveTokens, tokensToCssText } from '$lib/theme/tokens';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let themeCss = $state('');

	onMount(() => {
		getActiveTokens(data.supabase, null).then((tokens) => {
			themeCss = tokensToCssText(tokens);
		});
	});
</script>

<svelte:head>
	<title>Riportok — EquaCards</title>
</svelte:head>

<main class="cabinet" style={themeCss}>
	<h1>Riportok</h1>
	<p class="placeholder">
		Szia, {data.profile.display_name}! Ez az oldal még nem készült el (Fázis D, lásd
		<code>NEXT_STEPS.md</code>). Itt fognak megjelenni a lezárult kvízesték végeredményei és
		aggregált statisztikái.
	</p>
</main>

<style>
	main.cabinet {
		min-height: 100vh;
		background: linear-gradient(160deg, var(--cabinet), var(--cabinet-2) 60%, var(--cabinet-3));
		color: var(--marquee);
		font-family: var(--font-body);
		padding: 2rem;
	}

	h1 {
		font-family: var(--font-display);
		font-size: 1.25rem;
		color: var(--cyan);
	}

	.placeholder {
		color: var(--marquee-dim);
		max-width: 32rem;
	}

	.placeholder code {
		font-family: var(--font-led);
		background: var(--cabinet-2);
		padding: 0.1rem 0.4rem;
		border-radius: 0.25rem;
	}
</style>
