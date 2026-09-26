<script lang="ts">
	import { resolve } from '$app/paths';
	import { appUrl } from '$lib/site';

	let { data, children } = $props();

	const year = new Date().getFullYear();
	// Az app külön domainen él (PUBLIC_APP_URL), ezért ez nem resolve()-olt belső link.
	const loginHref = appUrl('/login');
</script>

<div class="site">
	<header class="site-header">
		<a class="brand" href={resolve('/')}>{data.site.name}</a>
		<nav aria-label="Fő navigáció">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()-olt útvonal + horgony -->
			<a href={`${resolve('/')}#esemenyek`}>Esték</a>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve()-olt útvonal + horgony -->
			<a href={`${resolve('/')}#hogyan`}>Hogyan működik?</a>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- külön (app) domain -->
			<a class="muted" href={loginHref}>Kezelői belépés</a>
		</nav>
	</header>

	<main class="site-main">
		{@render children()}
	</main>

	<footer class="site-footer">
		<span>© {year} {data.site.name}</span>
		<div class="footer-links">
			<a href={resolve('/adatkezeles')}>Adatkezelés</a>
			{#if data.site.contactEmail}
				<a href={`mailto:${data.site.contactEmail}`}>Kapcsolat</a>
			{/if}
		</div>
	</footer>
</div>

<style>
	/* A nyilvános oldal saját, fix palettája (docs/architecture/DESIGN_SYSTEM.md
	   "Nyilvános oldal") — a design témák a játékfelületekre vonatkoznak. */
	.site {
		--paper: #f6f3ec;
		--surface: #ffffff;
		--ink: #1c1b18;
		--ink-2: #45423b;
		--muted: #5e5a52;
		--faint: #6b675e;
		--line: #e4ded2;
		--field: #d5cec0;
		--track: #ece7dc;
		--accent: #1e5b4f;
		--accent-dark: #143f37;
		--accent-soft: #e3eee9;
		--warn: #8a4b0b;
		--warn-bar: #b7661a;
		--warn-soft: #fbf4e8;
		--danger: #b3261e;
		--serif: 'Fraunces', Georgia, serif;
		--sans: 'Hanken Grotesk', system-ui, sans-serif;

		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--paper);
		color: var(--ink);
		font-family: var(--sans);
		-webkit-font-smoothing: antialiased;
	}

	.site :global(a) {
		color: var(--accent);
	}

	.site :global(a:hover) {
		color: var(--accent-dark);
	}

	.site :global(:focus-visible) {
		outline: 3px solid var(--accent);
		outline-offset: 2px;
	}

	.site-header {
		width: 100%;
		max-width: 72rem;
		margin: 0 auto;
		padding: 1.4rem 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid var(--line);
	}

	.brand {
		font-family: var(--serif);
		font-size: 1.6rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--ink) !important;
		text-decoration: none;
	}

	nav {
		display: flex;
		align-items: center;
		gap: 1.75rem;
		font-size: 0.95rem;
	}

	nav a {
		color: var(--ink) !important;
		text-decoration: none;
	}

	nav a:hover {
		text-decoration: underline;
	}

	nav a.muted {
		color: var(--muted) !important;
	}

	.site-main {
		flex: 1;
		width: 100%;
		max-width: 72rem;
		margin: 0 auto;
		padding: 0 1.25rem;
	}

	.site-footer {
		width: 100%;
		max-width: 72rem;
		margin: 4rem auto 0;
		padding: 2rem 1.25rem;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		border-top: 1px solid var(--line);
		font-size: 0.9rem;
		color: var(--muted);
	}

	.footer-links {
		display: flex;
		gap: 1.5rem;
	}

	.footer-links a {
		color: var(--muted) !important;
	}

	@media (max-width: 640px) {
		nav a:not(:first-child) {
			display: none;
		}

		.brand {
			font-size: 1.35rem;
		}
	}
</style>
