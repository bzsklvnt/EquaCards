<svelte:head>
	<title>Beállítások — Admin</title>
</svelte:head>

<h1>Beállítások</h1>
<p class="placeholder">
	Ez az oldal még nem készült el (Fázis C, lásd <code>NEXT_STEPS.md</code>). Jelenleg az
	<code>app_settings</code> tábla (pl. a kérdés-újrafelhasználási cooldown) csak SQL-lel szerkeszthető.
</p>

<style>
	h1 {
		font-family: var(--font-display, monospace);
		font-size: 1.1rem;
		color: var(--cyan, #35e7ff);
	}

	.placeholder {
		color: var(--marquee-dim, #a79bc9);
		max-width: 32rem;
	}

	.placeholder code {
		font-family: var(--font-led, monospace);
		background: var(--cabinet-2, #211640);
		padding: 0.1rem 0.4rem;
		border-radius: 0.25rem;
	}
</style>
