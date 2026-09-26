<script lang="ts">
	import { ImageUploadError, uploadQuestionImage } from '$lib/images/upload';
	import { suit, type Draft, type QuestionTypeInfo } from './model';

	// A kérdés "vászna": úgy néz ki, ahogy a kivetítőn fog, de minden eleme
	// szerkeszthető. Mind az 5 kérdéstípust kezeli — docs/features/quiz-builder.md.
	let {
		draft = $bindable(),
		types
	}: {
		draft: Draft;
		types: QuestionTypeInfo[];
	} = $props();

	const type = $derived(types.find((t) => t.code === draft.type_code));
	const isChoice = $derived(
		draft.type_code === 'single_choice' || draft.type_code === 'multi_choice'
	);
	const minOptions = $derived(type?.min_options ?? 2);
	const maxOptions = $derived(type?.max_options ?? 8);

	let uploading = $state<string | null>(null);
	let imageError = $state('');
	let dragOver = $state(false);

	async function upload(file: File, target: 'question' | number) {
		imageError = '';
		uploading = String(target);
		try {
			const url = await uploadQuestionImage(file);
			if (target === 'question') draft.image_url = url;
			else draft.options[target].image_url = url;
		} catch (err) {
			imageError = err instanceof ImageUploadError ? err.message : 'Nem sikerült feltölteni.';
		} finally {
			uploading = null;
		}
	}

	function onFileInput(e: Event, target: 'question' | number) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) void upload(file, target);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) void upload(file, 'question');
	}

	/** A builder oldal hívja Ctrl+V-re, ha a vágólapon kép van. */
	export function pasteImage(file: File) {
		void upload(file, 'question');
	}

	export function toggleCorrect(index: number) {
		if (index >= draft.options.length) return;
		if (draft.type_code === 'multi_choice') {
			draft.options[index].is_correct = !draft.options[index].is_correct;
		} else {
			draft.options = draft.options.map((o, i) => ({ ...o, is_correct: i === index }));
		}
	}

	function addOption() {
		if (draft.options.length >= maxOptions) return;
		draft.options = [...draft.options, { text: '', image_url: null, is_correct: false }];
		queueMicrotask(() => document.getElementById(`bq-opt-${draft.options.length - 1}`)?.focus());
	}

	function removeOption(index: number) {
		if (draft.options.length <= minOptions) return;
		draft.options = draft.options.filter((_, i) => i !== index);
	}

	function moveItem(index: number, delta: number) {
		const target = index + delta;
		if (target < 0 || target >= draft.ordering.length) return;
		const next = [...draft.ordering];
		[next[index], next[target]] = [next[target], next[index]];
		draft.ordering = next;
		queueMicrotask(() => document.getElementById(`bq-item-${target}`)?.focus());
	}

	function addItem() {
		draft.ordering = [...draft.ordering, ''];
		queueMicrotask(() => document.getElementById(`bq-item-${draft.ordering.length - 1}`)?.focus());
	}

	function removeItem(index: number) {
		if (draft.ordering.length <= 2) return;
		draft.ordering = draft.ordering.filter((_, i) => i !== index);
	}

	function onItemKeydown(e: KeyboardEvent, index: number) {
		if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
			e.preventDefault();
			e.stopPropagation();
			moveItem(index, e.key === 'ArrowUp' ? -1 : 1);
		} else if (e.key === 'Enter' && index === draft.ordering.length - 1) {
			e.preventDefault();
			addItem();
		}
	}

	let dragIndex = $state<number | null>(null);
	function onItemDrop(index: number) {
		if (dragIndex === null || dragIndex === index) return;
		const next = [...draft.ordering];
		const [moved] = next.splice(dragIndex, 1);
		next.splice(index, 0, moved);
		draft.ordering = next;
		dragIndex = null;
	}

	const sliderRange = $derived(Math.max(1e-9, draft.slider.max_value - draft.slider.min_value));
	const pct = (v: number) =>
		Math.min(100, Math.max(0, ((v - draft.slider.min_value) / sliderRange) * 100));
</script>

<section class="canvas" aria-label="Kérdés vászon — így jelenik meg a kivetítőn">
	<label class="prompt-field">
		<span class="sr-only">Kérdés szövege</span>
		<textarea
			id="bq-prompt"
			rows="2"
			placeholder="Írd be a kérdést…"
			bind:value={draft.prompt}
			data-tour="qb-prompt"></textarea>
	</label>

	<div
		class="image-zone"
		class:has-image={!!draft.image_url}
		class:drag={dragOver}
		role="group"
		aria-label="Kérdés képe"
		ondragover={(e) => {
			e.preventDefault();
			dragOver = true;
		}}
		ondragleave={() => (dragOver = false)}
		ondrop={onDrop}
		data-tour="qb-image"
	>
		{#if draft.image_url}
			<img src={draft.image_url} alt="" class:pixel={draft.image_pixelate} />
			<div class="image-actions">
				{#if draft.image_pixelate}<span class="badge">Pixeles felfedés</span>{/if}
				<label class="mini-btn">
					<input
						type="file"
						accept="image/jpeg,image/png,image/webp"
						onchange={(e) => onFileInput(e, 'question')}
					/>
					Csere
				</label>
				<button type="button" class="mini-btn" onclick={() => (draft.image_url = null)}
					>Eltávolítás</button
				>
			</div>
		{:else}
			<label class="drop-label">
				<input
					type="file"
					accept="image/jpeg,image/png,image/webp"
					onchange={(e) => onFileInput(e, 'question')}
				/>
				<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
					<rect x="3" y="4" width="18" height="16" rx="2" />
					<circle cx="9" cy="10" r="2" />
					<path d="M21 16l-5-5-8 9" />
				</svg>
				<span>{uploading === 'question' ? 'Feltöltés…' : 'Kép behúzása, tallózás vagy Ctrl+V'}</span
				>
				<small>Nem kötelező · JPG, PNG, WebP, max. 5 MB</small>
			</label>
		{/if}
	</div>
	{#if imageError}<p class="error" role="alert">{imageError}</p>{/if}

	<div class="answers" data-tour="qb-answers">
		{#if isChoice}
			<div class="tiles" class:many={draft.options.length > 4}>
				{#each draft.options as option, i (i)}
					{@const s = suit(i)}
					<div class="tile" style="--suit: {s.color}">
						<div class="tile-top">
							<span class="suit" aria-hidden="true">{s.label}</span>
							<button
								type="button"
								class="correct"
								class:on={option.is_correct}
								aria-pressed={option.is_correct}
								aria-label="{i + 1}. válasz helyes"
								title="Helyes ({i + 1})"
								onclick={() => toggleCorrect(i)}>{option.is_correct ? '✓' : ''}</button
							>
						</div>
						<input
							id="bq-opt-{i}"
							class="tile-input"
							placeholder={i < minOptions ? `${i + 1}. válasz` : `${i + 1}. válasz`}
							aria-label="{i + 1}. válasz szövege"
							bind:value={option.text}
						/>
						<div class="tile-foot">
							{#if option.image_url}
								<img src={option.image_url} alt="" />
								<button
									type="button"
									class="tile-link"
									onclick={() => (draft.options[i].image_url = null)}>kép ✕</button
								>
							{:else}
								<label class="tile-link">
									<input
										type="file"
										accept="image/jpeg,image/png,image/webp"
										onchange={(e) => onFileInput(e, i)}
									/>
									{uploading === String(i) ? 'feltöltés…' : '+ kép'}
								</label>
							{/if}
							{#if draft.options.length > minOptions}
								<button
									type="button"
									class="tile-link"
									aria-label="{i + 1}. válasz törlése"
									onclick={() => removeOption(i)}>törlés</button
								>
							{/if}
							<kbd>{i + 1}</kbd>
						</div>
					</div>
				{/each}
				{#if draft.options.length < maxOptions}
					<button type="button" class="tile add" onclick={addOption}>
						+ {draft.options.length + 1}. opció <small>(max. {maxOptions})</small>
					</button>
				{/if}
			</div>
			<p class="hint">
				{draft.type_code === 'multi_choice'
					? `Jelölj be minden helyes választ · ${minOptions}–${maxOptions} opció`
					: 'Pontosan egy helyes válasz'}
			</p>
		{:else if draft.type_code === 'true_false'}
			<div class="tiles tf">
				{#each draft.options as option, i (i)}
					{@const s = suit(i)}
					<button
						type="button"
						class="tile tf-tile"
						style="--suit: {s.color}"
						aria-pressed={option.is_correct}
						onclick={() => toggleCorrect(i)}
					>
						<span class="suit big" aria-hidden="true">{s.symbol}</span>
						<span class="tf-label">{option.text}</span>
						<span class="tf-state">{option.is_correct ? '✓ helyes' : ''}</span>
						<kbd>{i + 1}</kbd>
					</button>
				{/each}
			</div>
			<p class="hint">Kattints (vagy nyomd az 1 / 2 billentyűt) a helyes lapra.</p>
		{:else if draft.type_code === 'slider'}
			<div class="slider-box">
				<div class="track" aria-hidden="true">
					<div
						class="band"
						style="left: {pct(
							draft.slider.correct_value - draft.slider.tolerance
						)}%; width: {Math.max(
							0.8,
							pct(draft.slider.correct_value + draft.slider.tolerance) -
								pct(draft.slider.correct_value - draft.slider.tolerance)
						)}%"
					></div>
					<div class="knob" style="left: {pct(draft.slider.correct_value)}%"></div>
				</div>
				<div class="slider-fields">
					<label
						><span>Minimum</span><input
							type="number"
							step="any"
							bind:value={draft.slider.min_value}
						/></label
					>
					<label
						><span>Maximum</span><input
							type="number"
							step="any"
							bind:value={draft.slider.max_value}
						/></label
					>
					<label
						><span>Lépésköz</span><input
							type="number"
							step="any"
							min="0"
							bind:value={draft.slider.step}
						/></label
					>
					<label class="strong"
						><span>Helyes érték</span><input
							id="bq-opt-0"
							type="number"
							step="any"
							bind:value={draft.slider.correct_value}
						/></label
					>
					<label
						><span>Tűrés (±)</span><input
							type="number"
							step="any"
							min="0"
							bind:value={draft.slider.tolerance}
						/></label
					>
				</div>
				<p class="hint">
					Helyes a tipp, ha {draft.slider.correct_value - draft.slider.tolerance} és {draft.slider
						.correct_value + draft.slider.tolerance} közé esik.
				</p>
			</div>
		{:else if draft.type_code === 'ordering'}
			<p class="hint top">Ez a HELYES sorrend fentről lefelé — a csapatok keverve kapják.</p>
			<ol class="order-list">
				<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
				{#each draft.ordering as _item, i (i)}
					{@const s = suit(i)}
					<li
						class="order-item"
						style="--suit: {s.color}"
						draggable="true"
						ondragstart={() => (dragIndex = i)}
						ondragover={(e) => e.preventDefault()}
						ondrop={() => onItemDrop(i)}
					>
						<span class="grip" aria-hidden="true">⠿</span>
						<span class="pos">{i + 1}.</span>
						<input
							id="bq-item-{i}"
							aria-label="{i + 1}. elem"
							placeholder="{i + 1}. elem"
							bind:value={draft.ordering[i]}
							onkeydown={(e) => onItemKeydown(e, i)}
						/>
						<button
							type="button"
							aria-label="Feljebb"
							disabled={i === 0}
							onclick={() => moveItem(i, -1)}>↑</button
						>
						<button
							type="button"
							aria-label="Lejjebb"
							disabled={i === draft.ordering.length - 1}
							onclick={() => moveItem(i, 1)}>↓</button
						>
						{#if draft.ordering.length > 2}
							<button type="button" aria-label="{i + 1}. elem törlése" onclick={() => removeItem(i)}
								>✕</button
							>
						{/if}
					</li>
				{/each}
			</ol>
			<button type="button" class="add-item" onclick={addItem}>+ Elem (Enter az utolsón)</button>
		{/if}
	</div>
</section>

<style>
	.canvas {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.4rem 1.5rem;
		background: var(--cabinet-2);
		border: 1px solid var(--panel-border, var(--cabinet-3));
		border-radius: 1.1rem;
		min-width: 0;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.prompt-field textarea {
		width: 100%;
		box-sizing: border-box;
		resize: vertical;
		min-height: 5.2rem;
		border: 1px dashed var(--field-border, #d5cec0);
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		font-family: var(--font-display);
		font-size: clamp(1.35rem, 2.2vw, 2rem);
		line-height: 1.2;
		text-align: center;
		color: var(--marquee);
		background: var(--cabinet-2);
	}

	.prompt-field textarea:focus {
		outline: 3px solid var(--cyan);
		outline-offset: 1px;
		border-style: solid;
	}

	.image-zone {
		position: relative;
		min-height: 7.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px dashed var(--field-border, #d5cec0);
		border-radius: 0.9rem;
		background: color-mix(in srgb, var(--cabinet) 50%, var(--cabinet-2));
		color: var(--marquee-dim);
		overflow: hidden;
	}

	.image-zone.drag {
		border-color: var(--cyan);
		background: color-mix(in srgb, var(--cyan) 8%, var(--cabinet-2));
	}

	.image-zone.has-image {
		border-style: solid;
		min-height: 0;
		max-height: 15rem;
	}

	.image-zone img {
		max-width: 100%;
		max-height: 15rem;
		object-fit: contain;
	}

	.image-zone img.pixel {
		image-rendering: pixelated;
		filter: blur(1px);
	}

	.image-actions {
		position: absolute;
		right: 0.6rem;
		bottom: 0.6rem;
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.badge {
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		background: var(--marquee);
		color: var(--cabinet-2);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.mini-btn {
		position: relative;
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.5rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
	}

	.mini-btn input,
	.drop-label input,
	.tile-link input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.drop-label {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 1.25rem;
		width: 100%;
		text-align: center;
		cursor: pointer;
		font-size: 0.9375rem;
	}

	.drop-label:focus-within {
		outline: 3px solid var(--cyan);
		outline-offset: -3px;
		border-radius: 0.8rem;
	}

	.drop-label svg {
		fill: none;
		stroke: var(--marquee-dim);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.drop-label small,
	.hint {
		font-size: 0.8125rem;
		color: var(--marquee-dim);
	}

	.hint {
		margin: 0.1rem 0 0;
		text-align: center;
	}

	.hint.top {
		margin-bottom: 0.4rem;
	}

	.error {
		margin: 0;
		color: var(--danger);
		font-size: 0.875rem;
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
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.6rem 0.8rem;
		border-radius: 0.9rem;
		background: var(--suit);
		color: #fff;
		min-width: 0;
	}

	.tile-top,
	.tile-foot {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.tile-top {
		justify-content: space-between;
	}

	.suit {
		font-family: Georgia, serif;
		font-size: 1.5rem;
		line-height: 1;
	}

	.suit.big {
		font-size: 2.6rem;
	}

	.correct {
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 50%;
		border: 2px solid rgb(255 255 255 / 75%);
		background: transparent;
		color: var(--suit);
		font-weight: 800;
		font-size: 1.05rem;
		cursor: pointer;
	}

	.correct.on {
		background: #fff;
		border-color: #fff;
	}

	.correct:focus-visible,
	.tile-input:focus,
	.tile-link:focus-within,
	.tile-link:focus-visible,
	.tf-tile:focus-visible {
		outline: 3px solid #fff;
		outline-offset: 2px;
	}

	.tile-input {
		width: 100%;
		box-sizing: border-box;
		border: 0;
		border-bottom: 2px solid rgb(255 255 255 / 45%);
		background: transparent;
		color: #fff;
		font: inherit;
		font-size: 1.1rem;
		font-weight: 700;
		padding: 0.25rem 0;
	}

	.tile-input::placeholder {
		color: rgb(255 255 255 / 70%);
		font-weight: 600;
	}

	.tile-foot {
		font-size: 0.8rem;
	}

	.tile-foot img {
		width: 1.8rem;
		height: 1.8rem;
		object-fit: cover;
		border-radius: 0.3rem;
	}

	.tile-foot kbd {
		margin-left: auto;
		font-family: ui-monospace, monospace;
		opacity: 0.8;
	}

	.tile-link {
		position: relative;
		border: 0;
		background: transparent;
		color: #fff;
		font: inherit;
		text-decoration: underline;
		text-underline-offset: 2px;
		opacity: 0.9;
		cursor: pointer;
		padding: 0;
	}

	.tile.add {
		align-items: center;
		justify-content: center;
		min-height: 5.5rem;
		border: 2px dashed var(--field-border, #c9bfa9);
		background: transparent;
		color: var(--marquee-dim);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.tile.add:focus-visible {
		outline: 3px solid var(--cyan);
	}

	.tf .tf-tile {
		align-items: center;
		justify-content: center;
		min-height: 9rem;
		border: 0;
		font: inherit;
		cursor: pointer;
		position: relative;
	}

	.tf-tile[aria-pressed='false'] {
		opacity: 0.8;
	}

	.tf-label {
		font-size: 1.4rem;
		font-weight: 700;
	}

	.tf-state {
		min-height: 1.4rem;
		padding: 0.1rem 0.6rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 800;
	}

	.tf-tile[aria-pressed='true'] .tf-state {
		background: #fff;
		color: var(--suit);
	}

	.tf-tile kbd {
		position: absolute;
		right: 0.8rem;
		bottom: 0.6rem;
		font-family: ui-monospace, monospace;
		opacity: 0.8;
	}

	.slider-box {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.track {
		position: relative;
		height: 2rem;
		margin: 0 0.6rem;
	}

	.track::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 0.9rem;
		height: 4px;
		border-radius: 2px;
		background: var(--panel-border, #e4ded2);
	}

	.band {
		position: absolute;
		top: 0.55rem;
		height: 1rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--cyan) 25%, transparent);
	}

	.knob {
		position: absolute;
		top: 0.5rem;
		width: 1.1rem;
		height: 1.1rem;
		margin-left: -0.55rem;
		border-radius: 50%;
		background: var(--cyan);
	}

	.slider-fields {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.slider-fields label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.8125rem;
		color: var(--marquee-dim);
	}

	.slider-fields input {
		min-width: 0;
		height: 2.6rem;
		box-sizing: border-box;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.55rem;
		padding: 0 0.6rem;
		font: inherit;
		font-size: 1rem;
		color: var(--marquee);
		background: var(--cabinet-2);
	}

	.slider-fields .strong input {
		border: 2px solid var(--cyan);
		font-weight: 700;
	}

	.order-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.order-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 3rem;
		padding: 0 0.6rem;
		border-radius: 0.75rem;
		background: var(--suit);
		color: #fff;
	}

	.grip {
		cursor: grab;
		opacity: 0.8;
	}

	.pos {
		font-weight: 700;
		min-width: 1.5rem;
	}

	.order-item input {
		flex: 1;
		min-width: 0;
		border: 0;
		border-bottom: 2px solid rgb(255 255 255 / 45%);
		background: transparent;
		color: #fff;
		font: inherit;
		font-size: 1.05rem;
		font-weight: 700;
		padding: 0.3rem 0;
	}

	.order-item input::placeholder {
		color: rgb(255 255 255 / 70%);
	}

	.order-item input:focus {
		outline: 3px solid #fff;
		outline-offset: 2px;
	}

	.order-item button {
		min-width: 2rem;
		height: 2rem;
		border: 1px solid rgb(255 255 255 / 55%);
		border-radius: 0.45rem;
		background: transparent;
		color: #fff;
		font: inherit;
		cursor: pointer;
	}

	.order-item button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.add-item {
		align-self: flex-start;
		padding: 0.5rem 0.9rem;
		border: 1px dashed var(--field-border, #c9bfa9);
		border-radius: 0.6rem;
		background: transparent;
		color: var(--marquee);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	@media (max-width: 720px) {
		.tiles,
		.tiles.many {
			grid-template-columns: minmax(0, 1fr);
		}

		.slider-fields {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
