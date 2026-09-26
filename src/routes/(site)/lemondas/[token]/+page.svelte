<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { formatEventDate } from '$lib/datetime';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const reg = $derived(data.registration);
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Jelentkezés lemondása — {data.site.name}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="card">
	{#if form && 'cancelled' in form && form.cancelled}
		<h1>Lemondtátok a jelentkezést</h1>
		<p>
			Köszönjük, hogy szóltatok! A helyeteket a várólistán következő csapat kapja meg. Reméljük, egy
			másik estén találkozunk.
		</p>
		<a class="button secondary" href={resolve('/')}>Közelgő esték</a>
	{:else if !reg}
		<h1>Érvénytelen link</h1>
		<p>
			Ez a lemondási link nem érvényes. Ellenőrizd, hogy a teljes linket nyitottad-e meg a levélből.
		</p>
		<a class="button secondary" href={resolve('/')}>Közelgő esték</a>
	{:else}
		<h1>Jelentkezés lemondása</h1>
		<dl>
			<div>
				<dt>Csapat</dt>
				<dd>{reg.team_name}</dd>
			</div>
			<div>
				<dt>Este</dt>
				<dd>
					{reg.game_title}{reg.scheduled_at
						? ` · ${formatEventDate(reg.scheduled_at)}`
						: ''}{reg.venue_name ? ` · ${reg.venue_name}` : ''}
				</dd>
			</div>
			<div>
				<dt>Állapot</dt>
				<dd>
					{reg.status === 'waitlist'
						? 'Várólistán'
						: reg.status === 'cancelled'
							? 'Lemondva'
							: 'Megerősítve'}
				</dd>
			</div>
		</dl>

		{#if form && 'message' in form && form.message}
			<p class="error" role="alert">{form.message}</p>
		{/if}

		{#if reg.status === 'cancelled'}
			<p>Ezt a jelentkezést már lemondtátok.</p>
		{:else if !reg.can_cancel}
			<p>Az este már elkezdődött, a jelentkezés itt nem mondható le.</p>
		{:else}
			<p>Biztosan lemondjátok? Ezt nem lehet visszavonni — újra jelentkezni viszont lehet.</p>
			<form
				method="POST"
				action="?/cancel"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				<button type="submit" disabled={submitting}>
					{submitting ? 'Lemondás…' : 'Igen, lemondjuk'}
				</button>
			</form>
		{/if}
	{/if}
</section>

<style>
	.card {
		max-width: 34rem;
		margin: 4rem auto 0;
		padding: 2.25rem;
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 1.1rem;
	}

	h1 {
		margin: 0;
		font-family: var(--serif);
		font-size: 2rem;
		font-weight: 400;
	}

	p {
		margin: 0;
		line-height: 1.55;
		color: var(--ink-2);
	}

	dl {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1rem 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}

	dl div {
		display: grid;
		grid-template-columns: 6rem minmax(0, 1fr);
		gap: 1rem;
	}

	dt {
		color: var(--muted);
	}

	dd {
		margin: 0;
		font-weight: 500;
	}

	button,
	.button {
		min-height: 3rem;
		padding: 0 1.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1.5px solid var(--danger);
		border-radius: 0.65rem;
		background: var(--danger);
		color: #ffffff;
		font: inherit;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.7;
	}

	.button.secondary {
		align-self: flex-start;
		border-color: var(--accent);
		background: var(--surface);
		color: var(--accent);
	}

	.error {
		padding: 0.8rem 1rem;
		background: #fbeceb;
		border-radius: 0.6rem;
		color: var(--danger);
	}

	@media (max-width: 520px) {
		.card {
			margin-top: 2rem;
			padding: 1.5rem;
		}
	}
</style>
