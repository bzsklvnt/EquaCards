<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { defaultTokens, tokensToCssText } from '$lib/theme/tokens';
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let mode = $state<'signin' | 'signup'>(
		untrack(() => (form?.mode === 'signup' ? 'signup' : 'signin'))
	);

	let displayName = $state('');
	let email = $state(untrack(() => form?.email ?? ''));
	let password = $state('');

	// A kezelői és belépő felületek mindig a letisztult alaptémát használják.
	const themeCss = tokensToCssText(defaultTokens);
</script>

<svelte:head>
	<title>Bejelentkezés — EquaCards</title>
</svelte:head>

<main class="cabinet" style={themeCss}>
	<h1>{mode === 'signin' ? 'Bejelentkezés' : 'Regisztráció'}</h1>

	{#if form?.success}
		<p class="success">{form.message}</p>
	{:else}
		<form method="POST" action={mode === 'signin' ? '?/signin' : '?/signup'} use:enhance>
			{#if mode === 'signup'}
				<Input
					label="Név"
					name="display_name"
					autocomplete="name"
					bind:value={displayName}
					required
				/>
			{/if}

			<Input
				label="Email"
				type="email"
				name="email"
				autocomplete="email"
				bind:value={email}
				required
			/>

			<Input
				label="Jelszó"
				type="password"
				name="password"
				autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
				bind:value={password}
				minlength={6}
				required
			/>

			{#if form?.error}
				<p class="error">{form.error}</p>
			{/if}

			<Button type="submit">{mode === 'signin' ? 'Bejelentkezés' : 'Regisztráció'}</Button>
		</form>

		{#if mode === 'signin'}
			<p>
				Nincs még fiókod?
				<Button variant="ghost" onclick={() => (mode = 'signup')}>Regisztrálj</Button>
			</p>
		{:else}
			<p>
				Van már fiókod?
				<Button variant="ghost" onclick={() => (mode = 'signin')}>Jelentkezz be</Button>
			</p>
		{/if}
	{/if}
</main>

<style>
	main.cabinet {
		max-width: 24rem;
		margin: 0 auto;
		padding: 4rem 1rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: linear-gradient(160deg, var(--cabinet), var(--cabinet-2) 60%, var(--cabinet-3));
		color: var(--marquee);
		font-family: var(--font-body);
		min-height: 100vh;
	}

	h1 {
		font-family: var(--font-display);
		font-size: 2.1rem;
		font-weight: 400;
		color: var(--marquee);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.error {
		color: var(--danger);
	}

	.success {
		color: var(--power);
	}
</style>
