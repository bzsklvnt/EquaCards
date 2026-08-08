<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<main>
	<h1>EquaCards — Pub Kvíz</h1>

	{#if data.user}
		<p>Bejelentkezve: {data.user.email}</p>
		<form method="POST" action="/logout">
			<button type="submit">Kijelentkezés</button>
		</form>
	{:else}
		<p><a href={resolve('/login')}>Bejelentkezés / Regisztráció</a></p>
	{/if}
</main>
