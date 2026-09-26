<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import { withToast } from '$lib/toast-enhance';
	import { registerPageTour } from '$lib/tours/state.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	registerPageTour(() => 'venues');

	let creating = $state(false);
	let editingId = $state<string | null>(null);
	let savingId = $state<string | null>(null);
	let formKey = $state(0);
</script>

<svelte:head>
	<title>Helyszínek — Kezelőfelület</title>
</svelte:head>

<h1>Helyszínek</h1>
<p class="intro">
	A kvízesték helyszínei. A nyilvános oldalon a név, a cím és a térkép-link jelenik meg.
</p>

<div class="layout">
	<section aria-labelledby="list-title">
		<h2 id="list-title" class="sr-only">Helyszínek listája</h2>
		{#if data.venues.length === 0}
			<p class="empty">Még nincs helyszín. Vedd fel az elsőt a jobb oldali űrlappal.</p>
		{:else}
			<ul class="venues" data-tour="venues-list">
				{#each data.venues as venue (venue.id)}
					<li class="venue">
						{#if editingId === venue.id}
							<form
								method="POST"
								action="?/update"
								class="edit"
								use:enhance={withToast({
									successMessage: 'Helyszín mentve.',
									setSubmitting: (v) => (savingId = v ? venue.id : null),
									onSuccess: () => (editingId = null)
								})}
							>
								<input type="hidden" name="id" value={venue.id} />
								<Input label="Név" name="name" value={venue.name} required maxlength={80} />
								<div class="two">
									<Input label="Cím" name="address" value={venue.address ?? ''} maxlength={160} />
									<Input label="Város" name="city" value={venue.city ?? ''} maxlength={80} />
								</div>
								<Input
									label="Térkép-link (nem kötelező)"
									name="maps_url"
									type="url"
									value={venue.maps_url ?? ''}
								/>
								<div class="row-actions">
									<Button type="submit" loading={savingId === venue.id}>Mentés</Button>
									<Button variant="ghost" onclick={() => (editingId = null)}>Mégse</Button>
								</div>
							</form>
						{:else}
							<div class="info">
								<strong>{venue.name}</strong>
								<span class="muted"
									>{[venue.address, venue.city].filter(Boolean).join(', ') ||
										'Nincs cím megadva'}</span
								>
								<span class="muted small"
									>{venue.gameCount} kvízeste{venue.maps_url ? ' · van térkép-link' : ''}</span
								>
							</div>
							<div class="row-actions">
								<Button variant="secondary" onclick={() => (editingId = venue.id)}
									>Szerkesztés</Button
								>
								<form
									method="POST"
									action="?/delete"
									use:enhance={(input) => {
										if (
											!confirm(
												venue.gameCount
													? `A(z) „${venue.name}” helyszínhez ${venue.gameCount} kvízeste tartozik; ezeknél a helyszín üres lesz. Törlöd?`
													: `Törlöd a(z) „${venue.name}” helyszínt?`
											)
										) {
											input.cancel();
											return;
										}
										return withToast({ successMessage: 'Helyszín törölve.' })(input);
									}}
								>
									<input type="hidden" name="id" value={venue.id} />
									<Button type="submit" variant="ghost">Törlés</Button>
								</form>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<aside>
		{#key formKey}
			<form
				method="POST"
				action="?/create"
				class="card"
				data-tour="venues-create"
				use:enhance={withToast({
					successMessage: 'Helyszín hozzáadva.',
					setSubmitting: (v) => (creating = v),
					onSuccess: () => formKey++
				})}
			>
				<h2>Új helyszín</h2>
				<Input label="Név" name="name" required maxlength={80} placeholder="pl. Kocsma neve" />
				<Input label="Cím" name="address" maxlength={160} placeholder="utca, házszám" />
				<Input label="Város" name="city" maxlength={80} />
				<Input
					label="Térkép-link (nem kötelező)"
					name="maps_url"
					type="url"
					placeholder="https://maps.google.com/…"
				/>
				<Button type="submit" loading={creating}>Hozzáadás</Button>
			</form>
		{/key}
	</aside>
</div>

<style>
	h1 {
		margin: 0.5rem 0 0.25rem;
		font-family: var(--font-display);
		font-size: 2.1rem;
		font-weight: 400;
	}

	.intro {
		margin: 0 0 1.5rem;
		color: var(--marquee-dim);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 20rem;
		gap: 1.75rem;
		align-items: start;
	}

	.venues {
		margin: 0;
		padding: 0;
		list-style: none;
		background: var(--cabinet-2);
		border: 1px solid var(--panel-border, var(--cabinet-3));
		border-radius: 0.75rem;
	}

	.venue {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.2rem;
		border-bottom: 1px solid var(--panel-border, var(--cabinet-3));
	}

	.venue:last-child {
		border-bottom: 0;
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.muted {
		color: var(--marquee-dim);
	}

	.small {
		font-size: 0.85rem;
	}

	.row-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.edit {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.two {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.4rem;
		background: var(--cabinet-2);
		border: 1px solid var(--panel-border, var(--cabinet-3));
		border-radius: 0.75rem;
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.empty {
		padding: 1.5rem;
		border: 1px dashed var(--field-border, var(--marquee-dim));
		border-radius: 0.75rem;
		color: var(--marquee-dim);
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
		}
	}
</style>
