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
	import SaveIndicator from './admin/SaveIndicator.svelte';
	import './admin/workspace.css';

	// A kezelői felület közös kerete (admin + riportok): oldalsó menüsáv
	// (tetején az automatikus mentés állapota, összecsukható ikonsávvá;
	// telefonon jobb felső hamburger), Ctrl+K
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
	// billentyűparancsokat használnak — ott a G+betű ugrás nem él.
	const workspace = $derived(page.data.workspace === true);

	const isAdminRole = $derived(profile.role_id === 1 || profile.role_id === 2);

	type NavItem = { href: string; label: string; tour: string; g: string; icon: string };

	// Egyszerű vonalas ikonok (24×24) — összecsukott menüben ezek látszanak.
	const ICONS: Record<string, string> = {
		dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
		games: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
		questions: 'M4 8h12v12H4zM8 4h12v12M8 12h4M8 15h3',
		themes: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
		venues:
			'M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
		design:
			'M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A1.7 1.7 0 0 1 12 22zM7.5 11h.01M10 7h.01M15 7h.01M17.5 11h.01',
		reports: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
		users:
			'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
		settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
		search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
		help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v.01M12 13a2.5 2.5 0 1 0-2.5-2.5'
	};

	const navItems = $derived.by((): NavItem[] => {
		const items: NavItem[] = [];
		if (isAdminRole) {
			items.push(
				{
					href: resolve('/admin'),
					label: 'Vezérlőpult',
					tour: 'nav-dashboard',
					g: 'v',
					icon: 'dashboard'
				},
				{
					href: resolve('/admin/games'),
					label: 'Kvízesték',
					tour: 'nav-games',
					g: 'e',
					icon: 'games'
				},
				{
					href: resolve('/admin/questions'),
					label: 'Kérdésbank',
					tour: 'nav-questions',
					g: 'k',
					icon: 'questions'
				},
				{
					href: resolve('/admin/themes'),
					label: 'Témák',
					tour: 'nav-themes',
					g: 't',
					icon: 'themes'
				},
				{
					href: resolve('/admin/venues'),
					label: 'Helyszínek',
					tour: 'nav-venues',
					g: 'h',
					icon: 'venues'
				},
				{
					href: resolve('/admin/design-themes'),
					label: 'Vizuális témák',
					tour: 'nav-design-themes',
					g: 'd',
					icon: 'design'
				}
			);
		}
		items.push({
			href: resolve('/reports'),
			label: 'Riportok',
			tour: 'nav-reports',
			g: 'r',
			icon: 'reports'
		});
		return items;
	});

	const adminItems = $derived.by((): NavItem[] =>
		profile.role_id === 1
			? [
					{
						href: resolve('/admin/users'),
						label: 'Felhasználók',
						tour: 'nav-users',
						g: 'f',
						icon: 'users'
					},
					{
						href: resolve('/admin/settings'),
						label: 'Beállítások',
						tour: 'nav-settings',
						g: 'b',
						icon: 'settings'
					}
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

	// Összecsukás: 'auto' = laptopon (1440 px alatt) ikonsáv, nagy kijelzőn
	// kinyitva (CSS dönti el, így betöltéskor nem ugrik); a kézi váltás
	// eszközönként megmarad.
	const NAV_KEY = 'equacards:nav';
	const COLLAPSE_QUERY = '(max-width: 1439px)';
	let navMode = $state<'auto' | 'collapsed' | 'expanded'>('auto');

	$effect(() => {
		try {
			const saved = localStorage.getItem(NAV_KEY);
			if (saved === 'collapsed' || saved === 'expanded') navMode = saved;
		} catch {
			// privát mód / tiltott tárolás: marad az automatikus
		}
	});

	function toggleNav() {
		const collapsedNow =
			navMode === 'collapsed' || (navMode === 'auto' && matchMedia(COLLAPSE_QUERY).matches);
		navMode = collapsedNow ? 'expanded' : 'collapsed';
		try {
			localStorage.setItem(NAV_KEY, navMode);
		} catch {
			// nem baj, ha nem marad meg
		}
	}

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
		if (e.key === 'Escape' && menuOpen) {
			menuOpen = false;
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

{#snippet icon(name: string)}
	<svg class="ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"
		><path d={ICONS[name]} /></svg
	>
{/snippet}

{#snippet navLink(item: NavItem)}
	<a
		href={item.href}
		data-tour={item.tour}
		title={item.label}
		class:active={isActive(item.href)}
		aria-current={isActive(item.href) ? 'page' : undefined}
		>{@render icon(item.icon)}<span class="label">{item.label}</span></a
	>
{/snippet}

<div class="admin-shell" class:workspace data-nav={navMode} style={themeCss}>
	<Toaster
		theme="light"
		toastOptions={{
			style:
				'background: var(--cabinet-2); color: var(--marquee); border: 1px solid var(--panel-border); font-family: var(--font-body);'
		}}
	/>

	<!-- Telefonon: felső sáv, jobb felső sarokban a mentés-pötty és a hamburger. -->
	<header class="mobile-bar">
		<a class="brand" href={resolve(isAdminRole ? '/admin' : '/reports')}>Kocsmakvízest</a>
		<SaveIndicator compact />
		<button
			type="button"
			class="hamburger"
			aria-expanded={menuOpen}
			aria-controls="admin-sidebar"
			onclick={() => (menuOpen = !menuOpen)}
		>
			<span></span><span></span><span></span>
			<span class="sr-only">Menü</span>
		</button>
	</header>

	{#if menuOpen}
		<button
			type="button"
			class="backdrop"
			aria-label="Menü bezárása"
			onclick={() => (menuOpen = false)}
		></button>
	{/if}

	<aside id="admin-sidebar" class="sidebar" class:open={menuOpen} aria-label="Kezelői menü">
		<div class="side-top" data-tour="save-status">
			<SaveIndicator />
			<button
				type="button"
				class="collapse"
				title="Menü összecsukása / kinyitása"
				aria-label="Menü összecsukása / kinyitása"
				onclick={toggleNav}
				><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
					><path d="M15 6l-6 6 6 6" /></svg
				></button
			>
			<button
				type="button"
				class="close"
				aria-label="Menü bezárása"
				onclick={() => (menuOpen = false)}
				><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
					><path d="M6 6l12 12M18 6L6 18" /></svg
				></button
			>
		</div>

		<nav class="nav" aria-label="Fő menü">
			{#each navItems as item (item.href)}{@render navLink(item)}{/each}
			{#if adminItems.length > 0}
				<span class="sep" aria-hidden="true"></span>
				{#each adminItems as item (item.href)}{@render navLink(item)}{/each}
			{/if}
		</nav>

		<div class="side-bottom">
			<button
				type="button"
				class="tool"
				data-tour="cmd-palette"
				title="Keresés, parancs (Ctrl K)"
				onclick={() => (paletteOpen = true)}
				>{@render icon('search')}<span class="label">Keresés</span><kbd class="label">Ctrl K</kbd
				></button
			>
			<button
				type="button"
				class="tool"
				title="Billentyűparancsok (?)"
				onclick={() => (helpOpen = true)}
				>{@render icon('help')}<span class="label">Billentyűparancsok</span></button
			>
			{#if tourState.current}<span class="tour" data-tour="tour-button"><TourButton /></span>{/if}
			<div class="user">
				<button
					type="button"
					class="tool user-btn"
					aria-expanded={userOpen}
					title={profile.display_name}
					onclick={() => (userOpen = !userOpen)}
					><span class="avatar" aria-hidden="true">{profile.display_name.slice(0, 1)}</span><span
						class="label">{profile.display_name}</span
					></button
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
	</aside>

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
		--side-w: 15rem;
		--topbar-h: 0px;
		display: flex;
		min-height: 100vh;
		background: var(--cabinet);
		color: var(--marquee);
		font-family: var(--font-body, sans-serif);
	}

	.sidebar {
		position: sticky;
		top: 0;
		z-index: 20;
		flex-shrink: 0;
		width: var(--side-w);
		height: 100dvh;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.75rem 0.6rem;
		background: var(--cabinet-2);
		border-right: 1px solid var(--panel-border, var(--cabinet-3));
		overflow-y: auto;
		overflow-x: hidden;
	}

	.side-top {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.4rem;
		padding: 0 0.2rem 0.6rem 0.65rem;
		border-bottom: 1px solid var(--panel-border, #e4ded2);
	}

	.side-top :global(.save) {
		flex: 1;
	}

	.collapse {
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--marquee-dim);
		cursor: pointer;
	}

	.close {
		display: none;
	}

	.collapse:hover {
		background: var(--cabinet);
		color: var(--marquee);
	}

	.collapse svg,
	.close svg,
	.ico {
		flex-shrink: 0;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.nav a,
	.tool {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 2.5rem;
		padding: 0 0.65rem;
		border: 0;
		border-radius: 0.55rem;
		background: transparent;
		color: var(--marquee-dim);
		font: inherit;
		font-size: 0.9rem;
		text-align: left;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
	}

	.nav a:hover,
	.tool:hover {
		background: var(--cabinet);
		color: var(--marquee);
	}

	.nav a.active {
		background: color-mix(in srgb, var(--cyan) 12%, var(--cabinet-2));
		color: var(--cyan);
		font-weight: 600;
	}

	.nav a:focus-visible,
	.tool:focus-visible,
	.collapse:focus-visible,
	.hamburger:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 1px;
	}

	.sep {
		height: 1px;
		margin: 0.4rem 0.65rem;
		background: var(--panel-border, #e4ded2);
	}

	.side-bottom {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-top: 0.6rem;
		border-top: 1px solid var(--panel-border, #e4ded2);
	}

	.tool kbd {
		margin-left: auto;
		font-family: ui-monospace, monospace;
		font-size: 0.72rem;
	}

	.tour {
		padding: 0.2rem 0.35rem;
	}

	.tour :global(.tour-button) {
		width: 100%;
	}

	.user {
		position: relative;
	}

	.user-btn {
		width: 100%;
	}

	.avatar {
		flex-shrink: 0;
		width: 1.6rem;
		height: 1.6rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--cyan);
		color: var(--on-primary, #fff);
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
	}

	.user-menu {
		position: absolute;
		left: 0;
		bottom: calc(100% + 0.3rem);
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
		flex: 1;
		min-width: 0;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.mobile-bar,
	.hamburger,
	.backdrop {
		display: none;
	}

	/* Összecsukott (ikonos) sáv: kézi választás, vagy laptopon automatikusan.
	   A feliratok vizuálisan rejtettek, de a képernyőolvasónak megmaradnak. */
	.admin-shell[data-nav='collapsed'] {
		--side-w: 3.9rem;
	}

	.admin-shell[data-nav='collapsed'] .label {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	.admin-shell[data-nav='collapsed'] .side-top {
		flex-direction: column;
		padding: 0 0 0.6rem;
	}

	.admin-shell[data-nav='collapsed'] .side-top :global(.save) {
		justify-content: center;
	}

	.admin-shell[data-nav='collapsed'] .side-top :global(.save .text) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	.admin-shell[data-nav='collapsed'] .collapse svg {
		transform: rotate(180deg);
	}

	.admin-shell[data-nav='collapsed'] .nav a,
	.admin-shell[data-nav='collapsed'] .tool {
		justify-content: center;
		padding: 0;
	}

	.admin-shell[data-nav='collapsed'] .tour :global(.tour-button) {
		font-size: 0;
		padding-inline: 0;
	}

	.admin-shell[data-nav='collapsed'] .tour :global(.tour-button)::after {
		content: '▶';
		font-size: 0.85rem;
	}

	@media (min-width: 800px) and (max-width: 1439px) {
		.admin-shell[data-nav='auto'] {
			--side-w: 3.9rem;
		}

		.admin-shell[data-nav='auto'] .label {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
		}

		.admin-shell[data-nav='auto'] .side-top {
			flex-direction: column;
			padding: 0 0 0.6rem;
		}

		.admin-shell[data-nav='auto'] .side-top :global(.save) {
			justify-content: center;
		}

		.admin-shell[data-nav='auto'] .side-top :global(.save .text) {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
		}

		.admin-shell[data-nav='auto'] .collapse svg {
			transform: rotate(180deg);
		}

		.admin-shell[data-nav='auto'] .nav a,
		.admin-shell[data-nav='auto'] .tool {
			justify-content: center;
			padding: 0;
		}

		.admin-shell[data-nav='auto'] .tour :global(.tour-button) {
			font-size: 0;
			padding-inline: 0;
		}

		.admin-shell[data-nav='auto'] .tour :global(.tour-button)::after {
			content: '▶';
			font-size: 0.85rem;
		}
	}

	/* Telefon / keskeny tablet: felső sáv, a menü jobbról becsúszó fiók
	   (mindig kinyitva: fent a mentésállapot, alatta a menüpontok). */
	@media (max-width: 799px) {
		.admin-shell {
			--topbar-h: 3.25rem;
			display: block;
		}

		.mobile-bar {
			position: sticky;
			top: 0;
			z-index: 30;
			display: flex;
			align-items: center;
			gap: 0.6rem;
			height: var(--topbar-h);
			box-sizing: border-box;
			padding: 0 0.5rem 0 0.9rem;
			background: var(--cabinet-2);
			border-bottom: 1px solid var(--panel-border, var(--cabinet-3));
		}

		.mobile-bar .brand {
			margin-right: auto;
			font-family: var(--font-display, serif);
			font-size: 1.1rem;
			font-weight: 600;
			color: var(--marquee);
			text-decoration: none;
		}

		.hamburger {
			display: flex;
			flex-direction: column;
			justify-content: center;
			gap: 4px;
			width: 2.5rem;
			height: 2.5rem;
			padding: 0 0.6rem;
			border: 0;
			border-radius: 0.5rem;
			background: transparent;
			cursor: pointer;
		}

		.hamburger span:not(.sr-only) {
			height: 2px;
			border-radius: 1px;
			background: var(--marquee);
		}

		.backdrop {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 39;
			border: 0;
			background: rgb(0 0 0 / 30%);
		}

		.sidebar,
		.admin-shell[data-nav] .sidebar {
			position: fixed;
			top: 0;
			right: 0;
			z-index: 40;
			width: min(18rem, 85vw);
			border-right: 0;
			border-left: 1px solid var(--panel-border, var(--cabinet-3));
			transform: translateX(105%);
			visibility: hidden;
			transition:
				transform 0.2s ease,
				visibility 0s linear 0.2s;
		}

		.sidebar.open,
		.admin-shell[data-nav] .sidebar.open {
			transform: none;
			visibility: visible;
			box-shadow: -12px 0 30px rgb(0 0 0 / 12%);
			transition: transform 0.2s ease;
		}

		.admin-shell[data-nav] .label,
		.admin-shell[data-nav] .side-top :global(.save .text) {
			position: static;
			width: auto;
			height: auto;
			clip: auto;
		}

		.admin-shell[data-nav] .side-top {
			flex-direction: row;
			padding: 0 0.2rem 0.6rem 0.65rem;
		}

		.admin-shell[data-nav] .nav a,
		.admin-shell[data-nav] .tool {
			justify-content: flex-start;
			padding: 0 0.65rem;
			min-height: 2.8rem;
			font-size: 0.95rem;
		}

		.collapse,
		.tool kbd {
			display: none;
		}

		.close {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 2.5rem;
			height: 2.5rem;
			border: 0;
			border-radius: 0.5rem;
			background: transparent;
			color: var(--marquee);
			cursor: pointer;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sidebar {
			transition: none;
		}
	}
</style>
