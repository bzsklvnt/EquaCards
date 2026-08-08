<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { defaultTokens, tokensToCssText } from '$lib/theme/tokens';
	import Button from '$lib/components/Button.svelte';

	// A hibaoldalnak akkor is meg kell jelennie, ha maga a Supabase-elérés
	// az ok (pl. hálózati hiba) — ezért nincs dinamikus getActiveTokens()
	// hívás, csak a statikus alapértelmezett vizuális téma.
	const themeCss = tokensToCssText(defaultTokens);
</script>

<svelte:head>
	<title>{page.status} — EquaCards</title>
</svelte:head>

<main class="cabinet" style={themeCss}>
	<p class="code">{page.status}</p>
	<h1>GAME OVER</h1>
	<p class="message">
		{page.status === 404
			? 'Ez az oldal nem létezik, vagy már törölve lett.'
			: (page.error?.message ?? 'Váratlan hiba történt.')}
	</p>
	<Button href={resolve('/')}>Vissza a főoldalra</Button>
</main>

<style>
	main.cabinet {
		max-width: 24rem;
		margin: 0 auto;
		padding: 4rem 1rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1rem;
		background: linear-gradient(160deg, var(--cabinet), var(--cabinet-2) 60%, var(--cabinet-3));
		color: var(--marquee);
		font-family: var(--font-body);
		min-height: 100vh;
	}

	.code {
		font-family: var(--font-led);
		font-size: 3rem;
		color: var(--coin);
		margin: 0;
	}

	h1 {
		font-family: var(--font-display);
		font-size: 1.3rem;
		color: var(--danger);
		margin: 0;
	}

	.message {
		color: var(--marquee-dim);
	}
</style>
