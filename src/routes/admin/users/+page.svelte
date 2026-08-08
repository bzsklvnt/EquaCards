<svelte:head>
	<title>Felhasználók — Admin</title>
</svelte:head>

<h1>Felhasználók</h1>
<p class="placeholder">
	Ez az oldal még nem készült el (Fázis B, lásd <code>NEXT_STEPS.md</code>). Jelenleg a role
	kiosztás kézi SQL-lel történik: <code>update profiles set role_id = ... where id = '...'</code>.
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
