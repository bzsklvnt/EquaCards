<script lang="ts">
	import DashboardShell from '$lib/components/DashboardShell.svelte';

	let { data, children } = $props();
</script>

<DashboardShell profile={data.profile} supabase={data.supabase}>
	{@render children()}
</DashboardShell>
