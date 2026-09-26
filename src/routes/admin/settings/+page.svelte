<script lang="ts">
	import { refreshPage } from '$lib/admin/refresh';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Workspace from '$lib/components/admin/Workspace.svelte';
	import RailList from '$lib/components/admin/RailList.svelte';
	import SettingField from '$lib/components/admin/SettingField.svelte';
	import { createSelection } from '$lib/admin/selection.svelte';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import type { ActionData, PageData } from './$types';

	// Beállítások (csak rendszergazda) — kategóriák · beállítások (automatikus
	// mentés) · élesítés állapota. docs/features/admin-workspace.md,
	// docs/features/app-settings.md.
	let { data, form }: { data: PageData; form: ActionData } = $props();

	registerPageTour(() => 'settings');

	// Barátságos címkék ismert kulcsokhoz — ismeretlen kulcs az „Egyéb”
	// kategóriában, a nyers nevével jelenik meg.
	const SETTING_META: Record<string, { label: string; unit?: string; description?: string }> = {
		question_reuse_cooldown_months: {
			label: 'Kérdés-újrafelhasználási türelmi idő',
			unit: 'hónap',
			description: 'Ennyi hónapig nem húzható újra ugyanaz a kérdés a "Random húzás" funkcióval.'
		},
		question_default_time_seconds: {
			label: 'Alap válaszidő új kérdéshez',
			unit: 'mp',
			description:
				'Új kérdés ezzel a válaszidővel indul a kvízösszerakóban és a kérdésbankban (kérdésenként átírható).'
		},
		question_reading_seconds: {
			label: 'Olvasási idő (alapérték)',
			unit: 'mp',
			description:
				'Minden kérdés előtt ennyi ideig csak a kérdés látszik, utána aktiválódnak a gombok és indul a válaszidő. 0 = nincs olvasási idő. Kérdésenként a kvízösszerakóban felülírható.'
		},
		site_name: {
			label: 'Oldal neve',
			description: 'A nyilvános oldal fejlécében és a böngészőfülön jelenik meg.'
		},
		site_city: {
			label: 'Város',
			description: 'A kezdőlap felső sorában jelenik meg (pl. „Csapatos kvízestek · Budapest”).'
		},
		site_operator_name: {
			label: 'Üzemeltető neve (adatkezelő)',
			description:
				'Az adatkezelési tájékoztatóban szerepel — magánszemély vagy cég neve. Kötelező kitölteni!'
		},
		site_address: {
			label: 'Székhely (impresszum)',
			description: 'Az egyéni vállalkozó székhelye — az Impresszum oldalon jelenik meg. Kötelező!'
		},
		site_tax_number: {
			label: 'Adószám (impresszum)',
			description: 'Az Impresszum oldalon jelenik meg. Kötelező!'
		},
		site_registration: {
			label: 'Nyilvántartási szám (impresszum)',
			description:
				'Az egyéni vállalkozói nyilvántartási szám és a nyilvántartó megnevezése, pl. „EV nyilvántartási szám: 12345678”. Kötelező!'
		},
		site_contact_email: {
			label: 'Kapcsolati e-mail',
			description:
				'Az adatkezelési tájékoztatóban és a nyilvános oldal láblécében jelenik meg. Kötelező kitölteni!'
		}
	};

	type Category = { id: string; title: string; sub: string; keys: string[] };
	const CATEGORIES: Category[] = [
		{
			id: 'game',
			title: 'Játék',
			sub: 'olvasási idő, válaszidő, pihentetés',
			keys: [
				'question_reading_seconds',
				'question_default_time_seconds',
				'question_reuse_cooldown_months'
			]
		},
		{ id: 'appearance', title: 'Megjelenés', sub: 'alap vizuális téma', keys: [] },
		{
			id: 'public',
			title: 'Nyilvános oldal',
			sub: 'név, város, kapcsolat',
			keys: ['site_name', 'site_city', 'site_contact_email']
		},
		{
			id: 'legal',
			title: 'Impresszum és jogi',
			sub: 'üzemeltető, székhely, adószám',
			keys: ['site_operator_name', 'site_address', 'site_tax_number', 'site_registration']
		},
		{ id: 'email', title: 'E-mail', sub: 'küldés, teszt e-mail', keys: [] }
	];
	const knownKeys = new Set(CATEGORIES.flatMap((c) => c.keys));
	const otherKeys = $derived(data.settings.filter((s) => !knownKeys.has(s.key)).map((s) => s.key));
	const categories = $derived(
		otherKeys.length > 0
			? [...CATEGORIES, { id: 'other', title: 'Egyéb', sub: 'további kulcsok', keys: otherKeys }]
			: CATEGORIES
	);

	const PRESETS: Record<string, number[]> = {
		question_reading_seconds: [0, 3, 5, 8, 10],
		question_default_time_seconds: [20, 30, 45, 60]
	};

	const setup = $derived(data.setup);
	const appHostMismatch = $derived(
		setup.appUrl !== null && new URL(setup.appUrl).host !== setup.currentHost
	);
	const legalMissing = $derived(!setup.imprint || !setup.operatorName || !setup.contactEmail);
	const emailMissing = $derived(!setup.email.apiKey || !setup.email.from);

	const selection = createSelection('cat', () => 'game');
	const current = $derived(categories.find((c) => c.id === selection.id) ?? categories[0]);
	const settingsOf = (keys: string[]) =>
		keys
			.map((key) => data.settings.find((s) => s.key === key))
			.filter((s): s is PageData['settings'][number] => !!s);

	let selectedDefaultThemeId = $state(
		untrack(() => data.designThemes.find((t) => t.is_default)?.id ?? data.designThemes[0]?.id ?? '')
	);
	let themeForm = $state<HTMLFormElement>();
	const handleSetDefaultTheme: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') toast.success('Alapértelmezett vizuális téma frissítve.');
			else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült frissíteni a témát.');
			}
			await refreshPage(update);
		};
	};

	let testingEmail = $state(false);
	const emailTest = $derived(form && 'emailTest' in form ? form.emailTest : null);

	function explainEmailError(detail: string): string {
		if (/not verified/i.test(detail)) {
			return 'A feladó domainje még nincs hitelesítve a Resendben. A Rackhost DNS-kezelőjében add hozzá a Resend által kért rekordokat, majd a Resendben nyomd meg a „Verify” gombot.';
		}
		if (/testing emails|your own email/i.test(detail)) {
			return 'A Resend teszt módban van: domain-hitelesítés nélkül csak a fiók saját címére küld.';
		}
		if (/api key/i.test(detail) || detail.startsWith('401')) {
			return 'Érvénytelen API kulcs. Hozz létre újat a Resendben, cseréld le a Vercelen, majd Redeploy.';
		}
		if (/from/i.test(detail)) {
			return 'Hibás feladó. Helyes formátum: Kocsmakvízest <kviz@kocsmakvizest.hu>';
		}
		return 'Nézd meg a Resend „Logs” oldalát, ott részletesebben is látszik a hiba.';
	}
</script>

<svelte:head>
	<title>Beállítások — Kezelőfelület</title>
</svelte:head>

<Workspace
	label="Beállítások"
	railWidth="17rem"
	sideWidth="22rem"
	keys={[
		['↑ ↓', 'kategóriák'],
		['Tab', 'mezők'],
		['Esc', 'vissza']
	]}
>
	{#snippet rail()}
		<RailList
			label="Kategóriák"
			groups={[{ items: categories }]}
			getId={(c) => c.id}
			selectedId={current.id}
			onselect={(c) => selection.set(c.id)}
			onopen={() =>
				document.querySelector<HTMLElement>('.main-settings input, .main-settings select')?.focus()}
		>
			{#snippet item(c)}
				<span class="ws-item-text"><strong>{c.title}</strong><small>{c.sub}</small></span>
				{#if (c.id === 'legal' || c.id === 'public') && legalMissing}<span class="mark err">!</span>
				{:else if c.id === 'email' && emailMissing}<span class="mark warn">?</span>{/if}
			{/snippet}
		</RailList>
	{/snippet}

	{#snippet main()}
		<div class="ws-crumb">
			Beállítások › <b>{current.title}</b><span class="ws-saved">automatikus mentés</span>
		</div>
		<h1 class="ws-h1">{current.title}</h1>
		<div class="main-settings" data-tour="st-list">
			{#if current.id === 'appearance'}
				<div class="ws-card" data-tour="st-default-theme">
					<h2>Kvízestek alapértelmezett vizuális témája</h2>
					<p class="ws-note">
						A kivetítőn, a host és a csapatok felületén érvényes minden estén, amihez nem
						választottak külön témát (<a href={resolve('/admin/design-themes')}>Vizuális témák</a>).
						A kezelőfelület mindig a letisztult megjelenést használja.
					</p>
					{#if data.designThemes.length === 0}
						<p class="ws-note">Még nincs felvett vizuális téma.</p>
					{:else}
						<form
							bind:this={themeForm}
							method="POST"
							action="?/set_default_theme"
							class="theme-row"
							use:enhance={handleSetDefaultTheme}
						>
							{#each data.designThemes as theme (theme.id)}
								<label class="theme" class:on={selectedDefaultThemeId === theme.id}>
									<input
										type="radio"
										name="design_theme_id"
										value={theme.id}
										bind:group={selectedDefaultThemeId}
										onchange={() => themeForm?.requestSubmit()}
									/>
									{theme.title}
								</label>
							{/each}
						</form>
					{/if}
				</div>
			{:else if current.id === 'email'}
				<div class="ws-card">
					<h2>E-mail küldés (Resend)</h2>
					<p class="ws-note">
						A kulcsokat a Vercelen, környezeti változóként kell megadni; csak a következő deploy
						után lépnek életbe (Deployments → … → Redeploy).
					</p>
					<ul class="checks">
						<li>
							<span class="mark" class:ok={setup.email.apiKey}
								>{setup.email.apiKey ? '✓' : '✗'}</span
							><span
								><b>RESEND_API_KEY</b>: {setup.email.apiKey ? 'beállítva' : 'nincs beállítva'}</span
							>
						</li>
						<li>
							<span class="mark" class:ok={setup.email.from}>{setup.email.from ? '✓' : '✗'}</span
							><span><b>EMAIL_FROM</b>: {setup.email.from ?? 'nincs beállítva'}</span>
						</li>
						<li>
							<span class="mark" class:ok={setup.email.replyTo}
								>{setup.email.replyTo ? '✓' : '–'}</span
							><span
								><b>EMAIL_REPLY_TO</b> (nem kötelező): {setup.email.replyTo ??
									'nincs beállítva'}</span
							>
						</li>
					</ul>
					<form
						method="POST"
						action="?/test_email"
						use:enhance={() => {
							testingEmail = true;
							return async ({ update }) => {
								await refreshPage(update, { reset: false });
								testingEmail = false;
							};
						}}
					>
						<button type="submit" class="ws-btn" disabled={testingEmail}
							>{testingEmail ? 'Küldés…' : 'Teszt e-mail küldése magamnak'}</button
						>
					</form>
					{#if emailTest}
						<div class="test-result" class:ok={emailTest.status === 'sent'} role="status">
							{#if emailTest.status === 'sent'}
								Elküldve ide: <b>{'to' in emailTest ? emailTest.to : ''}</b>. Nézd meg a postafiókot
								(a spam mappát is).
							{:else if emailTest.status === 'skipped'}
								Nem ment ki: a RESEND_API_KEY vagy az EMAIL_FROM nincs beállítva ezen a deployon.
							{:else}
								<p>Hiba: <code>{'detail' in emailTest ? emailTest.detail : ''}</code></p>
								<p>{explainEmailError('detail' in emailTest ? emailTest.detail : '')}</p>
							{/if}
						</div>
					{/if}
				</div>
			{:else}
				{#each settingsOf(current.keys) as setting (setting.key)}
					{@const meta = SETTING_META[setting.key]}
					<div
						data-tour={setting.key === 'question_reuse_cooldown_months' ? 'st-cooldown' : undefined}
					>
						<SettingField
							settingKey={setting.key}
							value={setting.value}
							label={meta?.label ?? setting.key}
							description={meta?.description}
							unit={meta?.unit}
							presets={PRESETS[setting.key] ?? []}
						/>
					</div>
				{:else}
					<p class="ws-note">Ebben a kategóriában nincs beállítás.</p>
				{/each}
			{/if}
		</div>
	{/snippet}

	{#snippet side()}
		<p class="ws-cap">Élesítés állapota</p>
		<ul class="checks">
			<li>
				<span class="mark" class:ok={setup.siteUrl}>{setup.siteUrl ? '✓' : '✗'}</span><span
					><b>Nyilvános domain</b>: {setup.siteUrl ?? 'nincs beállítva'}</span
				>
			</li>
			<li>
				<span class="mark" class:ok={setup.appUrl && !appHostMismatch}
					>{setup.appUrl ? (appHostMismatch ? '!' : '✓') : '✗'}</span
				><span
					><b>App domain</b>: {setup.appUrl ?? 'nincs beállítva'}{appHostMismatch
						? ` — most: ${setup.currentHost}`
						: ''}</span
				>
			</li>
			<li>
				<span class="mark" class:ok={!emailMissing}>{emailMissing ? '✗' : '✓'}</span><span
					><b>E-mail küldés</b>: {emailMissing ? 'hiányzik' : 'beállítva'}
					<button type="button" class="link" onclick={() => selection.set('email')}>→</button></span
				>
			</li>
			<li>
				<span class="mark" class:ok={setup.serviceRole === 'ok'}
					>{setup.serviceRole === 'ok' ? '✓' : '✗'}</span
				><span
					><b>Supabase service-role kulcs</b>: {setup.serviceRole === 'ok'
						? 'működik'
						: setup.serviceRole === 'invalid'
							? 'hibás'
							: 'nincs beállítva'}</span
				>
			</li>
			<li>
				<span class="mark" class:ok={setup.imprint}>{setup.imprint ? '✓' : '✗'}</span><span
					><b>Impresszum</b>: {setup.imprint ? 'kitöltve' : 'hiányzik (kötelező)'}
					<button type="button" class="link" onclick={() => selection.set('legal')}>→</button></span
				>
			</li>
			<li>
				<span class="mark" class:ok={setup.operatorName && setup.contactEmail}
					>{setup.operatorName && setup.contactEmail ? '✓' : '✗'}</span
				><span
					><b>Üzemeltető és kapcsolati e-mail</b>: {setup.operatorName && setup.contactEmail
						? 'kitöltve'
						: 'hiányzik (kötelező)'}</span
				>
			</li>
		</ul>
		<p class="ws-note">
			Ez a panel minden kategória mellett látszik, így élesítés előtt egy pillantással kiderül, mi
			hiányzik.
		</p>
	{/snippet}
</Workspace>

<style>
	.main-settings {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.mark {
		width: 1.2rem;
		flex-shrink: 0;
		font-weight: 800;
		text-align: center;
		color: var(--danger);
	}

	.mark.ok {
		color: var(--power);
	}

	.mark.warn {
		color: var(--coin);
	}

	.mark.err {
		color: var(--danger);
	}

	.checks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		font-size: 0.88rem;
	}

	.checks li {
		display: flex;
		gap: 0.4rem;
		line-height: 1.4;
	}

	.link {
		border: 0;
		background: none;
		color: var(--cyan);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.theme-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.theme {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.8rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.6rem;
		cursor: pointer;
	}

	.theme.on {
		border: 2px solid var(--cyan);
		font-weight: 600;
	}

	.theme input {
		accent-color: var(--cyan);
	}

	.test-result {
		padding: 0.7rem 0.9rem;
		border-radius: 0.6rem;
		background: color-mix(in srgb, var(--danger) 10%, var(--cabinet-2));
		font-size: 0.88rem;
	}

	.test-result.ok {
		background: color-mix(in srgb, var(--power) 12%, var(--cabinet-2));
	}

	.test-result p {
		margin: 0.2rem 0;
	}
</style>
