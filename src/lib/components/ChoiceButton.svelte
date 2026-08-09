<script lang="ts">
	let {
		text,
		selected = false,
		disabled = false,
		pulse = false,
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
		onclick?: () => void;
	} = $props();
</script>

<button type="button" class="choice" class:selected class:pulse {disabled} {onclick}>
	{text}
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
