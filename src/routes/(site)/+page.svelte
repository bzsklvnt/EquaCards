<script lang="ts">
	import { resolve } from '$app/paths';
	import { describeCapacity } from '$lib/capacity';
	import { eventDateParts } from '$lib/datetime';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const upcoming = $derived(
		data.upcoming.map((e) => ({
			...e,
			date: eventDateParts(e.scheduled_at),
			capacity: describeCapacity(e)
		}))
	);

	function shortDate(iso: string): string {
		return new Date(iso).toLocaleDateString('hu-HU', {
			timeZone: 'Europe/Budapest',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{data.site.name} — csapatos kvízestek</title>
	<meta
		name="description"
		content="Csapatos kvízestek változó témákkal. Nézd meg a közelgő estéket, és jelentkezzetek csapatként."
	/>
</svelte:head>

<section class="hero">
	<p class="eyebrow">Csapatos kvízestek{data.site.city ? ` · ${data.site.city}` : ''}</p>
	<h1>Egy este, pár jó barát és egy csomó kérdés, amin együtt törhetitek a fejeteket.</h1>
	<p class="lead">
		Rendszeresen tartunk kvízesteket, mindig más témákkal. Nem kell semmit letölteni: a
		telefonotokon válaszoltok, az eredmény a kivetítőn jelenik meg. Jelentkezzetek csapatként — a
		helyeket a jelentkezés sorrendjében osztjuk ki.
	</p>
	<ul class="facts" id="hogyan">
		<li>Csapatonként 1–12 fő</li>
		<li>Telefonnal játszható</li>
		<li>Telt háznál várólista</li>
	</ul>
</section>

<section class="events" id="esemenyek" aria-labelledby="upcoming-title">
	<div class="section-head">
		<h2 id="upcoming-title">Közelgő esték</h2>
		{#if upcoming.length}<span>{upcoming.length} esemény</span>{/if}
	</div>

	{#if upcoming.length === 0}
		<p class="empty">Jelenleg nincs meghirdetett este — nézz vissza hamarosan!</p>
	{:else}
		<ul class="event-list">
			{#each upcoming as event (event.id)}
				<li class="event-card">
					<div class="date" aria-hidden="true">
						<span class="month">{event.date.month}</span>
						<span class="day">{event.date.day}</span>
						<span class="weekday">{event.date.weekday}</span>
					</div>
					<div class="info">
						<h3>
							<a href={resolve(`/esemeny/${event.id}`)}>{event.title}</a>
						</h3>
						<p class="meta">
							<span class="sr-only"
								>{event.date.weekday}, {event.date.month} {event.date.day}.,</span
							>
							<span>{event.date.time}</span>
							{#if event.venue_name}
								<span>{event.venue_name}{event.venue_city ? `, ${event.venue_city}` : ''}</span>
							{/if}
						</p>
					</div>
					<div class="capacity tone-{event.capacity.tone}">
						<span class="headline">{event.capacity.headline}</span>
						{#if event.capacity.tone === 'full'}
							<span class="detail">{event.capacity.detail}</span>
						{:else if event.max_players}
							<span class="bar" aria-hidden="true"
								><span style="width: {event.capacity.percent}%"></span></span
							>
						{:else}
							<span class="detail">{event.capacity.detail}</span>
						{/if}
					</div>
					<a
						class="cta"
						class:secondary={event.capacity.tone === 'full'}
						href={resolve(`/esemeny/${event.id}`)}
						aria-label={`${event.capacity.tone === 'full' ? 'Várólistára jelentkezés' : 'Jelentkezés'}: ${event.title}`}
					>
						{event.capacity.tone === 'full' ? 'Várólistára' : 'Jelentkezés'}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if data.past.length}
	<section class="past" aria-labelledby="past-title">
		<h2 id="past-title">Elmúlt esték</h2>
		<ul>
			{#each data.past as event (event.id)}
				<li>
					<span class="when">{shortDate(event.scheduled_at)}</span>
					<span class="what">{event.title}{event.venue_name ? ` · ${event.venue_name}` : ''}</span>
					<span class="winner">{event.winner_name ? `Győztes: ${event.winner_name}` : ''}</span>
					<span class="count">
						{event.team_count ? `${event.team_count} csapat · ` : ''}lezárult
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.hero {
		padding: 5.5rem 0 4.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.4rem;
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
		max-width: 54rem;
		font-family: var(--serif);
		font-size: clamp(2.2rem, 5.4vw, 4rem);
		line-height: 1.07;
		font-weight: 400;
		letter-spacing: -0.02em;
	}

	.lead {
		margin: 0;
		max-width: 40rem;
		font-size: clamp(1.05rem, 1.6vw, 1.25rem);
		line-height: 1.55;
		color: var(--ink-2);
	}

	.facts {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.75rem;
		font-size: 0.95rem;
		color: var(--muted);
	}

	.section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 1.25rem;
		color: var(--muted);
	}

	h2 {
		margin: 0;
		font-family: var(--serif);
		font-size: clamp(1.75rem, 3vw, 2.25rem);
		font-weight: 400;
		color: var(--ink);
	}

	.empty {
		margin: 0;
		padding: 2rem;
		background: var(--surface);
		border: 1px dashed var(--field);
		border-radius: 1rem;
		color: var(--muted);
	}

	.event-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.event-card {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr) 11rem auto;
		align-items: center;
		gap: 2rem;
		padding: 1.6rem 2rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 1rem;
	}

	.date {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
	}

	.month {
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--accent);
	}

	.day {
		font-family: var(--serif);
		font-size: 2.75rem;
		line-height: 1;
	}

	.weekday {
		font-size: 0.85rem;
		color: var(--muted);
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	h3 {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 600;
	}

	h3 a {
		color: var(--ink) !important;
		text-decoration: none;
	}

	h3 a:hover {
		text-decoration: underline;
	}

	.meta {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.25rem;
		font-size: 0.95rem;
		color: var(--muted);
	}

	.capacity {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.95rem;
	}

	.capacity .headline {
		font-weight: 600;
	}

	.capacity .detail {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.tone-low .headline {
		color: var(--warn);
	}

	.bar {
		display: block;
		height: 6px;
		background: var(--track);
		border-radius: 3px;
		overflow: hidden;
	}

	.bar span {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: 3px;
	}

	.tone-low .bar span {
		background: var(--warn-bar);
	}

	.cta {
		min-width: 10.5rem;
		min-height: 3rem;
		padding: 0 1.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1.5px solid var(--accent);
		border-radius: 0.65rem;
		background: var(--accent);
		color: #ffffff !important;
		font-weight: 600;
		text-decoration: none;
	}

	.cta:hover {
		background: var(--accent-dark);
		border-color: var(--accent-dark);
	}

	.cta.secondary {
		background: var(--surface);
		color: var(--accent) !important;
	}

	.cta.secondary:hover {
		background: var(--accent-soft);
	}

	.past {
		margin-top: 4.5rem;
	}

	.past h2 {
		font-size: 1.75rem;
		color: var(--muted);
		margin-bottom: 1rem;
	}

	.past ul {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--line);
	}

	.past li {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr) 14rem 11rem;
		gap: 1.5rem;
		align-items: center;
		padding: 1.1rem 0.25rem;
		border-bottom: 1px solid var(--line);
		font-size: 0.95rem;
		color: var(--faint);
	}

	.past .what {
		color: var(--ink-2);
	}

	.past .count {
		text-align: right;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	@media (max-width: 860px) {
		.hero {
			padding: 2.75rem 0 2.5rem;
		}

		.event-card {
			grid-template-columns: 3.5rem minmax(0, 1fr);
			gap: 1rem 1.1rem;
			padding: 1.25rem;
		}

		.day {
			font-size: 2rem;
		}

		.weekday {
			display: none;
		}

		.capacity,
		.cta {
			grid-column: 1 / -1;
		}

		.past li {
			grid-template-columns: 1fr;
			gap: 0.2rem;
		}

		.past .count {
			text-align: left;
		}
	}
</style>
