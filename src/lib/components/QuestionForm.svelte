<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import Input from './Input.svelte';
	import Textarea from './Textarea.svelte';
	import Select from './Select.svelte';
	import Checkbox from './Checkbox.svelte';
	import Button from './Button.svelte';

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

	let themeId = $state(untrack(() => initial?.theme_id ?? ''));
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

	<Select label="Téma" name="theme_id" bind:value={themeId}>
		<option value="">— nincs téma —</option>
		{#each themes as theme (theme.id)}
			<option value={theme.id}>{theme.title}</option>
		{/each}
	</Select>

	<!-- Marad natív <select>: a bind:value numerikus koercióját (a
	     questionTypeId szám, nem string) csak egy közvetlenül fordított
	     <select> elem tudja — egy generikus Select wrapper (string-alapú
	     value) ezt eltörné, és a selectedType keresés típushibássá válna. -->
	<label>
		Kérdés típusa
		<select name="question_type_id" bind:value={questionTypeId}>
			{#each questionTypes as type (type.id)}
				<option value={type.id}>{type.label}</option>
			{/each}
		</select>
	</label>

	<Textarea label="Kérdés szövege" name="prompt" value={initial?.prompt ?? ''} required />

	<Input
		label="Kép URL (opcionális)"
		type="url"
		name="image_url"
		value={initial?.image_url ?? ''}
	/>

	<div class="row">
		<Input
			label="Pontszám"
			type="number"
			name="points"
			value={String(initial?.points ?? 1000)}
			min="0"
			required
		/>

		<Input
			label="Pont-szorzó"
			type="number"
			name="points_multiplier"
			value={String(initial?.points_multiplier ?? 1)}
			min="1"
			step="0.5"
			required
		/>

		<Input
			label="Időlimit (mp)"
			type="number"
			name="time_limit_seconds"
			value={String(initial?.time_limit_seconds ?? 30)}
			min="5"
			required
		/>

		<Checkbox
			label="Pontcsökkenés idővel"
			name="points_decay"
			value="true"
			checked={initial?.points_decay ?? true}
		/>
	</div>

	{#if selectedType?.code === 'single_choice' || selectedType?.code === 'multi_choice'}
		<fieldset>
			<legend>
				Válaszopciók ({selectedType.min_options}–{selectedType.max_options} db, jelöld a helyese(ke)t)
			</legend>
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
			{#each choiceTexts as _choiceText, i (i)}
				<div class="option-row">
					<Checkbox
						label=""
						name="correct_index"
						value={String(i)}
						checked={correctIndexes.includes(i)}
						onchange={() => toggleCorrect(i, selectedType?.code === 'multi_choice')}
					/>
					<Input name="option_text" bind:value={choiceTexts[i]} required />
					{#if choiceTexts.length > (selectedType.min_options ?? 2)}
						<Button variant="ghost" onclick={() => removeChoice(i)}>Törlés</Button>
					{/if}
				</div>
			{/each}
			{#if choiceTexts.length < (selectedType.max_options ?? choiceTexts.length)}
				<Button variant="secondary" onclick={addChoice}>+ Opció</Button>
			{/if}
		</fieldset>
	{:else if selectedType?.code === 'true_false'}
		<!-- Marad natív <input type="radio">: ez az egyetlen rádiógomb a teljes
		     alkalmazásban, nem éri meg érte önálló Radio komponenst bevezetni a
		     könyvtárba (Fázis H — csak akkor bővítjük a könyvtárat, ha egy minta
		     ténylegesen több helyen ismétlődik). -->
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
				<Input
					label="Min. érték"
					type="number"
					name="min_value"
					value={String(initial?.sliderConfig?.min_value ?? 0)}
					step="any"
					required
				/>
				<Input
					label="Max. érték"
					type="number"
					name="max_value"
					value={String(initial?.sliderConfig?.max_value ?? 100)}
					step="any"
					required
				/>
				<Input
					label="Lépésköz"
					type="number"
					name="step"
					value={String(initial?.sliderConfig?.step ?? 1)}
					step="any"
					required
				/>
				<Input
					label="Helyes érték"
					type="number"
					name="correct_value"
					value={String(initial?.sliderConfig?.correct_value ?? 0)}
					step="any"
					required
				/>
				<Input
					label="Tolerancia (±)"
					type="number"
					name="tolerance"
					value={String(initial?.sliderConfig?.tolerance ?? 0)}
					step="any"
					required
				/>
			</div>
		</fieldset>
	{:else if selectedType?.code === 'ordering'}
		<fieldset>
			<legend>Elemek helyes sorrendben (fentről lefelé)</legend>
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
			{#each orderingTexts as _orderingText, i (i)}
				<div class="option-row">
					<span>{i + 1}.</span>
					<Input name="item_text" bind:value={orderingTexts[i]} required />
					{#if orderingTexts.length > 2}
						<Button variant="ghost" onclick={() => removeOrderingItem(i)}>Törlés</Button>
					{/if}
				</div>
			{/each}
			<Button variant="secondary" onclick={addOrderingItem}>+ Elem</Button>
		</fieldset>
	{/if}

	<Button type="submit">Mentés</Button>
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

	.row {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.row :global(.field),
	.row :global(.checkbox-field) {
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

	.option-row :global(.field) {
		flex: 1;
	}

	.error {
		color: var(--danger);
	}

	/* Fázis J — a natív <select>/<input type="radio"> szándékosan nem
	   Select/Checkbox-wrapped (lásd fenti indoklás), de látható,
	   --cyan-alapú fókusz-állapotot kapniuk kell, mint a könyvtár többi
	   interaktív elemének. */
	select:focus-visible,
	input[type='radio']:focus-visible {
		outline: 3px solid var(--cyan, #35e7ff);
		outline-offset: 2px;
	}
</style>
