<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { defaultTokens, getActiveTokens, tokensToCssText } from '$lib/theme/tokens';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let pin = $state('');
	let themeCss = $state(tokensToCssText(defaultTokens));

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
		<Input
			label="PIN kód"
			bind:value={pin}
			inputmode="numeric"
			pattern="[0-9]*"
			maxlength={6}
			required
		/>
		<Button type="submit">Csatlakozás</Button>
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

	/* PIN-mező: a --font-led kijelző-hangulat, ahogy a design system előírja
	   minden szám-jellegű kijelzéshez (timer, pontszám, PIN). */
	form :global(input) {
		font-family: var(--font-led);
		font-size: 1.5rem;
		text-align: center;
		letter-spacing: 0.25rem;
	}
</style>
