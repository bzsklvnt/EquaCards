<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let pin = $state('');

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

<main>
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
	main {
		max-width: 20rem;
		margin: 4rem auto;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	input {
		font-size: 1.5rem;
		text-align: center;
		letter-spacing: 0.25rem;
	}
</style>
