<script lang="ts">
	import { registerPageTour } from '$lib/tours/state.svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Input from '$lib/components/Input.svelte';
	import Checkbox from '$lib/components/Checkbox.svelte';
	import Textarea from '$lib/components/Textarea.svelte';
	import Select from '$lib/components/Select.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedDefaultThemeId = $state(
		untrack(() => data.designThemes.find((t) => t.is_default)?.id ?? data.designThemes[0]?.id ?? '')
	);

	const handleSetDefaultTheme: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.success('Globális alapértelmezett design téma frissítve.');
			} else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült frissíteni a témát.');
			}
			await update();
		};
	};

	// Csak prezentációs "cukorka" ismert kulcsokhoz (barátságosabb címke +
	// mértékegység) — ha egy jövőbeli app_settings sor nincs itt felsorolva,
	// attól még megjelenik a listában, csak a nyers kulcsnevét mutatja.
	const SETTING_META: Record<string, { label: string; unit?: string; description?: string }> = {
		question_reuse_cooldown_months: {
			label: 'Kérdés-újrafelhasználási türelmi idő',
			unit: 'hónap',
			description: 'Ennyi hónapig nem húzható újra ugyanaz a kérdés a "Random húzás" funkcióval.'
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
		site_contact_email: {
			label: 'Kapcsolati e-mail',
			description:
				'Az adatkezelési tájékoztatóban és a nyilvános oldal láblécében jelenik meg. Kötelező kitölteni!'
		}
	};

	type ValueType = 'number' | 'boolean' | 'string' | 'json';

	function valueType(value: unknown): ValueType {
		if (typeof value === 'number') return 'number';
		if (typeof value === 'boolean') return 'boolean';
		if (typeof value === 'string') return 'string';
		return 'json';
	}

	const handleSave: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.success('Beállítás mentve.');
			} else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült a mentés.');
			}
			await update();
		};
	};

	registerPageTour(() => 'settings');

	// Élesítés állapota — a teszt e-mail eredménye és a Resend hibák magyarázata.
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

	const appHostMismatch = $derived(
		data.setup.appUrl !== null && new URL(data.setup.appUrl).host !== data.setup.currentHost
	);
</script>

<svelte:head>
	<title>Beállítások — Kezelőfelület</title>
</svelte:head>

<h1>Globális beállítások</h1>

{#if form && 'error' in form && form.error}
	<p class="error">{form.error}</p>
{/if}

<section class="setup" aria-labelledby="setup-title">
	<h2 id="setup-title">Élesítés állapota</h2>
	<p class="setting-description">
		A Vercelen beállított környezeti változók csak a következő deploy után lépnek életbe
		(Deployments → … → Redeploy).
	</p>
	<ul class="checks">
		<li class:ok={data.setup.siteUrl}>
			<span class="mark" aria-hidden="true">{data.setup.siteUrl ? '✓' : '✗'}</span>
			<span
				><b>Nyilvános domain</b> (<code>PUBLIC_SITE_URL</code>): {data.setup.siteUrl ??
					'nincs beállítva'}</span
			>
		</li>
		<li class:ok={data.setup.appUrl && !appHostMismatch} class:warn={appHostMismatch}>
			<span class="mark" aria-hidden="true"
				>{data.setup.appUrl ? (appHostMismatch ? '!' : '✓') : '✗'}</span
			>
			<span
				><b>App domain</b> (<code>PUBLIC_APP_URL</code>): {data.setup.appUrl ?? 'nincs beállítva'}
				{#if appHostMismatch}— most ezen a címen vagy: {data.setup.currentHost}{/if}</span
			>
		</li>
		<li class:ok={data.setup.email.apiKey}>
			<span class="mark" aria-hidden="true">{data.setup.email.apiKey ? '✓' : '✗'}</span>
			<span
				><b>Resend API kulcs</b> (<code>RESEND_API_KEY</code>): {data.setup.email.apiKey
					? 'beállítva'
					: 'nincs beállítva'}</span
			>
		</li>
		<li class:ok={data.setup.email.from}>
			<span class="mark" aria-hidden="true">{data.setup.email.from ? '✓' : '✗'}</span>
			<span
				><b>Feladó</b> (<code>EMAIL_FROM</code>): {data.setup.email.from ?? 'nincs beállítva'}</span
			>
		</li>
		<li class:ok={data.setup.email.replyTo} class:optional={!data.setup.email.replyTo}>
			<span class="mark" aria-hidden="true">{data.setup.email.replyTo ? '✓' : '–'}</span>
			<span
				><b>Válaszcím</b> (<code>EMAIL_REPLY_TO</code>, nem kötelező): {data.setup.email.replyTo ??
					'nincs beállítva'}</span
			>
		</li>
		<li class:ok={data.setup.serviceRole === 'ok'}>
			<span class="mark" aria-hidden="true">{data.setup.serviceRole === 'ok' ? '✓' : '✗'}</span>
			<span
				><b>Supabase service-role kulcs</b> (<code>SUPABASE_SERVICE_ROLE_KEY</code>): {data.setup
					.serviceRole === 'ok'
					? 'működik'
					: data.setup.serviceRole === 'invalid'
						? 'be van állítva, de hibás'
						: 'nincs beállítva'}</span
			>
		</li>
		<li class:ok={data.setup.operatorName && data.setup.contactEmail}>
			<span class="mark" aria-hidden="true"
				>{data.setup.operatorName && data.setup.contactEmail ? '✓' : '✗'}</span
			>
			<span
				><b>Üzemeltető neve és kapcsolati e-mail</b> (lent, ezen az oldalon): {data.setup
					.operatorName && data.setup.contactEmail
					? 'kitöltve'
					: 'hiányzik — az adatkezelési tájékoztatóhoz kötelező'}</span
			>
		</li>
	</ul>

	<form
		method="POST"
		action="?/test_email"
		class="test-email"
		use:enhance={() => {
			testingEmail = true;
			return async ({ update }) => {
				await update({ reset: false });
				testingEmail = false;
			};
		}}
	>
		<Button type="submit" variant="secondary" loading={testingEmail}
			>Teszt e-mail küldése magamnak</Button
		>
	</form>
	{#if emailTest}
		<div class="test-result" class:ok={emailTest.status === 'sent'} role="status">
			{#if emailTest.status === 'sent'}
				Elküldve ide: <b>{'to' in emailTest ? emailTest.to : ''}</b>. Nézd meg a postafiókot (a spam
				mappát is).
			{:else if emailTest.status === 'skipped'}
				Nem ment ki: a <code>RESEND_API_KEY</code> vagy az <code>EMAIL_FROM</code> nincs beállítva ezen
				a deployon.
			{:else}
				<p>Hiba: <code>{'detail' in emailTest ? emailTest.detail : ''}</code></p>
				<p>{explainEmailError('detail' in emailTest ? emailTest.detail : '')}</p>
			{/if}
		</div>
	{/if}
</section>

<section class="setting-row" data-tour="st-default-theme">
	<div class="setting-info">
		<span class="setting-label">Kvízestek alapértelmezett design témája</span>
		<p class="setting-description">
			A kivetítőn, a host és a csapatok felületén érvényes minden olyan kvízestén, amihez nem
			választottak külön témát (<a href={resolve('/admin/design-themes')}>Vizuális témák</a>). A
			kezelőfelület mindig a letisztult megjelenést használja. A választás azonnal, oldal-újratöltés
			nélkül alkalmazódik minden érintett nyitott felületen.
		</p>
	</div>
	{#if data.designThemes.length === 0}
		<p class="empty">Még nincs felvett design téma.</p>
	{:else}
		<form
			method="POST"
			action="?/set_default_theme"
			use:enhance={handleSetDefaultTheme}
			class="setting-form"
		>
			<Select name="design_theme_id" bind:value={selectedDefaultThemeId}>
				{#each data.designThemes as theme (theme.id)}
					<option value={theme.id}>{theme.title}{theme.is_default ? ' (jelenlegi)' : ''}</option>
				{/each}
			</Select>
			<Button type="submit">Beállítás alapértelmezettként</Button>
		</form>
	{/if}
</section>

<div class="settings-list" data-tour="st-list">
	{#each data.settings as setting (setting.key)}
		{@const meta = SETTING_META[setting.key]}
		{@const type = valueType(setting.value)}
		<div
			class="setting-row"
			data-tour={setting.key === 'question_reuse_cooldown_months' ? 'st-cooldown' : undefined}
		>
			<div class="setting-info">
				<span class="setting-label">{meta?.label ?? setting.key}</span>
				<code class="setting-key">{setting.key}</code>
				{#if meta?.description}
					<p class="setting-description">{meta.description}</p>
				{/if}
			</div>
			<form method="POST" action="?/update" use:enhance={handleSave} class="setting-form">
				<input type="hidden" name="key" value={setting.key} />
				<input type="hidden" name="value_type" value={type} />

				{#if type === 'number'}
					<div class="value-input">
						<Input type="number" name="value" value={String(setting.value)} required />
						{#if meta?.unit}<span class="unit">{meta.unit}</span>{/if}
					</div>
				{:else if type === 'boolean'}
					<Checkbox
						name="value"
						value="true"
						checked={Boolean(setting.value)}
						label="Bekapcsolva"
					/>
				{:else if type === 'string'}
					<Input type="text" name="value" value={String(setting.value)} />
				{:else}
					<Textarea
						name="value"
						value={JSON.stringify(setting.value, null, 2)}
						monospace
						rows={4}
					/>
				{/if}

				<Button type="submit">Mentés</Button>
			</form>
		</div>
	{:else}
		<p class="empty">Nincs beállítás az app_settings táblában.</p>
	{/each}
</div>

<style>
	.setup {
		margin: 1rem 0 2rem;
		padding: 1.25rem 1.4rem;
		background: var(--cabinet-2);
		border: 1px solid var(--panel-border, var(--cabinet-3));
		border-radius: 0.75rem;
	}

	.setup h2 {
		margin: 0 0 0.25rem;
		font-size: 1.1rem;
	}

	.checks {
		margin: 1rem 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.checks li {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		color: var(--marquee);
		overflow-wrap: anywhere;
	}

	.mark {
		width: 1.25rem;
		flex-shrink: 0;
		text-align: center;
		font-weight: 700;
		color: var(--danger);
	}

	.checks li.ok .mark {
		color: var(--power);
	}

	.checks li.warn .mark,
	.checks li.optional .mark {
		color: var(--coin);
	}

	.test-result {
		margin-top: 0.75rem;
		padding: 0.8rem 1rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--danger) 10%, var(--cabinet-2));
		color: var(--marquee);
		overflow-wrap: anywhere;
	}

	.test-result.ok {
		background: color-mix(in srgb, var(--power) 12%, var(--cabinet-2));
	}

	.test-result p {
		margin: 0.2rem 0;
	}

	h1 {
		font-family: var(--font-display);
		font-size: 2.1rem;
		font-weight: 400;
		color: var(--marquee);
	}

	.settings-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
	}

	.setting-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		justify-content: space-between;
		align-items: flex-start;
		background: var(--cabinet-2);
		border: 2px solid var(--cabinet-3);
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-width: 28rem;
	}

	.setting-label {
		font-weight: 600;
		color: var(--marquee);
	}

	.setting-key {
		font-family: var(--font-led);
		font-size: 0.75rem;
		color: var(--marquee-dim);
	}

	.setting-description {
		color: var(--marquee-dim);
		font-size: 0.85rem;
		margin: 0;
	}

	.setting-form {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.value-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.unit {
		color: var(--marquee-dim);
		font-size: 0.9rem;
	}

	.error {
		color: var(--danger);
	}

	.empty {
		color: var(--marquee-dim);
	}
</style>
