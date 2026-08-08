<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { defaultTokens, getActiveTokens, tokensToCssText } from '$lib/theme/tokens';
	import Button from '$lib/components/Button.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let themeCss = $state(tokensToCssText(defaultTokens));

	onMount(() => {
		getActiveTokens(data.supabase, null).then((tokens) => {
			themeCss = tokensToCssText(tokens);
		});
	});
</script>

<main class="cabinet" style={themeCss}>
	<h1>EquaCards — Pub Kvíz</h1>

	{#if data.user}
		<p>Bejelentkezve: {data.user.email}</p>
		<form method="POST" action="/logout">
			<Button type="submit">Kijelentkezés</Button>
		</form>
	{:else}
		<p><a href={resolve('/login')}>Bejelentkezés / Regisztráció</a></p>
	{/if}
</main>

<style>
	main.cabinet {
		max-width: 24rem;
		margin: 0 auto;
		padding: 4rem 1rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: linear-gradient(160deg, var(--cabinet), var(--cabinet-2) 60%, var(--cabinet-3));
		color: var(--marquee);
		font-family: var(--font-body);
		min-height: 100vh;
	}

	h1 {
		font-family: var(--font-display);
		font-size: 1.1rem;
		line-height: 1.6;
		color: var(--cyan);
	}

	a {
		color: var(--cyan);
	}
</style>
