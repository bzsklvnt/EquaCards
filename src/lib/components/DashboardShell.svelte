<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- a linkek resolve()-olt útvonalra épülnek, csak ?lekérdezést vagy előre resolve()-olt href-et fűznek hozzá */
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { defaultTokens, tokensToCssText } from '$lib/theme/tokens';
	import { Toaster } from 'svelte-sonner';
	import TourButton from './TourButton.svelte';
	import ShortcutHelp, { type ShortcutGroup } from './ShortcutHelp.svelte';
	import CommandPalette, { type PaletteEntry } from './admin/CommandPalette.svelte';
	import { tourState } from '$lib/tours/state.svelte';
	import { pageShortcuts, plainKey } from '$lib/admin/keys.svelte';
	import './admin/workspace.css';

	// A kezelői felület közös kerete (admin + riportok): felső menü, Ctrl+K
	// parancspaletta, G+betű ugrás, ? súgó — docs/features/admin-workspace.md.
	// A riportok (role_id 1–4) is ezt használják, a szűkebb admin-kapu
	// öröklése nélkül (Fázis O5).
	let {
		profile,
		children
	}: {
		profile: { display_name: string; role_id: number };
		children: Snippet;
	} = $props();

	// A kezelői héj mindig a letisztult alaptémát használja — a választható
	// témák (pl. "Arcade (fun)") csak a játékfelületekre vonatkoznak.
	const themeCss = tokensToCssText(defaultTokens);

	// Munkaterület-oldalak (a kvízeste összerakó/esemény/eredmények) saját
	// fejlécet használnak — a keret felső sávja ilyenkor elrejtőzik.
	const workspace = $derived(page.data.workspace === true);

	const isAdminRole = $derived(profile.role_id === 1 || profile.role_id === 2);

	type NavItem = { href: string; label: string; tour: string; g: string };

	const navItems = $derived.by((): NavItem[] => {
		const items: NavItem[] = [];
		if (isAdminRole) {
			items.push(
				{ href: resolve('/admin'), label: 'Vezérlőpult', tour: 'nav-dashboard', g: 'v' },
				{ href: resolve('/admin/games'), label: 'Kvízesték', tour: 'nav-games', g: 'e' },
				{ href: resolve('/admin/questions'), label: 'Kérdésbank', tour: 'nav-questions', g: 'k' },
				{ href: resolve('/admin/themes'), label: 'Témák', tour: 'nav-themes', g: 't' },
				{ href: resolve('/admin/venues'), label: 'Helyszínek', tour: 'nav-venues', g: 'h' },
				{
					href: resolve('/admin/design-themes'),
					label: 'Vizuális témák',
					tour: 'nav-design-themes',
					g: 'd'
				}
			);
		}
		items.push({ href: resolve('/reports'), label: 'Riportok', tour: 'nav-reports', g: 'r' });
		return items;
	});

	const adminItems = $derived.by((): NavItem[] =>
		profile.role_id === 1
			? [
					{ href: resolve('/admin/users'), label: 'Felhasználók', tour: 'nav-users', g: 'f' },
					{ href: resolve('/admin/settings'), label: 'Beállítások', tour: 'nav-settings', g: 'b' }
				]
			: []
	);

	// A szekció aloldalain is (pl. /admin/games/123) aktív marad a menüpont.
	function isActive(href: string): boolean {
		const path = page.url.pathname;
		return href === resolve('/admin')
			? path === href
			: path === href || path.startsWith(`${href}/`);
	}

	let paletteOpen = $state(false);
	let helpOpen = $state(false);
	let menuOpen = $state(false);
	let userOpen = $state(false);

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		page.url.pathname;
		menuOpen = false;
		userOpen = false;
	});

	const paletteEntries = $derived.by((): PaletteEntry[] => {
		const pages = [...navItems, ...adminItems].map((n) => ({
			group: 'Oldalak',
			title: n.label,
			href: n.href,
			keys: `G ${n.g.toUpperCase()}`
		}));
		const commands: PaletteEntry[] = isAdminRole
			? [
					{
						group: 'Parancsok',
						title: 'Új kvízeste',
						sub: 'Kvízesték',
						href: `${resolve('/admin/games')}?new=1`
					},
					{
						group: 'Parancsok',
						title: 'Új kérdés a kérdésbankba',
						sub: 'Kérdésbank',
						href: `${resolve('/admin/questions')}?new=1`
					},
					{
						group: 'Parancsok',
						title: 'Új helyszín',
						sub: 'Helyszínek',
						href: `${resolve('/admin/venues')}?new=1`
					}
				]
			: [];
		if (profile.role_id === 1) {
			commands.push({
				group: 'Parancsok',
				title: 'Olvasási idő beállítása',
				sub: 'Beállítások › Játék',
				href: `${resolve('/admin/settings')}?cat=game`
			});
		}
		return [...commands, ...pages];
	});

	const globalGroups = $derived.by((): ShortcutGroup[] => [
		{
			title: 'Mindenhol',
			items: [
				{ label: 'Keresés és parancsok', keys: ['Ctrl', 'K'] },
				...[...navItems, ...adminItems].map((n) => ({
					label: `Ugrás: ${n.label}`,
					keys: ['G', n.g.toUpperCase()]
				})),
				{ label: 'Ez a súgó', keys: ['?'] }
			]
		},
		{
			title: 'Listák',
			items: [
				{ label: 'Előző / következő elem', keys: ['↑', '↓'] },
				{ label: 'Ugyanez', keys: ['K', 'J'] },
				{ label: 'Szűrés a listában', keys: ['/'] },
				{ label: 'Megnyitás', keys: ['Enter'] },
				{ label: 'Kilépés mezőből', keys: ['Esc'] }
			]
		}
	]);

	let gPending = 0;

	function onKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			paletteOpen = true;
			return;
		}
		if (workspace || !plainKey(e)) return;
		const key = e.key.toLowerCase();
		if (Date.now() - gPending < 1200) {
			gPending = 0;
			const target = [...navItems, ...adminItems].find((n) => n.g === key);
			if (target) {
				e.preventDefault();

				void goto(target.href);
			}
			return;
		}
		if (key === 'g') {
			gPending = Date.now();
		} else if (e.key === '?') {
			e.preventDefault();
			helpOpen = true;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="admin-shell" class:workspace style={themeCss}>
	<Toaster
		theme="light"
		toastOptions={{
			style:
				'background: var(--cabinet-2); color: var(--marquee); border: 1px solid var(--panel-border); font-family: var(--font-body);'
		}}
	/>

	{#if !workspace}
		<header class="topbar">
			<a class="brand" href={resolve(isAdminRole ? '/admin' : '/reports')}
				>Kocsmakvízest <span>kezelő</span></a
			>
			<button
				type="button"
				class="menu-toggle"
				aria-expanded={menuOpen}
				aria-controls="admin-nav"
				onclick={() => (menuOpen = !menuOpen)}>Menü ▾</button
			>
			<nav id="admin-nav" class="nav" class:open={menuOpen} aria-label="Fő menü">
				{#each navItems as item (item.href)}
					<a
						href={item.href}
						data-tour={item.tour}
						class:active={isActive(item.href)}
						aria-current={isActive(item.href) ? 'page' : undefined}>{item.label}</a
					>
				{/each}
				{#if adminItems.length > 0}
					<span class="sep" aria-hidden="true"></span>
					{#each adminItems as item (item.href)}
						<a
							href={item.href}
							data-tour={item.tour}
							class:active={isActive(item.href)}
							aria-current={isActive(item.href) ? 'page' : undefined}>{item.label}</a
						>
					{/each}
				{/if}
			</nav>
			<div class="tools">
				<button
					type="button"
					class="cmd"
					data-tour="cmd-palette"
					onclick={() => (paletteOpen = true)}
				>
					<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"
						><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg
					>
					<span class="cmd-label">Keresés, parancs…</span>
					<kbd>Ctrl K</kbd>
				</button>
				{#if tourState.current}<span data-tour="tour-button"><TourButton /></span>{/if}
				<button
					type="button"
					class="icon-btn"
					title="Billentyűparancsok (?)"
					onclick={() => (helpOpen = true)}>?</button
				>
				<div class="user">
					<button
						type="button"
						class="user-btn"
						aria-expanded={userOpen}
						onclick={() => (userOpen = !userOpen)}
						><span class="avatar" aria-hidden="true">{profile.display_name.slice(0, 1)}</span><span
							class="user-name">{profile.display_name}</span
						> ▾</button
					>
					{#if userOpen}
						<div class="user-menu">
							<form method="POST" action="/logout">
								<button type="submit">Kijelentkezés</button>
							</form>
						</div>
					{/if}
				</div>
			</div>
		</header>
	{/if}

	<main class="admin-content">
		{@render children()}
	</main>
</div>

<CommandPalette bind:open={paletteOpen} entries={paletteEntries} canSearch={isAdminRole} />
<ShortcutHelp
	bind:open={helpOpen}
	title="Billentyűparancsok"
	note="Az egybetűs parancsok csak akkor élnek, ha nem szövegmezőben gépelsz."
	groups={[...pageShortcuts.groups, ...globalGroups]}
/>

<style>
	.admin-shell {
		--topbar-h: 3.75rem;
		min-height: 100vh;
		background: var(--cabinet);
		color: var(--marquee);
		font-family: var(--font-body, sans-serif);
	}

	.admin-shell.workspace {
		--topbar-h: 0px;
	}

	.topbar {
		position: sticky;
		top: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 1rem;
		height: var(--topbar-h);
		box-sizing: border-box;
		padding: 0 1.1rem;
		background: var(--cabinet-2);
		border-bottom: 1px solid var(--panel-border, var(--cabinet-3));
	}

	.brand {
		font-family: var(--font-display, serif);
		font-size: 1.2rem;
		font-weight: 600;
		color: var(--marquee);
		text-decoration: none;
		white-space: nowrap;
	}

	.brand span {
		font-family: var(--font-body, sans-serif);
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--marquee-dim);
	}

	.nav {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 4px;
		border-radius: 0.65rem;
		background: var(--cabinet);
		min-width: 0;
		overflow-x: auto;
	}

	.nav a {
		padding: 0.4rem 0.7rem;
		border-radius: 0.45rem;
		color: var(--marquee-dim);
		font-size: 0.86rem;
		text-decoration: none;
		white-space: nowrap;
	}

	.nav a:hover {
		color: var(--marquee);
	}

	.nav a.active {
		background: var(--cabinet-2);
		color: var(--marquee);
		font-weight: 600;
		box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
	}

	.nav a:focus-visible,
	.cmd:focus-visible,
	.icon-btn:focus-visible,
	.user-btn:focus-visible,
	.menu-toggle:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 2px;
	}

	.sep {
		width: 1px;
		align-self: stretch;
		margin: 0.3rem 0.25rem;
		background: var(--panel-border, #e4ded2);
	}

	.tools {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.cmd {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 2.3rem;
		min-width: 13rem;
		padding: 0 0.7rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.6rem;
		background: var(--cabinet-2);
		color: var(--marquee-dim);
		font: inherit;
		font-size: 0.85rem;
		white-space: nowrap;
		cursor: pointer;
	}

	.cmd svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}

	.cmd kbd {
		margin-left: auto;
		font-family: ui-monospace, monospace;
		font-size: 0.72rem;
	}

	.icon-btn,
	.menu-toggle {
		height: 2.3rem;
		min-width: 2.3rem;
		padding: 0 0.6rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.6rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.menu-toggle {
		display: none;
		white-space: nowrap;
	}

	.user {
		position: relative;
	}

	.user-btn {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		height: 2.3rem;
		padding: 0 0.5rem;
		border: 0;
		border-radius: 0.6rem;
		background: transparent;
		color: var(--marquee-dim);
		font: inherit;
		font-size: 0.85rem;
		white-space: nowrap;
		cursor: pointer;
	}

	.avatar {
		width: 1.8rem;
		height: 1.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--cyan);
		color: var(--on-primary, #fff);
		font-weight: 700;
		text-transform: uppercase;
	}

	.user-menu {
		position: absolute;
		right: 0;
		top: calc(100% + 0.3rem);
		min-width: 11rem;
		padding: 0.4rem;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 0.7rem;
		background: var(--cabinet-2);
		box-shadow: 0 12px 30px rgb(0 0 0 / 12%);
	}

	.user-menu button {
		width: 100%;
		padding: 0.55rem 0.7rem;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--marquee);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.user-menu button:hover {
		background: var(--cabinet);
	}

	.admin-content {
		min-width: 0;
	}

	@media (max-width: 1180px) {
		.cmd-label,
		.user-name {
			display: none;
		}

		.cmd {
			min-width: 0;
		}
	}

	@media (max-width: 980px) {
		.menu-toggle {
			display: block;
		}

		.nav {
			display: none;
			position: absolute;
			top: var(--topbar-h);
			left: 0.6rem;
			right: 0.6rem;
			flex-direction: column;
			align-items: stretch;
			padding: 0.5rem;
			border: 1px solid var(--panel-border, #e4ded2);
			border-radius: 0.8rem;
			background: var(--cabinet-2);
			box-shadow: 0 12px 30px rgb(0 0 0 / 12%);
		}

		.nav.open {
			display: flex;
		}

		.nav a {
			padding: 0.65rem 0.8rem;
			font-size: 0.95rem;
		}

		.sep {
			width: auto;
			height: 1px;
			margin: 0.3rem 0.5rem;
		}
	}

	@media (max-width: 520px) {
		.topbar {
			gap: 0.5rem;
			padding: 0 0.6rem;
		}

		.brand {
			font-size: 1.05rem;
		}

		.tools {
			gap: 0.3rem;
		}

		/* Telefonon nincs billentyűzet: a Ctrl K / ? jelzések helyett csak a keresés ikon. */
		.brand span,
		.cmd kbd,
		.icon-btn {
			display: none;
		}

		.cmd {
			padding: 0 0.6rem;
		}

		.tools :global(.tour-button) {
			font-size: 0;
			padding-inline: 0.6rem;
		}

		.tools :global(.tour-button)::after {
			content: '▶';
			font-size: 0.85rem;
		}
	}
</style>
