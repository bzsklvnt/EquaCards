<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, children } = $props();
</script>

<nav>
	<a href={resolve('/admin')}>Admin</a>
	<a href={resolve('/admin/themes')}>Témák</a>
	<a href={resolve('/admin/questions')}>Kérdésbank</a>
	<a href={resolve('/admin/games')}>Kvízesték</a>
	<a href={resolve('/admin/design-themes')}>Vizuális témák</a>
	<span class="spacer"></span>
	<span>{data.profile.display_name}</span>
	<form method="POST" action="/logout">
		<button type="submit">Kijelentkezés</button>
	</form>
</nav>

{@render children()}

<style>
	nav {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid #ddd;
		margin-bottom: 1.5rem;
	}

	.spacer {
		flex: 1;
	}
</style>
