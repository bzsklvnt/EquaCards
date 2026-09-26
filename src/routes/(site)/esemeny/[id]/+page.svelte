<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { describeCapacity } from '$lib/capacity';
	import { formatEventDate } from '$lib/datetime';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const event = $derived(data.event);
	const capacity = $derived(describeCapacity(event));
	const isFull = $derived(capacity.tone === 'full');
	const values = $derived(form && 'values' in form ? form.values : undefined);
	const mapsHref = $derived(
		event.venue_maps_url ||
			(event.venue_address
				? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
						[event.venue_name, event.venue_address, event.venue_city].filter(Boolean).join(', ')
					)}`
				: null)
	);

	let submitting = $state(false);
</script>

<svelte:head>
	<title>{event.title} — {data.site.name}</title>
	<meta
		name="description"
		content={`${event.title} · ${formatEventDate(event.scheduled_at)}${event.venue_name ? ` · ${event.venue_name}` : ''}`}
	/>
</svelte:head>

<p class="back"><a href={resolve('/')}>← Összes este</a></p>

<div class="layout">
	<article class="about">
		<p class="eyebrow">{formatEventDate(event.scheduled_at)}</p>
		<h1>{event.title}</h1>
		{#if event.public_note}
			<p class="note">{event.public_note}</p>
		{/if}

		<dl class="facts">
			{#if event.venue_name}
				<div class="fact">
					<svg viewBox="0 0 24 24" aria-hidden="true"
						><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"></path><circle
							cx="12"
							cy="9.5"
							r="2.5"
						></circle></svg
					>
					<div>
						<dt class="sr-only">Helyszín</dt>
						<dd>
							<strong>{event.venue_name}</strong>
							{#if event.venue_address || event.venue_city}
								<span>{[event.venue_address, event.venue_city].filter(Boolean).join(', ')}</span>
							{/if}
							{#if mapsHref}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- külső térkép -->
								<a href={mapsHref} target="_blank" rel="noopener noreferrer">Megnyitás térképen</a>
							{/if}
						</dd>
					</div>
				</div>
			{/if}
			{#if !event.is_past}
				<div class="fact">
					<svg viewBox="0 0 24 24" aria-hidden="true"
						><circle cx="9" cy="8" r="3.2"></circle><path
							d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"
						></path><circle cx="17" cy="9" r="2.4"></circle><path d="M16 14.2c2.3.1 4 1.6 4.5 4.3"
						></path></svg
					>
					<div class="grow">
						<dt class="sr-only">Létszám</dt>
						<dd>
							<strong class:warn={capacity.tone === 'low'}>{capacity.headline}</strong>
							<span>
								{#if capacity.tone === 'low'}
									{event.confirmed_players} / {event.max_players} fő · {capacity.detail}
								{:else if capacity.tone === 'open'}
									{capacity.detail} jelentkezett
								{:else}
									{capacity.detail}
								{/if}
							</span>
							{#if event.max_players && !isFull}
								<span class="bar" class:low={capacity.tone === 'low'} aria-hidden="true"
									><span style="width: {capacity.percent}%"></span></span
								>
							{/if}
						</dd>
					</div>
				</div>
			{/if}
		</dl>

		<div class="how">
			<h2>Hogyan zajlik?</h2>
			<p>
				Érkezéskor a kivetítőn megjelenő kóddal csatlakoztok egy telefonról, és azon adjátok meg a
				válaszokat. Az este több körből áll, a körök végén kiderül, ki áll az élen.
			</p>
			<p>
				A létszámkorlát főben értendő. Ha a csapatotok már nem fér be, várólistára kerültök, és
				e-mailt küldünk, amint felszabadul elég hely.
			</p>
		</div>
	</article>

	<aside class="panel">
		{#if form && 'success' in form && form.success}
			<div class="result" role="status">
				{#if form.status === 'waitlist'}
					<h2>Várólistára kerültetek</h2>
					<p>
						{form.teamName ? `A(z) „${form.teamName}” csapat` : 'A csapatotok'} a várólista
						{form.waitlistPosition ? `${form.waitlistPosition}.` : ''} helyén áll. Ha felszabadul elég
						hely, automatikusan bekerültök, és erről e-mailt kaptok.
					</p>
				{:else}
					<h2>Köszönjük, várunk titeket!</h2>
					<p>
						{form.teamName ? `A(z) „${form.teamName}” csapat` : 'A csapatotok'} jelentkezését rögzítettük.
					</p>
				{/if}
				<p class="small">
					A visszaigazolást e-mailben küldjük, benne a lemondási linkkel — ha nem érkezne meg, nézd
					meg a spam mappát is.
				</p>
				<a class="button secondary" href={resolve('/')}>Vissza az estékhez</a>
			</div>
		{:else if event.registration_open}
			<form
				method="POST"
				action="?/register"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update({ reset: false });
						submitting = false;
					};
				}}
			>
				<h2>{isFull ? 'Jelentkezés várólistára' : 'Csapat jelentkezése'}</h2>
				{#if isFull}
					<p class="notice">
						Az este betelt. Ha jelentkeztek, várólistára kerültök, és szólunk, ha felszabadul hely.
					</p>
				{:else if capacity.remaining !== null}
					<p class="hint">Még {capacity.remaining} szabad hely (fő) van erre az estére.</p>
				{/if}

				{#if form && 'message' in form && form.message}
					<p class="error" role="alert">{form.message}</p>
				{/if}

				<label>
					Csapatnév
					<input
						name="team_name"
						required
						maxlength="40"
						autocomplete="off"
						value={values?.teamName ?? ''}
					/>
				</label>

				<div class="row">
					<label>
						Létszám (fő)
						<input
							name="headcount"
							type="number"
							inputmode="numeric"
							min="1"
							max="12"
							required
							value={values?.headcount ?? ''}
						/>
					</label>
					<label>
						Kapcsolattartó neve
						<input
							name="contact_name"
							required
							maxlength="80"
							autocomplete="name"
							value={values?.contactName ?? ''}
						/>
					</label>
				</div>

				<label>
					E-mail cím
					<input
						name="contact_email"
						type="email"
						required
						maxlength="254"
						autocomplete="email"
						placeholder="ide küldjük a visszaigazolást"
						value={values?.contactEmail ?? ''}
					/>
				</label>

				<label>
					<span>Telefon <span class="optional">(nem kötelező)</span></span>
					<input
						name="contact_phone"
						type="tel"
						maxlength="30"
						autocomplete="tel"
						value={values?.contactPhone ?? ''}
					/>
				</label>

				<label>
					<span>Megjegyzés <span class="optional">(nem kötelező)</span></span>
					<textarea name="note" rows="2" maxlength="500">{values?.note ?? ''}</textarea>
				</label>

				<div class="trap" aria-hidden="true">
					<label>Weboldal <input name="website" tabindex="-1" autocomplete="off" /></label>
				</div>

				<label class="consent">
					<input type="checkbox" name="consent" required />
					<span>
						Elfogadom az <a href={resolve('/adatkezeles')} target="_blank"
							>adatkezelési tájékoztatót</a
						>. Az adatokat csak az este szervezéséhez használjuk.
					</span>
				</label>

				<button type="submit" disabled={submitting}>
					{submitting ? 'Küldés…' : isFull ? 'Jelentkezés várólistára' : 'Csapat regisztrálása'}
				</button>
				<p class="small center">A visszaigazolást e-mailben küldjük, benne a lemondási linkkel.</p>
			</form>
		{:else}
			<div class="result">
				{#if event.is_past}
					<h2>Ez az este már lezajlott</h2>
					{#if event.winner_name}
						<p>Győztes: <strong>{event.winner_name}</strong></p>
					{/if}
				{:else}
					<h2>A jelentkezés lezárult</h2>
				{/if}
				<a class="button secondary" href={resolve('/')}>Közelgő esték</a>
			</div>
		{/if}
	</aside>
</div>

<style>
	.back {
		margin: 2rem 0 0;
		font-size: 0.95rem;
	}

	.back a {
		text-decoration: none;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 30rem);
		gap: 4.5rem;
		align-items: start;
		padding-top: 2.5rem;
	}

	.about {
		display: flex;
		flex-direction: column;
		gap: 1.6rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
	}

	h1 {
		margin: 0;
		font-family: var(--serif);
		font-size: clamp(2.2rem, 4.5vw, 3.25rem);
		line-height: 1.08;
		font-weight: 400;
		letter-spacing: -0.015em;
	}

	.note {
		margin: 0;
		font-size: 1.1rem;
		line-height: 1.6;
		color: var(--ink-2);
		white-space: pre-line;
	}

	.facts {
		margin: 0;
		padding: 1.5rem 0;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}

	.fact {
		display: flex;
		gap: 0.9rem;
		align-items: flex-start;
	}

	.fact svg {
		width: 1.4rem;
		height: 1.4rem;
		flex-shrink: 0;
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.fact dd {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 1rem;
	}

	.fact dd span {
		color: var(--muted);
	}

	.grow {
		flex: 1;
	}

	strong.warn {
		color: var(--warn);
	}

	.bar {
		display: block;
		height: 6px;
		margin-top: 0.3rem;
		background: var(--track);
		border-radius: 3px;
		overflow: hidden;
	}

	.bar span {
		display: block;
		height: 100%;
		background: var(--accent);
	}

	.bar.low span {
		background: var(--warn-bar);
	}

	.how h2 {
		margin: 0 0 0.5rem;
		font-family: var(--sans);
		font-size: 1rem;
		font-weight: 600;
	}

	.how p {
		margin: 0 0 0.6rem;
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--muted);
	}

	.panel form,
	.result {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 2.25rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 1.1rem;
	}

	.panel h2 {
		margin: 0;
		font-family: var(--serif);
		font-size: 1.75rem;
		font-weight: 400;
	}

	.result p {
		margin: 0;
		line-height: 1.55;
		color: var(--ink-2);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		font-size: 0.95rem;
		font-weight: 500;
	}

	.optional {
		font-weight: 400;
		color: var(--muted);
	}

	input:not([type='checkbox']),
	textarea {
		min-height: 3rem;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--field);
		border-radius: 0.6rem;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 400;
	}

	textarea {
		resize: vertical;
	}

	input:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 0;
		border-color: var(--accent);
	}

	.row {
		display: grid;
		grid-template-columns: 8rem minmax(0, 1fr);
		gap: 1rem;
	}

	.consent {
		flex-direction: row;
		align-items: flex-start;
		gap: 0.75rem;
		font-size: 0.9rem;
		font-weight: 400;
		line-height: 1.5;
		color: var(--ink-2);
	}

	.consent input {
		width: 1.25rem;
		height: 1.25rem;
		margin: 0.1rem 0 0;
		flex-shrink: 0;
		accent-color: var(--accent);
	}

	.trap {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}

	button,
	.button {
		min-height: 3.25rem;
		padding: 0 1.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1.5px solid var(--accent);
		border-radius: 0.65rem;
		background: var(--accent);
		color: #ffffff !important;
		font: inherit;
		font-size: 1.05rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}

	button:hover:not(:disabled) {
		background: var(--accent-dark);
	}

	button:disabled {
		opacity: 0.7;
		cursor: progress;
	}

	.button.secondary {
		background: var(--surface);
		color: var(--accent) !important;
	}

	.notice {
		margin: 0;
		padding: 0.8rem 1rem;
		background: var(--warn-soft);
		border-radius: 0.6rem;
		color: var(--warn);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.hint {
		margin: 0;
		font-size: 0.95rem;
		color: var(--muted);
	}

	.error {
		margin: 0;
		padding: 0.8rem 1rem;
		background: #fbeceb;
		border-radius: 0.6rem;
		color: var(--danger);
		font-size: 0.95rem;
	}

	.small {
		font-size: 0.875rem !important;
		line-height: 1.5;
		color: var(--muted) !important;
	}

	.center {
		margin: 0;
		text-align: center;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
			gap: 2.5rem;
			padding-top: 1.5rem;
		}

		.panel form,
		.result {
			padding: 1.5rem;
		}
	}

	@media (max-width: 420px) {
		.row {
			grid-template-columns: 1fr;
		}
	}
</style>
