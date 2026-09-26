<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';
	import Button from '$lib/components/Button.svelte';
	import Checkbox from '$lib/components/Checkbox.svelte';
	import GameTabs from '$lib/components/GameTabs.svelte';
	import Input from '$lib/components/Input.svelte';
	import ReopenGameButton from '$lib/components/ReopenGameButton.svelte';
	import DeleteGameButton from '$lib/components/DeleteGameButton.svelte';
	import Select from '$lib/components/Select.svelte';
	import Textarea from '$lib/components/Textarea.svelte';
	import { formatEventDate, toBudapestLocalInput } from '$lib/datetime';
	import { siteUrl } from '$lib/site';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'game-event');

	const game = $derived(data.game);
	// Kvízestét csak rendszergazda (role_id = 1) törölhet.
	const isSuperAdmin = $derived(data.profile?.role_id === 1);
	const venueName = $derived(data.venues.find((v) => v.id === game.venue_id)?.name ?? null);
	const defaultThemeId = $derived(data.themes.find((t) => t.isDefault)?.id ?? '');
	const selectedThemeId = $derived(game.design_theme_id ?? defaultThemeId);

	const active = $derived(data.registrations.filter((r) => r.status !== 'cancelled'));
	const cancelled = $derived(data.registrations.filter((r) => r.status === 'cancelled'));
	const confirmed = $derived(active.filter((r) => r.status === 'confirmed'));
	const waitlist = $derived(active.filter((r) => r.status === 'waitlist'));
	const confirmedPlayers = $derived(confirmed.reduce((sum, r) => sum + r.headcount, 0));
	const waitlistPlayers = $derived(waitlist.reduce((sum, r) => sum + r.headcount, 0));
	const waitlistPosition = $derived(new Map(waitlist.map((r, i) => [r.id, i + 1])));

	// Nem resolve()-olt: a nyilvános oldal külön domainen is lehet (PUBLIC_SITE_URL).
	const publicHref = $derived(siteUrl(`/esemeny/${game.id}`));

	let saving = $state(false);
	let addingWalkin = $state(false);
	let lastWalkin = $state<{ name: string; code: string } | null>(null);
	let walkinName = $state('');
	let walkinHeadcount = $state('4');
	let busyId = $state<string | null>(null);

	function submit(opts: {
		success: string;
		onStart?: () => void;
		onEnd?: () => void;
	}): SubmitFunction {
		return () => {
			opts.onStart?.();
			return async ({ result, update }) => {
				opts.onEnd?.();
				if (result.type === 'success') {
					const promoted = Number(result.data?.promoted ?? 0);
					toast.success(
						promoted
							? `${opts.success} ${promoted} csapat bekerült a várólistáról (e-mailt kapnak).`
							: opts.success
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

	function confirmFirst(message: string, inner: SubmitFunction): SubmitFunction {
		return (input) => {
			if (!confirm(message)) {
				input.cancel();
				return;
			}
			return inner(input);
		};
	}

	function formatShort(iso: string): string {
		return new Date(iso).toLocaleString('hu-HU', {
			timeZone: 'Europe/Budapest',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
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
</script>

<svelte:head>
	<title>{game.title} – esemény — Kezelőfelület</title>
</svelte:head>

<header class="page-head">
	<div>
		<div class="title-row">
			<h1>{game.title}</h1>
			{#if game.is_practice}
				<span class="badge">Próbaeste</span>
			{:else if game.is_public}
				<span class="badge public">Nyilvános</span>
			{:else}
				<span class="badge">Nem nyilvános</span>
			{/if}
		</div>
		<p class="meta">
			{game.scheduled_at ? formatEventDate(game.scheduled_at) : 'Nincs időpont'}
			{#if venueName}· {venueName}{/if} · PIN: {game.pin}
		</p>
	</div>
	<div class="head-actions">
		{#if game.status === 'finished'}
			<ReopenGameButton gameId={game.id} />
		{/if}
		{#if game.is_public}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- nyilvános domain -->
			<Button variant="secondary" href={publicHref} target="_blank" rel="noopener"
				>Nyilvános oldal ↗</Button
			>
		{/if}
		<Button href={resolve('/host/[game_id]', { game_id: game.id })}>Élő lebonyolítás →</Button>
	</div>
</header>

<GameTabs gameId={game.id} />

<div class="layout">
	<section class="registrations" aria-labelledby="reg-title">
		<div class="stats" data-tour="ev-stats">
			<div class="stat">
				<span class="label">Megerősítve</span>
				<span class="value">
					{confirmedPlayers}
					<small>{game.max_players ? `/ ${game.max_players} fő` : 'fő'}</small>
				</span>
				<span class="sub">{confirmed.length} csapat</span>
			</div>
			<div class="stat">
				<span class="label">Várólista</span>
				<span class="value">{waitlist.length} <small>csapat</small></span>
				<span class="sub">{waitlistPlayers} fő</span>
			</div>
			<div class="stat">
				<span class="label">Szabad hely</span>
				<span class="value">
					{game.max_players ? Math.max(game.max_players - confirmedPlayers, 0) : '∞'}
					<small>fő</small>
				</span>
				<span class="sub">{game.max_players ? 'a létszámkorlátig' : 'nincs korlát'}</span>
			</div>
		</div>

		<div class="table-head">
			<h2 id="reg-title">Jelentkezések</h2>
			{#if confirmed.length}
				<button type="button" class="link-button" onclick={copyEmails}
					>Megerősített e-mail címek másolása</button
				>
			{/if}
		</div>

		{#if data.registrations.length === 0}
			<p class="empty">
				Még nincs jelentkezés. {game.is_public
					? 'A nyilvános oldalon lehet jelentkezni.'
					: 'Tedd nyilvánossá az estét, hogy a kezdőlapon megjelenjen és lehessen jelentkezni.'}
			</p>
		{:else}
			<div class="table" role="table" aria-labelledby="reg-title" data-tour="ev-table">
				<div class="row header" role="row">
					<span role="columnheader">Csapat</span>
					<span role="columnheader">Fő</span>
					<span role="columnheader">Kapcsolattartó</span>
					<span role="columnheader">Csapatkód</span>
					<span role="columnheader">Állapot</span>
					<span role="columnheader"><span class="sr-only">Művelet</span></span>
				</div>
				{#each [...active, ...cancelled] as reg (reg.id)}
					<div
						class="row"
						class:waitlist={reg.status === 'waitlist'}
						class:cancelled={reg.status === 'cancelled'}
						role="row"
					>
						<span role="cell" class="team">
							<strong>{reg.team_name}</strong>
							{#if reg.note}<span class="note">„{reg.note}”</span>{/if}
							<span class="muted small">{formatShort(reg.created_at)}</span>
						</span>
						<span role="cell">{reg.headcount}</span>
						<span role="cell" class="contact">
							<span>{reg.contact_name}</span>
							{#if reg.contact_email}
								<a href={`mailto:${reg.contact_email}`}>{reg.contact_email}</a>
							{/if}
							{#if reg.contact_phone}<span>{reg.contact_phone}</span>{/if}
						</span>
						<span role="cell" class="code-cell">
							{#if reg.status === 'confirmed'}
								<code>{reg.join_code}</code>
								{#if reg.team_id}<span class="muted small">csatlakozott</span>{/if}
							{:else}
								<span class="muted">—</span>
							{/if}
						</span>
						<span role="cell" class="status">
							{#if reg.status === 'confirmed'}
								<span class="ok">Megerősítve</span>
								{#if reg.promoted_at}<span class="muted small">várólistáról</span>{/if}
							{:else if reg.status === 'waitlist'}
								<span class="warn">Várólista #{waitlistPosition.get(reg.id)}</span>
							{:else}
								<span class="muted">Lemondva</span>
							{/if}
						</span>
						<span role="cell" class="actions">
							{#if reg.status === 'waitlist'}
								<form
									method="POST"
									action="?/promote"
									use:enhance={submit({
										success: 'Csapat beengedve.',
										onStart: () => (busyId = reg.id),
										onEnd: () => (busyId = null)
									})}
								>
									<input type="hidden" name="registration_id" value={reg.id} />
									<Button type="submit" variant="secondary" loading={busyId === reg.id}
										>Beenged</Button
									>
								</form>
							{/if}
							{#if reg.status !== 'cancelled'}
								<form
									method="POST"
									action="?/cancel"
									use:enhance={confirmFirst(
										`Biztosan lemondod a(z) „${reg.team_name}” jelentkezését?`,
										submit({
											success: 'Jelentkezés lemondva.',
											onStart: () => (busyId = reg.id),
											onEnd: () => (busyId = null)
										})
									)}
								>
									<input type="hidden" name="registration_id" value={reg.id} />
									<Button type="submit" variant="ghost" loading={busyId === reg.id}>Lemondás</Button
									>
								</form>
							{/if}
						</span>
					</div>
				{/each}
			</div>
			<p class="hint">
				Ha egy megerősített csapat lemond, a várólistáról sorban bekerülnek azok, akiknek a létszáma
				belefér — erről automatikusan e-mailt kapnak. A „Beenged” gomb a korláttól függetlenül
				beengedi a csapatot. A csapatkódot a megerősített csapatok e-mailben kapják meg.
			</p>
		{/if}

		<form
			method="POST"
			action="?/addWalkin"
			class="walkin"
			data-tour="ev-walkin"
			use:enhance={() => {
				addingWalkin = true;
				return async ({ result, update }) => {
					addingWalkin = false;
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
			}}
		>
			<h2>Helyszíni csapat felvétele</h2>
			<p class="hint">
				Előzetes jelentkezés nélkül érkezett csapatnak: kap egy csapatkódot, ezt mondd meg nekik a
				csatlakozáshoz. A létszámkorlátot nem ellenőrzi.
			</p>
			<div class="walkin-row">
				<Input label="Csapatnév" name="team_name" bind:value={walkinName} required maxlength={40} />
				<Input
					label="Fő"
					name="headcount"
					type="number"
					min={1}
					max={12}
					bind:value={walkinHeadcount}
					required
				/>
				<Button type="submit" variant="secondary" loading={addingWalkin}>Felvétel</Button>
			</div>
			{#if lastWalkin}
				<p class="walkin-code" role="status">
					<span>{lastWalkin.name}</span>
					<code>{lastWalkin.code}</code>
				</p>
			{/if}
		</form>
	</section>

	<aside class="settings">
		<form
			method="POST"
			action="?/saveEvent"
			data-tour="ev-settings"
			use:enhance={submit({
				success: 'Esemény mentve.',
				onStart: () => (saving = true),
				onEnd: () => (saving = false)
			})}
		>
			<h2>Esemény adatai</h2>
			<Input label="Név" name="title" value={game.title} required maxlength={120} />
			<Input
				label="Időpont (magyar idő)"
				name="scheduled_at"
				type="datetime-local"
				value={toBudapestLocalInput(game.scheduled_at)}
			/>
			<div class="with-link">
				<Select label="Helyszín" name="venue_id" value={game.venue_id ?? ''}>
					<option value="">— nincs megadva —</option>
					{#each data.venues as venue (venue.id)}
						<option value={venue.id}>{venue.name}{venue.city ? ` (${venue.city})` : ''}</option>
					{/each}
				</Select>
				<a href={resolve('/admin/venues')}>Helyszínek kezelése</a>
			</div>
			<Input
				label="Létszámkorlát (fő)"
				name="max_players"
				type="number"
				min={1}
				value={game.max_players?.toString() ?? ''}
				placeholder="üresen hagyva nincs korlát"
			/>
			<Textarea
				label="Leírás a nyilvános oldalon"
				name="public_note"
				value={game.public_note ?? ''}
				rows={3}
				placeholder="pl. témák, nevezési díj, asztalfoglalás"
			/>
			<div data-tour="ev-public">
				<Checkbox
					label="Nyilvános — megjelenik a kezdőlapon, lehet jelentkezni"
					name="is_public"
					checked={game.is_public}
				/>
			</div>
			<div data-tour="ev-join-code">
				<Checkbox
					label="Csatlakozás csak csapatkóddal (a PIN önmagában nem elég)"
					name="join_requires_code"
					checked={game.join_requires_code}
				/>
			</div>

			<fieldset class="themes" data-tour="ev-theme">
				<legend>Megjelenés ezen az estén</legend>
				<div class="theme-grid">
					{#each data.themes as theme (theme.id)}
						<label class="theme">
							<span
								class="swatch"
								style="background: {theme.swatch.bg}; color: {theme.swatch
									.text}; border-color: {theme.swatch.accent}"
								aria-hidden="true"
								><span
									style="background: {theme.swatch.surface}; border-color: {theme.swatch.accent}"
									>Aa</span
								></span
							>
							<span class="theme-name">
								<input
									type="radio"
									name="design_theme_id"
									value={theme.id}
									checked={theme.id === selectedThemeId}
								/>
								{theme.title}
							</span>
						</label>
					{/each}
				</div>
				<p class="small">A kivetítőn, a host és a csapatok felületén érvényes.</p>
			</fieldset>

			<Button type="submit" loading={saving}>Mentés</Button>
		</form>
		{#if isSuperAdmin}
			<section class="danger-zone" data-tour="ev-delete">
				<h2>Kvízeste törlése</h2>
				<p>
					Véglegesen törli az estét a köreivel, csapataival, válaszaival és jelentkezéseivel együtt.
					A kérdések a kérdésbankban maradnak. Futó estét nem lehet törölni.
				</p>
				<DeleteGameButton
					gameId={game.id}
					title={game.title}
					running={game.status === 'active' || game.status === 'paused'}
					details={`${data.registrations.filter((r) => r.status !== 'cancelled').length} jelentkezés`}
				/>
			</section>
		{/if}
	</aside>
</div>

<style>
	.page-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem 1.5rem;
		margin-top: 0.5rem;
	}

	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 2.1rem;
		font-weight: 400;
	}

	.meta {
		margin: 0.4rem 0 0;
		color: var(--marquee-dim);
	}

	.badge {
		padding: 0.2rem 0.65rem;
		border-radius: 999px;
		background: var(--cabinet-3);
		border: 1px solid var(--panel-border, var(--marquee-dim));
		color: var(--marquee-dim);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.badge.public {
		background: color-mix(in srgb, var(--cyan) 12%, var(--cabinet-2));
		border-color: transparent;
		color: var(--cyan);
	}

	.head-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.registrations {
		min-width: 0;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 21rem;
		gap: 1.75rem;
		align-items: start;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 1rem 1.2rem;
		background: var(--cabinet-2);
		border: 1px solid var(--panel-border, var(--cabinet-3));
		border-radius: 0.75rem;
	}

	.stat .label,
	.stat .sub {
		font-size: 0.85rem;
		color: var(--marquee-dim);
	}

	.stat .value {
		display: flex;
		align-items: baseline;
		gap: 0.3rem;
		font-family: var(--font-display);
		font-size: 1.9rem;
	}

	.stat small {
		font-size: 1rem;
		color: var(--marquee-dim);
	}

	.table-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin: 1.75rem 0 0.75rem;
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.link-button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--cyan);
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		text-decoration: underline;
	}

	.empty {
		padding: 1.5rem;
		border: 1px dashed var(--field-border, var(--marquee-dim));
		border-radius: 0.75rem;
		color: var(--marquee-dim);
	}

	.table {
		background: var(--cabinet-2);
		border: 1px solid var(--panel-border, var(--cabinet-3));
		border-radius: 0.75rem;
		overflow-x: auto;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(7rem, 1.2fr) 2rem minmax(9rem, 1.5fr) 6rem 7rem 7.5rem;
		gap: 0.75rem;
		align-items: center;
		padding: 0.8rem 1.1rem;
		border-bottom: 1px solid
			color-mix(in srgb, var(--panel-border, var(--cabinet-3)) 60%, transparent);
		font-size: 0.95rem;
		min-width: 44rem;
	}

	.row:last-child {
		border-bottom: 0;
	}

	.row.header {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--marquee-dim);
	}

	.row.waitlist {
		background: color-mix(in srgb, var(--coin) 7%, var(--cabinet-2));
	}

	.row.cancelled {
		color: var(--marquee-dim);
	}

	.row.cancelled .team strong {
		text-decoration: line-through;
		font-weight: 400;
	}

	.code-cell {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.code-cell code,
	.walkin-code code {
		font-family: ui-monospace, Menlo, Consolas, monospace;
		font-weight: 700;
		letter-spacing: 0.12em;
	}

	.walkin {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-top: 1.75rem;
		padding: 1.1rem 1.2rem;
		background: var(--cabinet-2);
		border: 1px solid var(--panel-border, var(--cabinet-3));
		border-radius: 0.75rem;
	}

	.walkin .hint {
		margin: 0;
	}

	.walkin-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 5.5rem auto;
		gap: 0.75rem;
		align-items: end;
	}

	.walkin-code {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		padding: 0.7rem 1rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--cyan) 12%, var(--cabinet-2));
	}

	.walkin-code code {
		font-size: 1.4rem;
		color: var(--cyan);
	}

	.team,
	.contact,
	.status {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.contact a,
	.contact span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.contact a {
		font-size: 0.85rem;
		color: var(--marquee-dim);
	}

	.note {
		font-size: 0.8rem;
		color: var(--marquee-dim);
	}

	.muted {
		color: var(--marquee-dim);
	}

	.small {
		font-size: 0.8rem;
	}

	.ok {
		color: var(--power);
		font-weight: 600;
	}

	.warn {
		color: var(--coin);
		font-weight: 600;
	}

	.actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.3rem;
	}

	.hint {
		margin: 0.75rem 0 0;
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--marquee-dim);
	}

	.settings form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.4rem;
		background: var(--cabinet-2);
		border: 1px solid var(--panel-border, var(--cabinet-3));
		border-radius: 0.75rem;
	}

	.with-link {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.with-link a {
		align-self: flex-end;
		font-size: 0.85rem;
		color: var(--cyan);
	}

	.danger-zone {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.6rem;
		margin-top: 1rem;
		padding: 1.1rem 1.2rem;
		border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--cabinet-2));
		border-radius: 0.75rem;
		background: color-mix(in srgb, var(--danger) 5%, var(--cabinet-2));
	}

	.danger-zone p {
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--marquee-dim);
	}

	.themes {
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		color: var(--marquee-dim);
	}

	.theme-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.theme {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.6rem;
		border: 1px solid var(--field-border, var(--marquee-dim));
		border-radius: 0.6rem;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.theme:has(input:checked) {
		border: 2px solid var(--cyan);
		padding: calc(0.6rem - 1px);
	}

	.swatch {
		height: 3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.4rem;
		border: 1px solid;
	}

	.swatch span {
		padding: 0.1rem 0.6rem;
		border: 1px solid;
		border-radius: 0.3rem;
		font-family: Georgia, serif;
	}

	.theme-name {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.theme-name input {
		margin: 0;
		accent-color: var(--cyan);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	@media (max-width: 1100px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.stats {
			grid-template-columns: 1fr;
		}
	}
</style>
