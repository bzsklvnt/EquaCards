<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getActiveTokens, tokensToCssText } from '$lib/theme/tokens';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let pin = $state('');
	let themeCss = $state('');

	onMount(() => {
		getActiveTokens(data.supabase, null).then((tokens) => {
			themeCss = tokensToCssText(tokens);
		});
	});

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (pin.trim()) {
			goto(resolve('/play/[pin]', { pin: pin.trim() }));
		}
	}
</script>

<svelte:head>
	<title>Csatlakozás — EquaCards</title>
</svelte:head>

<main class="cabinet" style={themeCss}>
	<h1>Csatlakozás kvízhez</h1>
	<form onsubmit={submit}>
		<label>
			PIN kód
			<input
				type="text"
				inputmode="numeric"
				pattern="[0-9]*"
				bind:value={pin}
				maxlength="6"
				required
			/>
		</label>
		<button type="submit">Csatlakozás</button>
	</form>
</main>

<style>
	main.cabinet {
		max-width: 20rem;
		margin: 0 auto;
		padding: 4rem 1rem 2rem;
		text-align: center;
		background: linear-gradient(160deg, var(--cabinet), var(--cabinet-2) 60%, var(--cabinet-3));
		color: var(--marquee);
		font-family: var(--font-body);
		min-height: 100vh;
	}

	h1 {
		font-family: var(--font-display);
		font-size: clamp(1rem, 5vw, 1.25rem);
		line-height: 1.6;
		color: var(--cyan);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		text-align: left;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		color: var(--marquee-dim);
	}

	input {
		font-family: var(--font-led);
		font-size: 1.5rem;
		text-align: center;
		letter-spacing: 0.25rem;
		padding: 0.5rem;
		min-height: 44px;
		border-radius: 0.375rem;
		border: 2px solid var(--marquee-dim);
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	input:focus-visible {
		outline: none;
		border-color: var(--cyan);
	}

	button {
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1rem;
		background: var(--violet);
		color: var(--marquee);
		border: 2px solid var(--magenta);
		border-radius: 0.5rem;
		padding: 0.6rem 1.25rem;
		min-height: 44px;
		cursor: pointer;
	}
</style>
