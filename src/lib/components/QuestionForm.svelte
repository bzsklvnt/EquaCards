<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';

	type Theme = { id: string; title: string };
	type QuestionType = {
		id: number;
		code: string;
		label: string;
		min_options: number | null;
		max_options: number | null;
	};

	type Initial = {
		theme_id: string | null;
		question_type_id: number;
		prompt: string;
		image_url: string | null;
		points: number;
		points_multiplier: number;
		time_limit_seconds: number;
		points_decay: boolean;
		choiceOptions?: { option_text: string; is_correct: boolean }[];
		sliderConfig?: {
			min_value: number;
			max_value: number;
			step: number;
			correct_value: number;
			tolerance: number;
		};
		orderingItems?: { item_text: string }[];
	};

	let {
		themes,
		questionTypes,
		action,
		initial,
		error
	}: {
		themes: Theme[];
		questionTypes: QuestionType[];
		action: string;
		initial?: Initial;
		error?: string;
	} = $props();

	let questionTypeId = $state(untrack(() => initial?.question_type_id ?? questionTypes[0]?.id));
	let selectedType = $derived(questionTypes.find((t) => t.id === questionTypeId));

	const defaultOptionCount = (type: QuestionType | undefined) => type?.min_options ?? 2;

	let choiceTexts = $state<string[]>(
		untrack(
			() =>
				initial?.choiceOptions?.map((o) => o.option_text) ??
				Array.from({ length: defaultOptionCount(selectedType) }, () => '')
		)
	);
	let correctIndexes = $state<number[]>(
		untrack(
			() =>
				initial?.choiceOptions?.map((o, i) => (o.is_correct ? i : -1)).filter((i) => i !== -1) ?? []
		)
	);

	let orderingTexts = $state<string[]>(
		untrack(() => initial?.orderingItems?.map((o) => o.item_text) ?? ['', ''])
	);

	function addChoice() {
		choiceTexts.push('');
	}
	function removeChoice(index: number) {
		choiceTexts.splice(index, 1);
		correctIndexes = correctIndexes.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i));
	}

	function addOrderingItem() {
		orderingTexts.push('');
	}
	function removeOrderingItem(index: number) {
		orderingTexts.splice(index, 1);
	}

	function toggleCorrect(index: number, multi: boolean) {
		if (multi) {
			if (correctIndexes.includes(index)) {
				correctIndexes = correctIndexes.filter((i) => i !== index);
			} else {
				correctIndexes = [...correctIndexes, index];
			}
		} else {
			correctIndexes = [index];
		}
	}
</script>

<form method="POST" {action} use:enhance>
	{#if error}
		<p class="error">{error}</p>
	{/if}

	<label>
		Téma
		<select name="theme_id">
			<option value="">— nincs téma —</option>
			{#each themes as theme (theme.id)}
				<option value={theme.id} selected={theme.id === initial?.theme_id}>{theme.title}</option>
			{/each}
		</select>
	</label>

	<label>
		Kérdés típusa
		<select name="question_type_id" bind:value={questionTypeId}>
			{#each questionTypes as type (type.id)}
				<option value={type.id}>{type.label}</option>
			{/each}
		</select>
	</label>

	<label>
		Kérdés szövege
		<textarea name="prompt" required>{initial?.prompt ?? ''}</textarea>
	</label>

	<label>
		Kép URL (opcionális)
		<input type="url" name="image_url" value={initial?.image_url ?? ''} />
	</label>

	<div class="row">
		<label>
			Pontszám
			<input type="number" name="points" value={initial?.points ?? 1000} min="0" required />
		</label>

		<label>
			Pont-szorzó
			<input
				type="number"
				name="points_multiplier"
				value={initial?.points_multiplier ?? 1}
				min="1"
				step="0.5"
				required
			/>
		</label>

		<label>
			Időlimit (mp)
			<input
				type="number"
				name="time_limit_seconds"
				value={initial?.time_limit_seconds ?? 30}
				min="5"
				required
			/>
		</label>

		<label class="checkbox">
			<input
				type="checkbox"
				name="points_decay"
				value="true"
				checked={initial?.points_decay ?? true}
			/>
			Pontcsökkenés idővel
		</label>
	</div>

	{#if selectedType?.code === 'single_choice' || selectedType?.code === 'multi_choice'}
		<fieldset>
			<legend>
				Válaszopciók ({selectedType.min_options}–{selectedType.max_options} db, jelöld a helyese(ke)t)
			</legend>
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
			{#each choiceTexts as _choiceText, i (i)}
				<div class="option-row">
					<input
						type="checkbox"
						name="correct_index"
						value={i}
						checked={correctIndexes.includes(i)}
						onchange={() => toggleCorrect(i, selectedType?.code === 'multi_choice')}
					/>
					<input type="text" name="option_text" bind:value={choiceTexts[i]} required />
					{#if choiceTexts.length > (selectedType.min_options ?? 2)}
						<button type="button" onclick={() => removeChoice(i)}>Törlés</button>
					{/if}
				</div>
			{/each}
			{#if choiceTexts.length < (selectedType.max_options ?? choiceTexts.length)}
				<button type="button" onclick={addChoice}>+ Opció</button>
			{/if}
		</fieldset>
	{:else if selectedType?.code === 'true_false'}
		<fieldset>
			<legend>Helyes válasz</legend>
			<input type="hidden" name="option_text" value="Igaz" />
			<input type="hidden" name="option_text" value="Hamis" />
			<label>
				<input
					type="radio"
					name="correct_index"
					value="0"
					checked={correctIndexes[0] === 0 || correctIndexes.length === 0}
					onchange={() => (correctIndexes = [0])}
				/>
				Igaz
			</label>
			<label>
				<input
					type="radio"
					name="correct_index"
					value="1"
					checked={correctIndexes[0] === 1}
					onchange={() => (correctIndexes = [1])}
				/>
				Hamis
			</label>
		</fieldset>
	{:else if selectedType?.code === 'slider'}
		<fieldset>
			<legend>Csúszka beállítások</legend>
			<div class="row">
				<label>
					Min. érték
					<input
						type="number"
						name="min_value"
						value={initial?.sliderConfig?.min_value ?? 0}
						step="any"
						required
					/>
				</label>
				<label>
					Max. érték
					<input
						type="number"
						name="max_value"
						value={initial?.sliderConfig?.max_value ?? 100}
						step="any"
						required
					/>
				</label>
				<label>
					Lépésköz
					<input
						type="number"
						name="step"
						value={initial?.sliderConfig?.step ?? 1}
						step="any"
						required
					/>
				</label>
				<label>
					Helyes érték
					<input
						type="number"
						name="correct_value"
						value={initial?.sliderConfig?.correct_value ?? 0}
						step="any"
						required
					/>
				</label>
				<label>
					Tolerancia (±)
					<input
						type="number"
						name="tolerance"
						value={initial?.sliderConfig?.tolerance ?? 0}
						step="any"
						required
					/>
				</label>
			</div>
		</fieldset>
	{:else if selectedType?.code === 'ordering'}
		<fieldset>
			<legend>Elemek helyes sorrendben (fentről lefelé)</legend>
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
			{#each orderingTexts as _orderingText, i (i)}
				<div class="option-row">
					<span>{i + 1}.</span>
					<input type="text" name="item_text" bind:value={orderingTexts[i]} required />
					{#if orderingTexts.length > 2}
						<button type="button" onclick={() => removeOrderingItem(i)}>Törlés</button>
					{/if}
				</div>
			{/each}
			<button type="button" onclick={addOrderingItem}>+ Elem</button>
		</fieldset>
	{/if}

	<button type="submit">Mentés</button>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 40rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	label.checkbox {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}

	.row {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.row label {
		flex: 1;
		min-width: 8rem;
	}

	fieldset {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.option-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.option-row input[type='text'] {
		flex: 1;
	}

	.error {
		color: #b91c1c;
	}
</style>
