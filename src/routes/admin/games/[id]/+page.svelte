<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<main>
	<h1>{data.game.title}</h1>
	<p class="status">Állapot: {data.game.status}</p>
	<a href={resolve('/host/[game_id]', { game_id: data.game.id })}>Élő lebonyolítás megnyitása →</a>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<form method="POST" action="?/addRound" use:enhance class="add-round">
		<input type="text" name="title" placeholder="Új kör neve" required />
		<button type="submit">+ Kör hozzáadása</button>
	</form>

	{#each data.rounds as round (round.id)}
		<section class="round">
			<div class="round-header">
				<h2>{round.order_index}. {round.title}</h2>
				<form method="POST" action="?/deleteRound" use:enhance>
					<input type="hidden" name="round_id" value={round.id} />
					<button type="submit">Kör törlése</button>
				</form>
			</div>

			<form method="POST" action="?/draw" use:enhance class="draw-form">
				<input type="hidden" name="round_id" value={round.id} />
				<label>
					Téma
					<select name="theme_id" required>
						<option value="">— válassz témát —</option>
						{#each data.themes as theme (theme.id)}
							<option value={theme.id}>{theme.title}</option>
						{/each}
					</select>
				</label>
				<label>
					Darabszám
					<input type="number" name="count" value="8" min="1" max="20" />
				</label>
				<button type="submit">Random húzás</button>
			</form>

			<ol>
				{#each data.roundQuestions[round.id] ?? [] as rq (rq.question_id)}
					<li>
						{rq.prompt}
						<form method="POST" action="?/removeQuestion" use:enhance>
							<input type="hidden" name="round_id" value={round.id} />
							<input type="hidden" name="question_id" value={rq.question_id} />
							<button type="submit">Eltávolítás</button>
						</form>
					</li>
				{:else}
					<li class="empty">Még nincs kérdés ebben a körben.</li>
				{/each}
			</ol>
		</section>
	{:else}
		<p>Még nincs kör felvéve.</p>
	{/each}
</main>

<style>
	.status {
		color: #666;
	}

	.add-round {
		display: inline-flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.round {
		border: 1px solid #ddd;
		border-radius: 0.5rem;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.round-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.draw-form {
		display: flex;
		gap: 1rem;
		align-items: end;
		margin: 1rem 0;
	}

	.draw-form label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	ol {
		padding-left: 1.5rem;
	}

	li {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.25rem;
	}

	li form {
		display: inline;
	}

	.empty {
		color: #666;
		list-style: none;
		margin-left: -1.5rem;
	}

	.error {
		color: #b91c1c;
	}
</style>
