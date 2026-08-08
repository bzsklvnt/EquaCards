<script lang="ts">
	let { data } = $props();
</script>

<main>
	<h1>Admin</h1>
	<p>Bejelentkezve mint {data.profile.display_name} (role_id: {data.profile.role_id})</p>
</main>
