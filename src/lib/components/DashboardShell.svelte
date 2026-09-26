<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { defaultTokens, tokensToCssText } from '$lib/theme/tokens';
	import { Toaster } from 'svelte-sonner';
	import Button from './Button.svelte';
	import TourButton from './TourButton.svelte';
	import { tourState } from '$lib/tours/state.svelte';

	// Fázis O5 — kiemelve /admin/+layout.svelte-ből, hogy a /reports
	// (role_id in (1,2,3,4)) is meg tudja osztani ugyanazt a vizuális héjat
	// (sidebar/header) anélkül, hogy az /admin-nak megfelelő, szűkebb
	// (role_id in (1,2)) jogosultsági kaput örökölné — korábban a /reports
	// egyáltalán nem használt semmilyen közös héjat, saját, csupasz oldal
	// volt navigáció/vissza-gomb nélkül.
	let {
		profile,
		children
	}: {
		profile: { display_name: string; role_id: number };
		children: Snippet;
	} = $props();

	let mobileNavOpen = $state(false);

	// A kezelői héj (admin + riportok) mindig a letisztult alaptémát használja,
	// függetlenül attól, melyik téma az estek alapértelmezettje — a választható
	// témák (pl. "Arcade (fun)") csak a játékfelületekre vonatkoznak.
	const themeCss = tokensToCssText(defaultTokens);

	// A mobil hamburger-menü záródjon be automatikusan navigációkor — a
	// pathname olvasása regisztrálja a reaktív függőséget az $effect-ben.
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		page.url.pathname;
		mobileNavOpen = false;
	});

	// Munkaterület-oldalak (pl. a kvízösszerakó) a teljes képernyőt használják:
	// oldalsáv és tartalom-margó nélkül, saját fejléccel.
	const workspace = $derived(page.data.workspace === true);

	const isAdminRole = $derived(profile.role_id === 1 || profile.role_id === 2);

	const navItems = [
		{ href: resolve('/admin'), label: 'Vezérlőpult', tour: 'nav-dashboard' },
		{ href: resolve('/admin/questions'), label: 'Kérdésbank', tour: 'nav-questions' },
		{ href: resolve('/admin/themes'), label: 'Témák', tour: 'nav-themes' },
		{ href: resolve('/admin/design-themes'), label: 'Vizuális témák', tour: 'nav-design-themes' },
		{ href: resolve('/admin/games'), label: 'Kvízesték', tour: 'nav-games' },
		{ href: resolve('/admin/venues'), label: 'Helyszínek', tour: 'nav-venues' }
	];

	const superAdminNavItems = [
		{ href: resolve('/admin/users'), label: 'Felhasználók', tour: 'nav-users' },
		{ href: resolve('/admin/settings'), label: 'Beállítások', tour: 'nav-settings' }
	];

	const reportsHref = resolve('/reports');

	// A szekció aloldalain is (pl. /admin/games/123) aktív marad a menüpont.
	function isActive(href: string): boolean {
		const path = page.url.pathname;
		return href === resolve('/admin')
			? path === href
			: path === href || path.startsWith(`${href}/`);
	}
</script>

<div class="admin-shell" class:workspace style={themeCss}>
	<Toaster
		theme="light"
		toastOptions={{
			style:
				'background: var(--cabinet-2); color: var(--marquee); border: 1px solid var(--panel-border); font-family: var(--font-body);'
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
		<a class="brand" href={resolve('/admin')}>Kocsmakvízest <span>kezelő</span></a>
		<nav>
			{#if isAdminRole}
				{#each navItems as item (item.href)}
					<a href={item.href} data-tour={item.tour} class:active={isActive(item.href)}
						>{item.label}</a
					>
				{/each}
			{/if}
			{#if profile.role_id === 1}
				<div class="nav-divider"></div>
				{#each superAdminNavItems as item (item.href)}
					<a href={item.href} data-tour={item.tour} class:active={isActive(item.href)}
						>{item.label}</a
					>
				{/each}
			{/if}
			<div class="nav-divider"></div>
			<a href={reportsHref} data-tour="nav-reports" class:active={isActive(reportsHref)}>Riportok</a
			>
		</nav>

		<div class="sidebar-footer">
			<span class="user">{profile.display_name}</span>
			<form method="POST" action="/logout">
				<Button type="submit" variant="ghost">Kijelentkezés</Button>
			</form>
		</div>
	</aside>

	<main class="admin-content">
		{#if tourState.current && !workspace}
			<div class="content-topbar" data-tour="tour-button"><TourButton /></div>
		{/if}
		{@render children()}
	</main>
</div>

<style>
	.admin-shell {
		display: flex;
		min-height: 100vh;
		background: var(--cabinet);
		color: var(--marquee);
		font-family: var(--font-body, sans-serif);
	}

	.sidebar {
		width: 15.5rem;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: var(--cabinet-2);
		border-right: 1px solid var(--panel-border, var(--cabinet-3));
		padding: 1.75rem 1rem;
		gap: 1.75rem;
		/* P1 — a sidebar saját magasságában (100dvh) rögzítve marad és
		   belül görget, ha a nav+footer magasabb a viewportnál, így a fő
		   tartalom görgetésétől függetlenül mindig elérhető marad. */
		position: sticky;
		top: 0;
		height: 100dvh;
		overflow-y: auto;
	}

	.brand {
		padding: 0 0.75rem;
		font-family: var(--font-display, serif);
		font-size: 1.3rem;
		font-weight: 600;
		color: var(--marquee);
		text-decoration: none;
	}

	.brand span {
		font-family: var(--font-body, sans-serif);
		font-size: 0.8rem;
		font-weight: 400;
		color: var(--marquee-dim);
	}

	nav {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	nav a {
		color: var(--marquee-dim);
		text-decoration: none;
		padding: 0.6rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.95rem;
	}

	nav a:hover {
		color: var(--marquee);
		background: var(--cabinet);
	}

	nav a.active {
		color: var(--cyan);
		background: color-mix(in srgb, var(--cyan) 12%, var(--cabinet-2));
		font-weight: 600;
	}

	nav a:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 2px;
	}

	.nav-divider {
		border-top: 1px solid var(--panel-border, var(--cabinet-3));
		margin: 0.5rem 0.75rem;
	}

	.sidebar-footer {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0 0.75rem;
		font-size: 0.9rem;
	}

	.user {
		color: var(--marquee-dim);
	}

	.admin-content {
		flex: 1;
		padding: 2rem 3rem;
		min-width: 0;
		max-width: 80rem;
	}

	.workspace .sidebar,
	.workspace .hamburger,
	.workspace .backdrop {
		display: none;
	}

	.workspace .admin-content {
		padding: 0;
		max-width: none;
	}

	.content-topbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: -0.5rem;
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
			border: 1px solid var(--panel-border, var(--violet));
			background: var(--cabinet-2);
		}

		.hamburger span {
			display: block;
			width: 1.25rem;
			height: 2px;
			background: var(--marquee);
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
			background: rgb(0 0 0 / 35%);
			cursor: pointer;
		}

		.admin-content {
			padding: 4.5rem 1rem 1.5rem;
		}
	}
</style>
