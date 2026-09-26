<script lang="ts">
	import { suit, type Draft } from './model';

	// Kivetítő-előnézet a kvízösszerakóban (P): a kérdés a válaszidő
	// fázisában, ahogy a TV-n megjelenik — a helyes válasz NINCS jelölve.
	let {
		draft,
		roundTitle,
		position,
		total,
		readingSeconds
	}: {
		draft: Draft;
		roundTitle: string;
		position: number;
		total: number;
		readingSeconds: number;
	} = $props();

	const choices = $derived(
		draft.type_code === 'single_choice' ||
			draft.type_code === 'multi_choice' ||
			draft.type_code === 'true_false'
	);
</script>

<div class="stage">
	<div class="meta">
		<span>{roundTitle}</span>
		<span>{position} / {total}</span>
	</div>
	<p class="prompt">{draft.prompt || '— üres kérdés —'}</p>
	{#if draft.image_url}
		<img src={draft.image_url} alt="" class:pixel={draft.image_pixelate} />
	{/if}
	{#if choices}
		<div class="tiles" class:many={draft.options.length > 4}>
			{#each draft.options as option, i (i)}
				{@const s = suit(i)}
				<div class="tile" style="--suit: {s.color}">
					<span class="suit">{s.label}</span>
					<span>{option.text || '…'}</span>
				</div>
			{/each}
		</div>
	{:else if draft.type_code === 'slider'}
		<div class="slider">
			<span>{draft.slider.min_value}</span>
			<div class="bar"></div>
			<span>{draft.slider.max_value}</span>
		</div>
	{:else if draft.type_code === 'ordering'}
		<ol class="order">
			{#each draft.ordering as item, i (i)}
				<li style="--suit: {suit(i).color}">{item || '…'}</li>
			{/each}
		</ol>
		<p class="note">A csapatok keverve látják az elemeket.</p>
	{/if}
	<p class="note">
		{readingSeconds > 0
			? `Előtte ${readingSeconds} mp olvasási idő: csak a kérdés látszik, a gombok utána aktiválódnak.`
			: 'Nincs olvasási idő: a válaszidő azonnal indul.'}
		Válaszidő: {draft.time_limit_seconds} mp.
	</p>
</div>

<style>
	.stage {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.8rem 2rem;
		border: 10px solid #2e2c27;
		border-radius: 1.1rem;
		background: #1c1b18;
		color: #f6f3ec;
		font-family: var(--font-body);
	}

	.meta {
		display: flex;
		justify-content: space-between;
		color: #bfd9cf;
	}

	.prompt {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.6rem, 3vw, 2.6rem);
		line-height: 1.15;
		text-align: center;
	}

	img {
		align-self: center;
		max-width: 100%;
		max-height: 14rem;
		border-radius: 0.6rem;
	}

	img.pixel {
		image-rendering: pixelated;
		filter: blur(2px);
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.7rem;
	}

	.tiles.many {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.tile {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		min-height: 3.6rem;
		padding: 0.5rem 1rem;
		border-radius: 0.8rem;
		background: var(--suit);
		font-size: 1.2rem;
		font-weight: 700;
	}

	.suit {
		font-family: Georgia, serif;
		font-size: 1.6rem;
	}

	.slider {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 1.1rem;
	}

	.bar {
		flex: 1;
		height: 6px;
		border-radius: 3px;
		background: #45423b;
	}

	.order {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.order li {
		padding: 0.7rem 1rem;
		border-radius: 0.7rem;
		background: var(--suit);
		font-weight: 700;
	}

	.note {
		margin: 0;
		color: #d9d4c8;
		font-size: 0.9rem;
		text-align: center;
	}
</style>
