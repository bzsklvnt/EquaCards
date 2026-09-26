<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Workspace from '$lib/components/admin/Workspace.svelte';
	import RailList from '$lib/components/admin/RailList.svelte';
	import GameHeader from '$lib/components/admin/GameHeader.svelte';
	import ReopenGameButton from '$lib/components/ReopenGameButton.svelte';
	import DeleteGameButton from '$lib/components/DeleteGameButton.svelte';
	import { toBudapestLocalInput } from '$lib/datetime';
	import { siteUrl } from '$lib/site';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import { plainKey, registerPageShortcuts } from '$lib/admin/keys.svelte';
	import { createSelection } from '$lib/admin/selection.svelte';
	import type { PageData } from './$types';

	// Esemény és jelentkezések — lista (csapatok) · részlet (a kijelölt
	// jelentkezés) · beállítások (automatikus mentés). docs/features/admin-workspace.md.
	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'game-event');

	type Reg = PageData['registrations'][number];

	const game = $derived(data.game);
	const isSuperAdmin = $derived(data.profile?.role_id === 1);
	const defaultThemeId = $derived(data.themes.find((t) => t.isDefault)?.id ?? '');

	const confirmed = $derived(data.registrations.filter((r) => r.status === 'confirmed'));
	const waitlist = $derived(data.registrations.filter((r) => r.status === 'waitlist'));
	const cancelled = $derived(data.registrations.filter((r) => r.status === 'cancelled'));
	const confirmedPlayers = $derived(confirmed.reduce((sum, r) => sum + r.headcount, 0));
	const waitlistPosition = $derived(new Map(waitlist.map((r, i) => [r.id, i + 1])));

	let search = $state('');
	const matches = (r: Reg) => {
		const needle = search.trim().toLowerCase();
		return (
			!needle ||
			r.team_name.toLowerCase().includes(needle) ||
			(r.contact_email ?? '').toLowerCase().includes(needle) ||
			r.contact_name.toLowerCase().includes(needle)
		);
	};
	const groups = $derived([
		{
			label: `Bekerült · ${confirmed.length}`,
			meta: `${confirmedPlayers} fő`,
			items: confirmed.filter(matches)
		},
		{ label: `Várólista · ${waitlist.length}`, items: waitlist.filter(matches) },
		{ label: `Lemondott · ${cancelled.length}`, items: cancelled.filter(matches) }
	]);
	const selection = createSelection(
		'reg',
		() => groups.find((g) => g.items.length > 0)?.items[0]?.id ?? null
	);
	const selected = $derived(data.registrations.find((r) => r.id === selection.id) ?? null);

	// Nem resolve()-olt: a nyilvános oldal külön domainen is lehet (PUBLIC_SITE_URL).
	const publicHref = $derived(siteUrl(`/esemeny/${game.id}`));

	function formatShort(iso: string): string {
		return new Date(iso).toLocaleString('hu-HU', {
			timeZone: 'Europe/Budapest',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// --- Jelentkezés-műveletek ------------------------------------------------
	let busy = $state(false);
	let cancelForm = $state<HTMLFormElement>();
	let promoteForm = $state<HTMLFormElement>();

	function action(success: string, ask?: string): SubmitFunction {
		return (input) => {
			if (ask && !confirm(ask)) {
				input.cancel();
				return;
			}
			busy = true;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'success') {
					const promoted = Number(result.data?.promoted ?? 0);
					toast.success(
						promoted
							? `${success} ${promoted} csapat bekerült a várólistáról (e-mailt kapnak).`
							: success
					);
				} else if (result.type === 'failure') {
					toast.error((result.data?.error as string) ?? 'Nem sikerült a művelet.');
				} else if (result.type === 'error') {
					toast.error('Váratlan hiba történt.');
				}
				await update({ reset: false });
			};
		};
	}

	// --- Helyszíni csapat ------------------------------------------------------
	let walkinOpen = $state(false);
	let walkinDialog = $state<HTMLDialogElement>();
	let walkinName = $state('');
	let walkinHeadcount = $state('4');
	let lastWalkin = $state<{ name: string; code: string } | null>(null);

	$effect(() => {
		if (!walkinDialog) return;
		if (walkinOpen && !walkinDialog.open) walkinDialog.showModal();
		if (!walkinOpen && walkinDialog.open) walkinDialog.close();
	});

	const addWalkin: SubmitFunction = () => {
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'success' && result.data?.walkinCode) {
				lastWalkin = {
					name: String(result.data.walkinName ?? ''),
					code: String(result.data.walkinCode)
				};
				toast.success(`Helyszíni csapat felvéve — csapatkód: ${lastWalkin.code}`);
				walkinName = '';
				walkinHeadcount = '4';
			} else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült a művelet.');
			}
			await update({ reset: false });
		};
	};

	// --- Esemény beállításai: automatikus mentés -------------------------------
	const initial = untrack(() => data.game);
	let fields = $state({
		title: initial.title,
		scheduled_at: toBudapestLocalInput(initial.scheduled_at),
		venue_id: initial.venue_id ?? '',
		max_players: initial.max_players?.toString() ?? '',
		public_note: initial.public_note ?? '',
		is_public: initial.is_public,
		join_requires_code: initial.join_requires_code,
		design_theme_id: initial.design_theme_id ?? ''
	});
	let saveState = $state<'saved' | 'dirty' | 'saving' | 'error'>('saved');
	let saveError = $state('');
	let settingsForm = $state<HTMLFormElement>();
	let lastSent = JSON.stringify(untrack(() => fields));
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const snapshot = JSON.stringify(fields);
		if (snapshot === lastSent) return;
		saveState = 'dirty';
		clearTimeout(timer);
		timer = setTimeout(() => settingsForm?.requestSubmit(), 800);
	});

	const saveEvent: SubmitFunction = () => {
		lastSent = JSON.stringify(fields);
		saveState = 'saving';
		return async ({ result, update }) => {
			if (result.type === 'success') {
				saveState = JSON.stringify(fields) === lastSent ? 'saved' : 'dirty';
				saveError = '';
				const promoted = Number(result.data?.promoted ?? 0);
				if (promoted) toast.success(`${promoted} csapat bekerült a várólistáról (e-mailt kapnak).`);
			} else if (result.type === 'failure') {
				saveState = 'error';
				saveError = (result.data?.error as string) ?? 'Nem sikerült menteni.';
			} else {
				saveState = 'error';
				saveError = 'Váratlan hiba történt.';
			}
			await update({ reset: false });
		};
	};

	// --- Export ----------------------------------------------------------------
	function csvCell(value: string | number | null | undefined): string {
		const text = String(value ?? '');
		return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	}

	function exportCsv() {
		const rows = [
			[
				'Csapat',
				'Fő',
				'Állapot',
				'Kapcsolattartó',
				'E-mail',
				'Telefon',
				'Csapatkód',
				'Megjegyzés',
				'Jelentkezett'
			],
			...data.registrations.map((r) => [
				r.team_name,
				r.headcount,
				r.status === 'confirmed' ? 'bekerült' : r.status === 'waitlist' ? 'várólista' : 'lemondott',
				r.contact_name,
				r.contact_email,
				r.contact_phone,
				r.status === 'confirmed' ? r.join_code : '',
				r.note,
				formatShort(r.created_at)
			])
		];
		// Pontosvessző + BOM: a magyar Excel így nyitja meg helyesen.
		const csv = '﻿' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = `${game.title.replace(/[^\p{L}\p{N}]+/gu, '-')}-jelentkezesek.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function copyEmails() {
		const emails = confirmed
			.map((r) => r.contact_email)
			.filter(Boolean)
			.join(', ');
		try {
			await navigator.clipboard.writeText(emails);
			toast.success(`${confirmed.length} e-mail cím a vágólapon.`);
		} catch {
			toast.error('Nem sikerült a vágólapra másolni.');
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (!plainKey(e)) return;
		const key = e.key.toLowerCase();
		if (key === 'w') {
			e.preventDefault();
			walkinOpen = true;
		} else if ((e.key === 'Delete' || e.key === 'Backspace') && selected?.status !== 'cancelled') {
			if (selected) {
				e.preventDefault();
				cancelForm?.requestSubmit();
			}
		} else if (key === 'p' && selected?.status === 'waitlist') {
			e.preventDefault();
			promoteForm?.requestSubmit();
		}
	}

	registerPageShortcuts(() => [
		{
			title: 'Esemény',
			items: [
				{ label: 'Helyszíni csapat felvétele', keys: ['W'] },
				{ label: 'Beengedés (várólistáról)', keys: ['P'] },
				{ label: 'Jelentkezés lemondása', keys: ['Del'] }
			]
		}
	]);
</script>

<svelte:head>
	<title>{game.title} – esemény — Kezelőfelület</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="page">
	<GameHeader {game} active="event">
		{#snippet status()}
			{#if saveState === 'saving'}<span class="ws-saved busy">Mentés…</span>
			{:else if saveState === 'dirty'}<span class="ws-saved busy">● Nem mentett változás</span>
			{:else if saveState === 'error'}<span class="ws-saved error" title={saveError}
					>● Nem sikerült menteni</span
				>
			{:else}<span class="ws-saved">● Mentve</span>{/if}
		{/snippet}
		{#snippet actions()}
			{#if game.status === 'finished'}<ReopenGameButton gameId={game.id} />{/if}
			{#if game.is_public}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- nyilvános domain -->
				<a class="ws-btn" href={publicHref} target="_blank" rel="noopener">Nyilvános oldal ↗</a>
			{/if}
		{/snippet}
	</GameHeader>

	<Workspace
		fill
		label="Esemény és jelentkezések"
		sideWidth="23rem"
		keys={[
			['↑ ↓', 'csapatok'],
			['W', 'helyszíni csapat'],
			['P', 'beengedés'],
			['Del', 'lemondás'],
			['/', 'keresés']
		]}
	>
		{#snippet rail()}
			<RailList
				label="Jelentkezések"
				{groups}
				getId={(r) => r.id}
				selectedId={selection.id}
				onselect={(r) => selection.set(r.id)}
				bind:search
				placeholder="Csapat vagy e-mail…"
				empty={data.registrations.length === 0 ? 'Még nincs jelentkezés.' : 'Nincs találat.'}
			>
				{#snippet header()}
					<div class="capacity" data-tour="ev-stats">
						<div class="cap-row">
							<span
								><b>{confirmedPlayers}</b>{game.max_players ? ` / ${game.max_players}` : ''} fő</span
							>
							<span class="dim"
								>{game.max_players
									? `${Math.max(game.max_players - confirmedPlayers, 0)} hely szabad`
									: 'nincs korlát'}</span
							>
						</div>
						{#if game.max_players}
							<div class="ws-bar">
								<i style="width: {Math.min(100, (confirmedPlayers / game.max_players) * 100)}%"></i>
							</div>
						{/if}
					</div>
				{/snippet}
				{#snippet item(r)}
					<span
						class="ws-item-text"
						data-tour={r.id === data.registrations[0]?.id ? 'ev-table' : undefined}
					>
						<strong>{r.team_name}</strong>
						<small
							>{r.headcount} fő{#if r.status === 'confirmed'}
								· {r.join_code}{#if r.team_id}
									· belépett{/if}{:else if r.status === 'waitlist'}
								· {waitlistPosition.get(r.id)}. hely{/if}</small
						>
					</span>
					{#if r.status === 'confirmed' && r.team_id}<span class="joined" title="Belépett">✓</span>
					{:else if r.status === 'waitlist'}<span class="ws-pill warn">vár</span>{/if}
				{/snippet}
				{#snippet footer()}
					<button
						type="button"
						class="ws-btn outline"
						data-tour="ev-walkin"
						onclick={() => (walkinOpen = true)}>+ Helyszíni <kbd class="ws-kbd">W</kbd></button
					>
					<button
						type="button"
						class="ws-btn"
						onclick={exportCsv}
						disabled={data.registrations.length === 0}>Export CSV</button
					>
				{/snippet}
			</RailList>
		{/snippet}

		{#snippet main()}
			{#if selected}
				{@const r = selected}
				<div class="ws-crumb">
					Esemény › Jelentkezések › {r.status === 'confirmed'
						? 'Bekerült'
						: r.status === 'waitlist'
							? 'Várólista'
							: 'Lemondott'}
				</div>
				<div class="ws-head">
					<h1 class="ws-h1">{r.team_name}</h1>
					{#if r.status === 'confirmed'}
						<span class="ws-pill ok"
							>Bekerült · {formatShort(r.promoted_at ?? r.created_at)}{r.promoted_at
								? ' (várólistáról)'
								: ''}</span
						>
					{:else if r.status === 'waitlist'}
						<span class="ws-pill warn">Várólista · {waitlistPosition.get(r.id)}. hely</span>
					{:else}
						<span class="ws-pill"
							>Lemondva{r.cancelled_at ? ` · ${formatShort(r.cancelled_at)}` : ''}</span
						>
					{/if}
				</div>

				{#if r.status === 'confirmed'}
					<div class="ws-card code-card">
						<div>
							<p class="ws-cap">Csapatkód</p>
							<code class="code">{r.join_code}</code>
						</div>
						<div class="code-info">
							<span
								>{#if r.team_id}<span class="ok">✓</span> Belépett a játékba{:else}Még nem lépett be{/if}</span
							>
							<span class="dim">A visszaigazoló e-mailben elküldve.</span>
						</div>
					</div>
				{/if}

				<div class="ws-card">
					<h2>Kapcsolat</h2>
					<div class="ws-grid2">
						<div class="info"><span>Kapcsolattartó</span><b>{r.contact_name}</b></div>
						<div class="info"><span>Létszám</span><b>{r.headcount} fő</b></div>
						<div class="info">
							<span>E-mail</span>
							{#if r.contact_email}<a href={`mailto:${r.contact_email}`}>{r.contact_email}</a
								>{:else}<b>—</b>{/if}
						</div>
						<div class="info"><span>Telefon</span><b>{r.contact_phone || '—'}</b></div>
					</div>
					{#if r.note}<p class="ws-note">„{r.note}”</p>{/if}
					<p class="dim small">Jelentkezett: {formatShort(r.created_at)}</p>
				</div>

				<div class="row-actions">
					{#if r.status === 'waitlist'}
						<form
							bind:this={promoteForm}
							method="POST"
							action="?/promote"
							use:enhance={action('Csapat beengedve.')}
						>
							<input type="hidden" name="registration_id" value={r.id} />
							<button type="submit" class="ws-btn primary" disabled={busy}
								>Beengedés a korláttól függetlenül <kbd class="ws-kbd">P</kbd></button
							>
						</form>
					{/if}
					{#if r.status !== 'cancelled'}
						<form
							bind:this={cancelForm}
							method="POST"
							action="?/cancel"
							use:enhance={action(
								'Jelentkezés lemondva.',
								`Biztosan lemondod a(z) „${r.team_name}” jelentkezését?`
							)}
						>
							<input type="hidden" name="registration_id" value={r.id} />
							<button type="submit" class="ws-btn danger" disabled={busy}
								>Lemondás a csapat nevében <kbd class="ws-kbd">Del</kbd></button
							>
						</form>
					{/if}
					{#if confirmed.length > 0}
						<button type="button" class="ws-btn" onclick={copyEmails}
							>Megerősített e-mail címek másolása</button
						>
					{/if}
				</div>
				<p class="ws-note">
					Ha egy megerősített csapat lemond, a várólistáról sorban bekerülnek azok, akiknek a
					létszáma belefér — erről automatikusan e-mailt kapnak.
				</p>
			{:else}
				<div class="ws-empty">
					<h2>Még nincs jelentkezés</h2>
					<p>
						{game.is_public
							? 'A nyilvános oldalon lehet jelentkezni.'
							: 'Tedd nyilvánossá az estét (jobb oldalt), hogy a kezdőlapon megjelenjen.'}
						Helyszíni csapatot a W billentyűvel vehetsz fel.
					</p>
				</div>
			{/if}
			{#if lastWalkin}
				<p class="walkin-code" role="status">
					Legutóbbi helyszíni csapat: <b>{lastWalkin.name}</b> <code>{lastWalkin.code}</code>
				</p>
			{/if}
		{/snippet}

		{#snippet side()}
			<form
				bind:this={settingsForm}
				method="POST"
				action="?/saveEvent"
				class="settings"
				data-tour="ev-settings"
				use:enhance={saveEvent}
			>
				<div class="side-head">
					<p class="ws-cap">Esemény beállításai</p>
					<span class="dim small">automatikus mentés</span>
				</div>
				{#if saveState === 'error'}<p class="save-error" role="alert">{saveError}</p>{/if}
				<label class="ws-field"
					><span>Név</span><input
						name="title"
						bind:value={fields.title}
						required
						maxlength="120"
					/></label
				>
				<label class="ws-field"
					><span>Időpont (magyar idő)</span><input
						name="scheduled_at"
						type="datetime-local"
						bind:value={fields.scheduled_at}
					/></label
				>
				<label class="ws-field">
					<span>Helyszín · <a href={resolve('/admin/venues')}>kezelés</a></span>
					<select name="venue_id" bind:value={fields.venue_id}>
						<option value="">— nincs megadva —</option>
						{#each data.venues as venue (venue.id)}
							<option value={venue.id}>{venue.name}{venue.city ? ` (${venue.city})` : ''}</option>
						{/each}
					</select>
				</label>
				<label class="ws-field"
					><span>Létszámkorlát (fő)</span><input
						name="max_players"
						type="number"
						min="1"
						placeholder="üresen: nincs korlát"
						bind:value={fields.max_players}
					/></label
				>
				<label class="ws-toggle" data-tour="ev-public">
					<span>Nyilvános — a kezdőlapon, lehet jelentkezni</span>
					<input type="checkbox" name="is_public" bind:checked={fields.is_public} />
				</label>
				<label class="ws-toggle" data-tour="ev-join-code">
					<span>Belépés csak csapatkóddal</span>
					<input
						type="checkbox"
						name="join_requires_code"
						bind:checked={fields.join_requires_code}
					/>
				</label>
				<fieldset class="themes" data-tour="ev-theme">
					<legend class="ws-cap">Megjelenés ezen az estén</legend>
					<div class="theme-grid">
						{#each data.themes as theme (theme.id)}
							<label
								class="theme"
								class:on={(fields.design_theme_id || defaultThemeId) === theme.id}
							>
								<input
									type="radio"
									name="design_theme_id"
									value={theme.id}
									checked={(fields.design_theme_id || defaultThemeId) === theme.id}
									onchange={() => (fields.design_theme_id = theme.id)}
								/>
								<span
									class="swatch"
									style="background: {theme.swatch.bg}; color: {theme.swatch
										.text}; border-color: {theme.swatch.accent}"
									aria-hidden="true">Aa</span
								>
								{theme.title}
							</label>
						{/each}
					</div>
				</fieldset>
				<label class="ws-field"
					><span>Leírás a nyilvános oldalon</span><textarea
						name="public_note"
						rows="3"
						placeholder="pl. témák, nevezési díj, asztalfoglalás"
						bind:value={fields.public_note}></textarea></label
				>
			</form>
			<p class="ws-note">
				A várólistáról automatikusan bekerül, aki befér, ha emeled a korlátot vagy valaki lemond —
				és e-mailt kap.
			</p>
			{#if isSuperAdmin}
				<div class="danger-zone" data-tour="ev-delete">
					<p class="ws-cap">Kvízeste törlése</p>
					<DeleteGameButton
						gameId={game.id}
						title={game.title}
						running={game.status === 'active' || game.status === 'paused'}
						details={`${confirmed.length + waitlist.length} jelentkezés`}
					/>
				</div>
			{/if}
		{/snippet}
	</Workspace>
</div>

<dialog
	bind:this={walkinDialog}
	class="walkin-dialog"
	aria-labelledby="walkin-title"
	onclose={() => (walkinOpen = false)}
>
	<form method="POST" action="?/addWalkin" use:enhance={addWalkin}>
		<h2 id="walkin-title">Helyszíni csapat felvétele</h2>
		<p class="ws-note">
			Előzetes jelentkezés nélkül érkezett csapatnak: kap egy csapatkódot, ezt mondd meg nekik a
			csatlakozáshoz. A létszámkorlátot nem ellenőrzi.
		</p>
		<div class="ws-grid2">
			<label class="ws-field"
				><span>Csapatnév</span><input
					name="team_name"
					bind:value={walkinName}
					required
					maxlength="40"
				/></label
			>
			<label class="ws-field"
				><span>Fő</span><input
					name="headcount"
					type="number"
					min="1"
					max="12"
					bind:value={walkinHeadcount}
					required
				/></label
			>
		</div>
		{#if lastWalkin}
			<p class="walkin-code" role="status">
				<b>{lastWalkin.name}</b> csapatkódja: <code>{lastWalkin.code}</code>
			</p>
		{/if}
		<div class="dialog-actions">
			<button type="button" class="ws-btn" onclick={() => (walkinOpen = false)}>Bezárás</button>
			<button type="submit" class="ws-btn primary" disabled={busy || !walkinName.trim()}
				>Felvétel</button
			>
		</div>
	</form>
</dialog>

<style>
	.page {
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}

	.capacity {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.85rem;
	}

	.cap-row {
		display: flex;
		justify-content: space-between;
	}

	.dim {
		color: var(--marquee-dim);
	}

	.small {
		font-size: 0.8rem;
	}

	.joined,
	.ok {
		color: var(--power);
		font-weight: 800;
	}

	.code-card {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		gap: 1.5rem;
	}

	.code {
		font-family: ui-monospace, monospace;
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: 0.2em;
	}

	.code-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.92rem;
	}

	.info span {
		font-size: 0.78rem;
		color: var(--marquee-dim);
	}

	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.walkin-code {
		margin: 0;
		font-size: 0.9rem;
	}

	.walkin-code code {
		padding: 0.15rem 0.45rem;
		border-radius: 0.35rem;
		background: var(--cabinet);
		font-weight: 700;
		letter-spacing: 0.15em;
	}

	.settings {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.side-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.save-error {
		margin: 0;
		padding: 0.5rem 0.7rem;
		border-radius: 0.55rem;
		background: color-mix(in srgb, var(--danger) 10%, var(--cabinet-2));
		color: var(--danger);
		font-size: 0.85rem;
	}

	.themes {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.theme-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.theme {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.6rem 0.35rem 0.35rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.6rem;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.theme.on {
		border: 2px solid var(--cyan);
	}

	.theme input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.theme:focus-within {
		outline: 3px solid var(--cyan);
		outline-offset: 1px;
	}

	.swatch {
		width: 1.8rem;
		height: 1.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid;
		border-radius: 0.4rem;
		font-size: 0.72rem;
		font-weight: 700;
	}

	.danger-zone {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.walkin-dialog {
		width: min(30rem, calc(100vw - 2rem));
		padding: 1.3rem 1.4rem;
		border: 0;
		border-radius: 1rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		font-family: var(--font-body);
		box-shadow: 0 30px 60px rgb(0 0 0 / 25%);
	}

	.walkin-dialog::backdrop {
		background: rgb(28 27 24 / 40%);
	}

	.walkin-dialog form {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.walkin-dialog h2 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	@media (max-width: 1100px) {
		.page {
			height: auto;
			min-height: 100dvh;
		}
	}
</style>
