<script module lang="ts">
	export type ShortcutGroup = { title: string; items: { label: string; keys: string[] }[] };
</script>

<script lang="ts">
	// Billentyűparancs-súgó (? billentyű) — a kvízösszerakó és az élő
	// lebonyolítás közös modálja. A csoportokat a hívó adja.

	let {
		open = $bindable(false),
		title,
		note,
		groups
	}: {
		open?: boolean;
		title: string;
		note?: string;
		groups: ShortcutGroup[];
	} = $props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	class="shortcut-help"
	aria-labelledby="shortcut-help-title"
	onclose={() => (open = false)}
>
	<div class="head">
		<div>
			<h2 id="shortcut-help-title">{title}</h2>
			{#if note}<p>{note}</p>{/if}
		</div>
		<button type="button" onclick={() => (open = false)}>Bezárás · Esc</button>
	</div>
	<div class="groups">
		{#each groups as group (group.title)}
			<section>
				<h3>{group.title}</h3>
				{#each group.items as item (item.label)}
					<div class="row">
						<span>{item.label}</span>
						<span class="keys">
							{#each item.keys as key (key)}<kbd>{key}</kbd>{/each}
						</span>
					</div>
				{/each}
			</section>
		{/each}
	</div>
</dialog>

<style>
	.shortcut-help {
		width: min(62rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		box-sizing: border-box;
		padding: 1.6rem 1.8rem;
		border: 0;
		border-radius: 1.2rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		font-family: var(--font-body);
		box-shadow: 0 30px 60px rgb(0 0 0 / 30%);
	}

	.shortcut-help::backdrop {
		background: rgb(28 27 24 / 55%);
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.2rem;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 1.75rem;
	}

	.head p {
		margin: 0.3rem 0 0;
		color: var(--marquee-dim);
		font-size: 0.9rem;
	}

	.head button {
		flex-shrink: 0;
		min-height: 2.4rem;
		padding: 0 0.9rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.55rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		font: inherit;
		cursor: pointer;
	}

	.groups {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.1rem 2rem;
	}

	h3 {
		margin: 0 0 0.3rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--panel-border, #e4ded2);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--cyan);
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.3rem 0;
		font-size: 0.92rem;
	}

	.keys {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	kbd {
		min-width: 1.6rem;
		height: 1.6rem;
		box-sizing: border-box;
		padding: 0 0.45rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--field-border, #d5cec0);
		border-bottom-width: 3px;
		border-radius: 0.4rem;
		background: var(--cabinet);
		font-family: ui-monospace, monospace;
		font-size: 0.78rem;
		white-space: nowrap;
	}

	@media (max-width: 720px) {
		.groups {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
