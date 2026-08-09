<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { defaultTokens, getActiveTokens, tokensToCssText } from '$lib/theme/tokens';
	import { Toaster } from 'svelte-sonner';
	import Button from './Button.svelte';
	import type { Database } from '$lib/types/database.types';

	// Fázis O5 — kiemelve /admin/+layout.svelte-ből, hogy a /reports
	// (role_id in (1,2,3,4)) is meg tudja osztani ugyanazt a vizuális héjat
	// (sidebar/header) anélkül, hogy az /admin-nak megfelelő, szűkebb
	// (role_id in (1,2)) jogosultsági kaput örökölné — korábban a /reports
	// egyáltalán nem használt semmilyen közös héjat, saját, csupasz oldal
	// volt navigáció/vissza-gomb nélkül.
	let {
		profile,
		supabase,
		children
	}: {
		profile: { display_name: string; role_id: number };
		supabase: SupabaseClient<Database>;
		children: Snippet;
	} = $props();

	let themeCss = $state(tokensToCssText(defaultTokens));
	let mobileNavOpen = $state(false);

	// A dashboard-héj (admin + riportok) a mindig érvényes alapértelmezett
	// vizuális témát használja (nincs games sorhoz kötve, mint a
	// host/csapat/TV) — ugyanaz a token-feloldás, csak design_theme_id nélkül.
	onMount(() => {
		getActiveTokens(supabase, null).then((tokens) => {
			themeCss = tokensToCssText(tokens);
		});
	});

	// A mobil hamburger-menü záródjon be automatikusan navigációkor — a
	// pathname olvasása regisztrálja a reaktív függőséget az $effect-ben.
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		page.url.pathname;
		mobileNavOpen = false;
	});

	const isAdminRole = $derived(profile.role_id === 1 || profile.role_id === 2);

	const navItems = [
		{ href: resolve('/admin'), label: 'Vezérlőpult' },
		{ href: resolve('/admin/questions'), label: 'Kérdésbank' },
		{ href: resolve('/admin/themes'), label: 'Témák' },
		{ href: resolve('/admin/design-themes'), label: 'Vizuális témák' },
		{ href: resolve('/admin/games'), label: 'Kvízesték' }
	];

	const superAdminNavItems = [
		{ href: resolve('/admin/users'), label: 'Felhasználók' },
		{ href: resolve('/admin/settings'), label: 'Beállítások' }
	];

	const reportsHref = resolve('/reports');
</script>

<div class="admin-shell" style={themeCss}>
	<Toaster
		theme="dark"
		toastOptions={{
			style:
				'background: var(--cabinet-2); color: var(--marquee); border: 2px solid var(--cyan); font-family: var(--font-body);'
		}}
	/>

	<button
		type="button"
		class="hamburger"
		aria-expanded={mobileNavOpen}
		aria-controls="admin-sidebar"
		onclick={() => (mobileNavOpen = !mobileNavOpen)}
	>
		<span></span><span></span><span></span>
		<span class="sr-only">Menü</span>
	</button>

	{#if mobileNavOpen}
		<button
			type="button"
			class="backdrop"
			aria-label="Menü bezárása"
			onclick={() => (mobileNavOpen = false)}
		></button>
	{/if}

	<aside class="sidebar" id="admin-sidebar" class:open={mobileNavOpen}>
		<a class="brand" href={resolve('/')}>EquaCards</a>
		<nav>
			{#if isAdminRole}
				{#each navItems as item (item.href)}
					<a href={item.href} class:active={page.url.pathname === item.href}>{item.label}</a>
				{/each}
			{/if}
			{#if profile.role_id === 1}
				<div class="nav-divider"></div>
				{#each superAdminNavItems as item (item.href)}
					<a href={item.href} class:active={page.url.pathname === item.href}>{item.label}</a>
				{/each}
			{/if}
			<div class="nav-divider"></div>
			<a href={reportsHref} class:active={page.url.pathname === reportsHref}>Riportok</a>
		</nav>

		<div class="sidebar-footer">
			<span class="user">{profile.display_name}</span>
			<form method="POST" action="/logout">
				<Button type="submit" variant="ghost">Kijelentkezés</Button>
			</form>
		</div>
	</aside>

	<main class="admin-content">
		{@render children()}
	</main>
</div>

<style>
	.admin-shell {
		display: flex;
		min-height: 100vh;
		background: var(--cabinet, #150e2c);
		color: var(--marquee, #f5f0ff);
		font-family: var(--font-body, sans-serif);
	}

	.sidebar {
		width: 15rem;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: var(--cabinet-2, #211640);
		border-right: 2px solid var(--cabinet-3, #2c1d54);
		padding: 1.25rem 1rem;
		gap: 1.5rem;
		/* P1 — a sidebar saját magasságában (100dvh) rögzítve marad és
		   belül görget, ha a nav+footer magasabb a viewportnál, így a fő
		   tartalom görgetésétől függetlenül mindig elérhető marad. */
		position: sticky;
		top: 0;
		height: 100dvh;
		overflow-y: auto;
	}

	.brand {
		font-family: var(--font-display, monospace);
		font-size: 0.9rem;
		color: var(--cyan, #35e7ff);
		text-decoration: none;
	}

	nav {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	nav a {
		color: var(--marquee-dim, #a79bc9);
		text-decoration: none;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.9rem;
	}

	nav a:hover {
		color: var(--marquee, #f5f0ff);
		background: var(--cabinet-3, #2c1d54);
	}

	nav a.active {
		color: var(--cyan, #35e7ff);
		background: var(--cabinet-3, #2c1d54);
		font-weight: 600;
	}

	nav a:focus-visible {
		outline: 3px solid var(--cyan, #35e7ff);
		outline-offset: 2px;
	}

	.nav-divider {
		border-top: 1px solid var(--cabinet-3, #2c1d54);
		margin: 0.5rem 0;
	}

	.sidebar-footer {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.85rem;
	}

	.user {
		color: var(--marquee-dim, #a79bc9);
	}

	.admin-content {
		flex: 1;
		padding: 1.5rem 2rem;
		min-width: 0;
	}

	.hamburger {
		display: none;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}

	@media (max-width: 768px) {
		.admin-shell {
			flex-direction: column;
		}

		.hamburger {
			display: flex;
			flex-direction: column;
			justify-content: center;
			gap: 0.3rem;
			position: fixed;
			top: 0.75rem;
			left: 0.75rem;
			z-index: 20;
			width: 2.75rem;
			height: 2.75rem;
			border-radius: 0.5rem;
			border: 2px solid var(--violet, #9b5cff);
			background: var(--cabinet-2, #211640);
		}

		.hamburger span {
			display: block;
			width: 1.25rem;
			height: 2px;
			background: var(--marquee, #f5f0ff);
			margin: 0 auto;
		}

		.sidebar {
			position: fixed;
			inset: 0 25% 0 0;
			z-index: 10;
			padding-top: 4.5rem;
			transform: translateX(-100%);
			transition: transform 0.2s ease;
			overflow-y: auto;
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.backdrop {
			position: fixed;
			inset: 0;
			z-index: 5;
			border: none;
			padding: 0;
			background: rgb(0 0 0 / 55%);
			cursor: pointer;
		}

		.admin-content {
			padding: 4.5rem 1rem 1.5rem;
		}
	}
</style>
