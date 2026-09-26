<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import { withToast } from '$lib/toast-enhance';
	import QuestionCanvas from './QuestionCanvas.svelte';
	import QuestionSettings from './QuestionSettings.svelte';
	import { draftError, draftToFormData, type Draft, type QuestionTypeInfo } from './model';

	// A kérdésbank új/szerkesztő oldala: ugyanaz a vászon és beállításpanel,
	// mint a kvízösszerakóban, de hagyományos (Mentés gombos) űrlappal. A
	// rejtett mezők pontosan a draftToFormData készletét küldik, így a szerver
	// ugyanazzal a parseQuestionForm/validateQuestionForm párossal dolgozik.
	let {
		initial,
		types,
		themes,
		readingDefault,
		action,
		error,
		hiddenFields = {},
		cancelHref,
		successMessage
	}: {
		initial: Draft;
		types: QuestionTypeInfo[];
		themes: { id: string; title: string }[];
		readingDefault: number;
		action: string;
		error?: string;
		hiddenFields?: Record<string, string>;
		cancelHref?: string;
		successMessage?: string;
	} = $props();

	let draft = $state<Draft>(untrack(() => structuredClone(initial)));
	let saving = $state(false);
	let canvas = $state<ReturnType<typeof QuestionCanvas>>();

	const fields = $derived([...draftToFormData(draft, types).entries()] as [string, string][]);
	const clientError = $derived(draftError(draft, types));

	function onKeydown(e: KeyboardEvent) {
		const el = e.target as HTMLElement;
		const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
		if (e.altKey && /^Digit[1-8]$/.test(e.code)) {
			e.preventDefault();
			const i = Number(e.code.slice(5)) - 1;
			(document.getElementById(`bq-opt-${i}`) ?? document.getElementById(`bq-item-${i}`))?.focus();
			return;
		}
		if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
		if (/^[1-8]$/.test(e.key)) {
			e.preventDefault();
			canvas?.toggleCorrect(Number(e.key) - 1);
		} else if (e.key === 'Enter' && el.tagName !== 'BUTTON' && el.tagName !== 'A') {
			e.preventDefault();
			document.getElementById('bq-prompt')?.focus();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<form
	method="POST"
	{action}
	class="editor"
	use:enhance={withToast({ setSubmitting: (v) => (saving = v), successMessage })}
>
	{#each Object.entries(hiddenFields) as [name, value] (name)}
		<input type="hidden" {name} {value} />
	{/each}
	{#each fields as [name, value], i (i)}
		<input type="hidden" {name} {value} />
	{/each}

	<div class="main">
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<QuestionCanvas bind:this={canvas} bind:draft {types} />
		<div class="actions" data-tour="qf-save">
			<Button type="submit" loading={saving} disabled={!!clientError}>Mentés</Button>
			{#if cancelHref}<Button variant="ghost" href={cancelHref}>Mégse</Button>{/if}
			{#if clientError}<span class="hint">{clientError}</span>{/if}
		</div>
	</div>
	<aside class="side">
		<QuestionSettings bind:draft {types} {themes} {readingDefault} />
	</aside>
</form>

<style>
	.editor {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 19rem;
		gap: 1.5rem;
		align-items: start;
	}

	.main {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		min-width: 0;
	}

	.side {
		padding: 1rem 1.1rem;
		border: 1px solid var(--panel-border, #e4ded2);
		border-radius: 1rem;
		background: var(--cabinet-2);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.hint {
		color: var(--coin);
		font-size: 0.88rem;
	}

	.error {
		margin: 0;
		color: var(--danger);
	}

	@media (max-width: 1000px) {
		.editor {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
