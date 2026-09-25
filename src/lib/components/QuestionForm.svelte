<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import Input from './Input.svelte';
	import Textarea from './Textarea.svelte';
	import Select from './Select.svelte';
	import Checkbox from './Checkbox.svelte';
	import Button from './Button.svelte';
	import ImageUpload from './ImageUpload.svelte';
	import { withToast } from '$lib/toast-enhance';

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
		choiceOptions?: { option_text: string; image_url: string | null; is_correct: boolean }[];
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
		error,
		defaultThemeId,
		hiddenFields = {},
		cancelHref
	}: {
		themes: Theme[];
		questionTypes: QuestionType[];
		action: string;
		initial?: Initial;
		error?: string;
		/** Új kérdésnél előre kiválasztott téma (pl. a kvízeste globális témája). */
		defaultThemeId?: string;
		/** Extra rejtett mezők a formhoz (pl. round_id a "kérdés ehhez a körhöz" folyamatnál). */
		hiddenFields?: Record<string, string>;
		cancelHref?: string;
	} = $props();

	let saving = $state(false);
	let themeId = $state(untrack(() => initial?.theme_id ?? defaultThemeId ?? ''));
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
	// Fázis Q6 — a választható opciók (image_url) párhuzamos tömbje, a
	// choiceTexts-szel azonos index szerint tartva szinkronban (addChoice/
	// removeChoice mindkettőt módosítja), hogy a kép-feltöltő mező a
	// megfelelő opció-sorban maradjon.
	let choiceImages = $state<(string | null)[]>(
		untrack(
			() =>
				initial?.choiceOptions?.map((o) => o.image_url) ??
				Array.from({ length: defaultOptionCount(selectedType) }, () => null)
		)
	);
	let correctIndexes = $state<number[]>(
		untrack(
			() =>
				initial?.choiceOptions?.map((o, i) => (o.is_correct ? i : -1)).filter((i) => i !== -1) ?? []
		)
	);
	// Fázis Q6 — true_false-nál fix két opció (Igaz/Hamis), lásd lent.
	let trueFalseImages = $state<(string | null)[]>(
		untrack(() => [
			initial?.choiceOptions?.[0]?.image_url ?? null,
			initial?.choiceOptions?.[1]?.image_url ?? null
		])
	);
	let questionImageUrl = $state<string | null>(untrack(() => initial?.image_url ?? null));

	let orderingTexts = $state<string[]>(
		untrack(() => initial?.orderingItems?.map((o) => o.item_text) ?? ['', ''])
	);

	function addChoice() {
		choiceTexts.push('');
		choiceImages.push(null);
	}
	function removeChoice(index: number) {
		choiceTexts.splice(index, 1);
		choiceImages.splice(index, 1);
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

<form method="POST" {action} use:enhance={withToast({ setSubmitting: (v) => (saving = v) })}>
	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#each Object.entries(hiddenFields) as [fieldName, fieldValue] (fieldName)}
		<input type="hidden" name={fieldName} value={fieldValue} />
	{/each}

	<Select label="Téma" name="theme_id" bind:value={themeId}>
		<option value="">— nincs téma —</option>
		{#each themes as theme (theme.id)}
			<option value={theme.id}>{theme.title}</option>
		{/each}
	</Select>

	<!-- A Select string-alapú; a függvény-kötés végzi a szám ↔ string
	     konverziót, így nem kell natív, stílus nélküli <select>. -->
	<Select
		label="Kérdés típusa"
		name="question_type_id"
		bind:value={() => String(questionTypeId), (v) => (questionTypeId = Number(v))}
	>
		{#each questionTypes as type (type.id)}
			<option value={String(type.id)}>{type.label}</option>
		{/each}
	</Select>

	<Textarea label="Kérdés szövege" name="prompt" value={initial?.prompt ?? ''} required />

	<ImageUpload label="Kérdés képe (opcionális)" name="image_url" bind:value={questionImageUrl} />

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
				Válaszopciók ({selectedType.min_options}–{selectedType.max_options} db, jelöld a helyese(ke)t,
				opcionálisan képpel)
			</legend>
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
			{#each choiceTexts as _choiceText, i (i)}
				<div class="option-row">
					<Checkbox
						label="Helyes"
						name="correct_index"
						value={String(i)}
						checked={correctIndexes.includes(i)}
						onchange={() => toggleCorrect(i, selectedType?.code === 'multi_choice')}
					/>
					<Input name="option_text" bind:value={choiceTexts[i]} required />
					<ImageUpload compact name="option_image_url" bind:value={choiceImages[i]} />
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
		<fieldset>
			<legend>Helyes válasz</legend>
			<input type="hidden" name="option_text" value="Igaz" />
			<input type="hidden" name="option_text" value="Hamis" />
			<div class="segmented" role="radiogroup" aria-label="Helyes válasz">
				{#each ['Igaz', 'Hamis'] as tfLabel, tfIndex (tfLabel)}
					<label class="segment" class:active={(correctIndexes[0] ?? 0) === tfIndex}>
						<input
							type="radio"
							name="correct_index"
							value={String(tfIndex)}
							checked={(correctIndexes[0] ?? 0) === tfIndex}
							onchange={() => (correctIndexes = [tfIndex])}
						/>
						{tfLabel}
					</label>
				{/each}
			</div>
			<ImageUpload
				label="Igaz — kép (opcionális)"
				name="option_image_url"
				bind:value={trueFalseImages[0]}
			/>
			<ImageUpload
				label="Hamis — kép (opcionális)"
				name="option_image_url"
				bind:value={trueFalseImages[1]}
			/>
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

	<div class="form-actions">
		<Button type="submit" loading={saving}>Mentés</Button>
		{#if cancelHref}
			<Button variant="ghost" href={cancelHref}>Mégse</Button>
		{/if}
	</div>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 40rem;
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

	/* Élő tesztből: a fieldset/legend a böngésző alapértelmezett (szürke,
	   dupla vonalas) keretével jelent meg — a design-rendszer kártyáihoz
	   igazítva. */
	fieldset {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 0;
		padding: 1rem;
		border: 2px solid var(--cabinet-3);
		border-radius: 0.75rem;
		background: var(--cabinet-2);
	}

	legend {
		padding: 0 0.5rem;
		font-family: var(--font-body);
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--cyan);
	}

	.option-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.option-row :global(.field) {
		flex: 1;
	}

	.segmented {
		display: inline-flex;
		align-self: flex-start;
		border: 2px solid var(--marquee-dim);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.segment {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 6rem;
		min-height: 44px;
		padding: 0 1rem;
		font-family: var(--font-body);
		font-weight: 600;
		color: var(--marquee-dim);
		background: var(--cabinet);
		cursor: pointer;
	}

	.segment + .segment {
		border-left: 2px solid var(--marquee-dim);
	}

	.segment.active {
		color: var(--marquee);
		background: color-mix(in srgb, var(--cyan) 25%, var(--cabinet-2));
	}

	.segment input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}

	.segment:focus-within {
		outline: 3px solid var(--cyan);
		outline-offset: -3px;
	}

	.form-actions {
		display: flex;
		gap: 0.75rem;
	}

	.error {
		color: var(--danger);
	}
</style>
