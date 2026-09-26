<script lang="ts">
	import { createSupabaseBrowserClient } from '$lib/supabase';
	import Button from './Button.svelte';

	// Fázis Q6 — kép feltöltés kérdésekhez/válaszlehetőségekhez. A feltöltés
	// előtti kliens-oldali tömörítés (browser-image-compression) csökkenti a
	// Storage-felhasználást és a betöltési időt kocsmai wifi mellett — lásd
	// docs/architecture/DATA_MODEL.md 8a. szakasz.
	const MAX_SIZE_BYTES = 5 * 1024 * 1024;
	const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
	const EXT_BY_TYPE: Record<string, string> = {
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/webp': 'webp'
	};

	let {
		name,
		label,
		compact = false,
		value = $bindable<string | null>(null)
	}: {
		name: string;
		label?: string;
		/** Opció-sorokban: kis gomb, formátum-tipp nélkül. */
		compact?: boolean;
		value?: string | null;
	} = $props();

	let uploading = $state(false);
	let error = $state('');
	let inputEl: HTMLInputElement | undefined = $state();

	async function handleFileChange(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		error = '';

		if (!ALLOWED_TYPES.includes(file.type)) {
			error = 'Csak JPG, PNG vagy WebP formátumú kép tölthető fel.';
			if (inputEl) inputEl.value = '';
			return;
		}
		if (file.size > MAX_SIZE_BYTES) {
			error = 'A kép mérete legfeljebb 5 MB lehet.';
			if (inputEl) inputEl.value = '';
			return;
		}

		uploading = true;
		try {
			const imageCompression = (await import('browser-image-compression')).default;
			const compressed = await imageCompression(file, {
				maxSizeMB: 1,
				maxWidthOrHeight: 1920,
				useWebWorker: true,
				fileType: file.type
			});

			const path = `${crypto.randomUUID()}.${EXT_BY_TYPE[file.type]}`;
			const supabase = createSupabaseBrowserClient();
			const { error: uploadError } = await supabase.storage
				.from('question-images')
				.upload(path, compressed, { contentType: file.type });

			if (uploadError) {
				error = 'Nem sikerült feltölteni a képet, próbáld újra.';
				return;
			}

			const {
				data: { publicUrl }
			} = supabase.storage.from('question-images').getPublicUrl(path);
			value = publicUrl;
		} catch {
			error = 'Nem sikerült feltölteni a képet, próbáld újra.';
		} finally {
			uploading = false;
			if (inputEl) inputEl.value = '';
		}
	}

	function removeImage() {
		value = null;
		error = '';
	}
</script>

<div class="image-upload" class:compact>
	{#if label}<span class="field-label">{label}</span>{/if}
	<input type="hidden" {name} value={value ?? ''} />

	{#if value}
		<div class="preview">
			<img src={value} alt="" />
			<Button variant="ghost" onclick={removeImage}>{compact ? '✕' : 'Kép eltávolítása'}</Button>
		</div>
	{:else}
		<label class="file-button" class:disabled={uploading}>
			<input
				bind:this={inputEl}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				onchange={handleFileChange}
				disabled={uploading}
			/>
			{uploading ? 'Feltöltés…' : compact ? '+ Kép' : 'Kép kiválasztása…'}
		</label>
		{#if !compact}<span class="hint">JPG, PNG vagy WebP, max. 5 MB</span>{/if}
	{/if}

	{#if error}<p class="error">{error}</p>{/if}
</div>

<style>
	.image-upload {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		text-align: left;
	}

	.field-label {
		font-family: var(--font-body);
		font-size: 0.875rem;
		color: var(--marquee-dim);
	}

	/* A natív fájl-input stílus nélküli böngésző-gombja helyett a Button
	   secondary variánsához igazított címke; az input maga láthatatlan, de
	   fókuszálható marad (billentyűzettel is megnyitható). */
	.file-button {
		position: relative;
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0.5rem 1rem;
		box-sizing: border-box;
		border: var(--field-border-width, 2px) solid var(--field-border, var(--marquee-dim));
		border-radius: 0.5rem;
		background: var(--cabinet-2);
		color: var(--marquee);
		font-family: var(--font-body);
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
	}

	.file-button:hover:not(.disabled) {
		border-color: var(--cyan);
		color: var(--cyan);
	}

	.file-button:focus-within {
		outline: 3px solid var(--cyan);
		outline-offset: 2px;
	}

	.file-button.disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.file-button input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.hint {
		font-family: var(--font-body);
		font-size: 0.75rem;
		color: var(--marquee-dim);
	}

	.preview {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.compact .preview {
		gap: 0.25rem;
	}

	.compact .preview img {
		width: 2.75rem;
		height: 2.75rem;
	}

	.compact .file-button {
		white-space: nowrap;
	}

	.preview img {
		width: 4rem;
		height: 4rem;
		object-fit: cover;
		border-radius: 0.375rem;
		border: var(--field-border-width, 2px) solid var(--field-border, var(--marquee-dim));
	}

	.error {
		font-family: var(--font-body);
		font-size: 0.8125rem;
		color: var(--danger);
	}
</style>
