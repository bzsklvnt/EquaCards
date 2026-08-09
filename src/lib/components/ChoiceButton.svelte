<script lang="ts">
	let {
		text,
		selected = false,
		disabled = false,
		pulse = false,
		correct = false,
		onclick
	}: {
		text: string;
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
	} = $props();
</script>

<button type="button" class="choice" class:selected class:pulse class:correct {disabled} {onclick}>
	{text}
	{#if correct}
		<span class="check" aria-hidden="true">✓</span>
	{/if}
</button>

<style>
	.choice {
		font-family: var(--font-body);
		font-size: 1rem;
		padding: 0.875rem;
		border: 2px solid var(--marquee-dim);
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

	.check {
		color: var(--power);
		font-weight: bold;
		flex-shrink: 0;
	}

	@keyframes choice-correct-in {
		0% {
			transform: scale(1);
			box-shadow: 0 0 0 color-mix(in srgb, var(--power) 0%, transparent);
		}
		50% {
			transform: scale(1.03);
			box-shadow: 0 0 16px color-mix(in srgb, var(--power) 70%, transparent);
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
			box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 60%, transparent);
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
