<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { defaultTokens, getActiveTokens, tokensToCssText } from '$lib/theme/tokens';
	import ArcadePanel from '$lib/components/ArcadePanel.svelte';
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

<svelte:head>
	<title>EquaCards — Pub Kvíz</title>
</svelte:head>

<main class="cabinet" style={themeCss}>
	<ArcadePanel>
		<div class="hero">
			<p class="eyebrow">🍺 Heti kocsmai kvíz</p>
			<h1>EquaCards</h1>
			<p class="tagline">Kérdezz. Válaszolj. Nyerj — barátokkal, telefonon.</p>

			{#if data.user}
				<Button href={resolve('/admin')}>Kezelőfelület megnyitása →</Button>
				<form method="POST" action="/logout" class="logout-form">
					<Button type="submit" variant="ghost">Kijelentkezés ({data.user.email})</Button>
				</form>
			{:else}
				<Button href={resolve('/login')}>Bejelentkezés / Regisztráció →</Button>
			{/if}
		</div>
	</ArcadePanel>
</main>

<style>
	main.cabinet {
		max-width: 26rem;
		margin: 0 auto;
		padding: 4rem 1rem 2rem;
		display: flex;
		align-items: center;
		background: linear-gradient(160deg, var(--cabinet), var(--cabinet-2) 60%, var(--cabinet-3));
		color: var(--marquee);
		font-family: var(--font-body);
		min-height: 100vh;
	}

	.hero {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
		text-align: left;
	}

	.eyebrow {
		font-size: 0.85rem;
		color: var(--coin);
		margin: 0;
	}

	h1 {
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 8vw, 2.25rem);
		line-height: 1.4;
		color: var(--cyan);
		margin: 0;
	}

	.tagline {
		color: var(--marquee-dim);
		margin: 0 0 0.5rem;
	}

	.logout-form {
		margin-top: 0.25rem;
	}
</style>
