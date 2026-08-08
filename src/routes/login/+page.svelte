<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let mode = $state<'signin' | 'signup'>(
		untrack(() => (form?.mode === 'signup' ? 'signup' : 'signin'))
	);
</script>

<svelte:head>
	<title>Bejelentkezés — EquaCards</title>
</svelte:head>

<main>
	<h1>{mode === 'signin' ? 'Bejelentkezés' : 'Regisztráció'}</h1>

	{#if form?.success}
		<p class="success">{form.message}</p>
	{:else}
		<form method="POST" action={mode === 'signin' ? '?/signin' : '?/signup'} use:enhance>
			{#if mode === 'signup'}
				<label>
					Név
					<input type="text" name="display_name" autocomplete="name" required />
				</label>
			{/if}

			<label>
				Email
				<input type="email" name="email" autocomplete="email" value={form?.email ?? ''} required />
			</label>

			<label>
				Jelszó
				<input
					type="password"
					name="password"
					autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
					minlength="6"
					required
				/>
			</label>

			{#if form?.error}
				<p class="error">{form.error}</p>
			{/if}

			<button type="submit">{mode === 'signin' ? 'Bejelentkezés' : 'Regisztráció'}</button>
		</form>

		{#if mode === 'signin'}
			<p>
				Nincs még fiókod?
				<button type="button" onclick={() => (mode = 'signup')}>Regisztrálj</button>
			</p>
		{:else}
			<p>
				Van már fiókod?
				<button type="button" onclick={() => (mode = 'signin')}>Jelentkezz be</button>
			</p>
		{/if}
	{/if}
</main>

<style>
	main {
		max-width: 24rem;
		margin: 4rem auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.error {
		color: #b91c1c;
	}

	.success {
		color: #15803d;
	}

	button[type='button'] {
		background: none;
		border: none;
		padding: 0;
		color: #2563eb;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
