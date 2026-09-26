<script lang="ts">
	import { suit as suitFor } from '$lib/builder/model';

	let {
		text,
		suit,
		display = false,
		imageUrl = null,
		selected = false,
		disabled = false,
		pulse = false,
		correct = false,
		tall = false,
		stamp = null,
		onclick
	}: {
		text: string;
		/** Fázis Q6 — opcionális kép az opcióhoz (pl. "melyik logó melyik
		 * márkáé" típusú kérdéseknél). Ha nincs megadva, a gomb kinézete
		 * pontosan a korábbival egyezik — nincs üres hely/placeholder. */
		imageUrl?: string | null;
		selected?: boolean;
		disabled?: boolean;
		/** Fázis O7 — rövid kiemelés-animáció koppintáskor, azonnali
		 * beküldésű kérdéstípusoknál (single_choice/true_false), hogy a
		 * csapat lássa, a válasza tényleg elment, mielőtt a UI a
		 * "submitted" nézetre vált. */
		pulse?: boolean;
		/** Fázis P6 — a megoldás-feltárás (host/TV) a helyes opció(ka)t
		 * ezzel a variánssal emeli ki: var(--power) zöld keret/háttér +
		 * pipa-animáció, ahelyett hogy csak szövegesen írná ki a helyes
		 * választ. */
		correct?: boolean;
		onclick?: () => void;
		/** Kártyaszín-lap (♠ ♥ ♦ ♣, 5–8. lapnál számmal) — a kvízösszerakóval,
		 * a kivetítővel és a csapatok telefonjával azonos jelölés. */
		suit?: number;
		/** Csak megjelenítés (kivetítő): nem kattintható, de nem is halványul. */
		display?: boolean;
		/** Álló kártya (2 oszlopos telefon): sarokindex fent és tükrözve lent,
		 * középre igazított szöveg. Alapból fekvő lap, bal oldali indexsávval. */
		tall?: boolean;
		/** Pecsét a lapon (pl. „BEKÜLDVE”) — a beküldött válasz jelölése. */
		stamp?: string | null;
	} = $props();

	// Kártyalap (docs/features/question-layout.md): a sarokindex betű + szín
	// (A♠ B♥ C♦ D♣, 5–8. lapnál E–H világosabb árnyalattal), a válasz szövege
	// mindig olvasható — a lapok nem csak színükkel különböznek.
	const LETTERS = 'ABCDEFGH';
	const s = $derived(suit === undefined ? null : suitFor(suit));
	const letter = $derived(suit === undefined ? '' : (LETTERS[suit] ?? String(suit + 1)));
</script>

<button
	type="button"
	class="choice"
	class:selected
	class:pulse
	class:correct
	class:has-image={!!imageUrl}
	class:suited={!!s}
	class:tall={!!s && tall}
	class:display
	style={s ? `--suit: ${s.color}` : undefined}
	disabled={disabled || display}
	aria-pressed={display ? undefined : selected}
	{onclick}
>
	{#if s}
		<span class="index" aria-hidden="true">{letter}<span>{s.symbol}</span></span>
	{/if}
	<span class="body">
		{#if imageUrl}
			<img class="choice-image" src={imageUrl} alt="" />
		{/if}
		<span class="choice-text">{text}</span>
	</span>
	{#if s && tall}
		<span class="index mirror" aria-hidden="true">{letter}<span>{s.symbol}</span></span>
	{/if}
	{#if stamp}
		<span class="stamp">{stamp}</span>
	{/if}
	{#if correct}
		<span class="check" aria-hidden="true">✓</span>
	{/if}
</button>

<style>
	.choice {
		font-family: var(--font-body);
		font-size: 1rem;
		padding: 0.875rem;
		border: var(--field-border-width, 2px) solid var(--field-border, var(--marquee-dim));
		border-radius: 0.5rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		cursor: pointer;
		min-height: 44px;
		text-align: left;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}

	.choice:hover:not(:disabled) {
		border-color: var(--cyan);
	}

	.choice:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 2px;
	}

	.choice.selected {
		border-color: var(--cyan);
		background: color-mix(in srgb, var(--cyan) 20%, var(--cabinet-2));
	}

	.choice:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.choice.correct {
		border-color: var(--power);
		background: color-mix(in srgb, var(--power) 20%, var(--cabinet-2));
		color: var(--marquee);
		opacity: 1;
		animation: choice-correct-in 0.4s ease;
	}

	.choice-text {
		flex: 1;
	}

	/* Fázis Q6 — ha az opciónak van képe (pl. logó-felismerős kérdés), a
	   kép a szöveg fölé kerül, a gomb pedig oszlop-elrendezésre vált — a
	   sima szöveges gomboknál (nincs kép) a viselkedés/kinézet
	   változatlan marad. */
	.choice.has-image {
		flex-direction: column;
		align-items: stretch;
		text-align: center;
	}

	.choice-image {
		width: 100%;
		max-height: 8rem;
		object-fit: contain;
		border-radius: 0.375rem;
	}

	.check {
		color: var(--power);
		font-weight: bold;
		flex-shrink: 0;
	}

	.body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	/* Kártyalapok: krémszínű lap, bal oldalt (álló lapnál a sarkokban) az
	   index — betű + kártyaszín —, a válasz szövege mindig jól olvasható. */
	.choice.suited {
		--card-face: #fffdf8;
		--card-edge: #e4ded2;
		--card-ink: #1c1b18;
		position: relative;
		align-items: stretch;
		justify-content: flex-start;
		gap: 0;
		padding: 0;
		min-height: 3.75rem;
		border: 1px solid var(--card-edge);
		border-radius: 1rem;
		background: var(--card-face);
		color: var(--card-ink);
		box-shadow: 0 4px 0 var(--card-edge);
		font-size: 1.15rem;
		font-weight: 700;
		overflow: hidden;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			border-color 0.15s ease;
	}

	.choice.suited .index {
		width: 3.6rem;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		line-height: 1.05;
		border-right: 1.5px dashed var(--card-edge);
		color: var(--suit);
		font-size: 1.3rem;
		font-weight: 800;
	}

	.choice.suited .index span {
		font-family: Georgia, serif;
		font-size: 1.4rem;
	}

	.choice.suited .body {
		justify-content: center;
		padding: 0.8rem 1rem;
	}

	.choice.suited .choice-text {
		flex: 0 1 auto;
	}

	.choice.suited:hover:not(:disabled) {
		border-color: var(--suit);
	}

	.choice.suited.selected {
		border: 2.5px solid var(--suit);
		background: #fff;
		transform: translateY(-6px);
		box-shadow: 0 10px 0 color-mix(in srgb, var(--suit) 35%, var(--card-edge));
	}

	/* Álló lap (2 oszlop): index a bal felső és — 180°-kal elforgatva — a jobb
	   alsó sarokban, a szöveg középen. */
	.choice.suited.tall {
		min-height: 8.5rem;
		overflow: visible;
	}

	.choice.suited.tall .index {
		position: absolute;
		top: 0.6rem;
		left: 0.7rem;
		width: auto;
		border: 0;
		font-size: 1.1rem;
		line-height: 1;
	}

	.choice.suited.tall .index span {
		font-size: 1.25rem;
	}

	.choice.suited.tall .index.mirror {
		top: auto;
		left: auto;
		right: 0.7rem;
		bottom: 0.6rem;
		transform: rotate(180deg);
	}

	.choice.suited.tall .body {
		align-items: center;
		padding: 2.1rem 1.4rem;
		text-align: center;
	}

	/* Inaktív (olvasás / videó alatt): szaggatott szél, a szöveg olvasható. */
	.choice.suited:disabled {
		opacity: 1;
		border-style: dashed;
		border-color: #d5cec0;
		background: #efeae0;
		box-shadow: none;
		color: #45413a;
		cursor: not-allowed;
	}

	.choice.suited:disabled .index {
		opacity: 0.6;
	}

	.choice.suited.selected:disabled {
		border: 2.5px solid var(--suit);
		background: #fff;
		color: var(--card-ink);
	}

	.choice.suited.selected:disabled .index {
		opacity: 1;
	}

	.choice.suited.display:disabled {
		border: 1px solid var(--card-edge);
		background: var(--card-face);
		color: var(--card-ink);
		box-shadow: 0 3px 0 var(--card-edge);
		cursor: default;
	}

	.choice.suited.display:disabled .index {
		opacity: 1;
	}

	.choice.suited.correct,
	.choice.suited.correct:disabled {
		border: 3px solid var(--power);
		background: #fff;
		color: var(--card-ink);
		box-shadow: 0 4px 0 color-mix(in srgb, var(--power) 45%, var(--card-edge));
	}

	.choice.suited .check {
		align-self: center;
		margin: 0 1rem 0 0;
		color: var(--power);
		font-size: 1.5rem;
	}

	.choice.suited.tall .check {
		position: absolute;
		top: 0.5rem;
		right: 0.7rem;
		margin: 0;
	}

	.stamp {
		position: absolute;
		top: 50%;
		left: 50%;
		padding: 0.15rem 0.6rem;
		border: 2px solid var(--suit, var(--cyan));
		border-radius: 0.4rem;
		background: color-mix(in srgb, #fff 80%, transparent);
		color: var(--suit, var(--cyan));
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		white-space: nowrap;
		transform: translate(-50%, 0.9rem) rotate(-8deg);
		pointer-events: none;
	}

	.choice.suited:not(.tall) .stamp {
		top: 50%;
		left: auto;
		right: 0.9rem;
		transform: translateY(-50%) rotate(-8deg);
	}

	.choice.suited.has-image {
		flex-direction: row;
		text-align: left;
	}

	.choice.suited.has-image .body {
		align-items: stretch;
	}

	@keyframes choice-correct-in {
		0% {
			transform: scale(1);
			box-shadow: 0 0 0 color-mix(in srgb, var(--power) 0%, transparent);
		}
		50% {
			transform: scale(1.03);
			box-shadow: 0 0 calc(16px * var(--glow, 1)) color-mix(in srgb, var(--power) 70%, transparent);
		}
		100% {
			transform: scale(1);
			box-shadow: 0 0 0 color-mix(in srgb, var(--power) 0%, transparent);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.choice.correct {
			animation: none;
		}
	}

	.choice.pulse {
		animation: choice-pulse 0.3s ease;
	}

	@keyframes choice-pulse {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.04);
			box-shadow: 0 0 calc(12px * var(--glow, 1)) color-mix(in srgb, var(--cyan) 60%, transparent);
		}
		100% {
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.choice.pulse {
			animation: none;
		}
	}
</style>
