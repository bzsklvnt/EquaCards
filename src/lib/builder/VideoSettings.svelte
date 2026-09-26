<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		formatClock,
		MAX_VIDEO_CLIP,
		parseClock,
		parseYouTubeId,
		parseYouTubeStart,
		VIDEO_PRESETS,
		type LayoutPreset
	} from '$lib/questions/layout';
	import type { Draft } from './model';

	// YouTube-részlet a kérdéshez (docs/features/question-layout.md): link,
	// kezdés–vége, beágyazhatóság-ellenőrzés, és hogy a válaszidő a klip végén
	// induljon-e, vagy a videó a szokásos olvasási idővel párhuzamosan menjen.
	let { draft = $bindable(), readingDefault }: { draft: Draft; readingDefault: number } = $props();

	type Check = { status: 'ok' | 'blocked' | 'missing' | 'invalid' | 'unknown'; title?: string };

	let link = $state('');
	let linkError = $state<string | null>(null);
	let check = $state<Check | null>(null);
	let checking = $state(false);
	let preview = $state(false);
	let startText = $state('');
	let endText = $state('');

	const video = $derived(draft.video);
	const clip = $derived(video ? video.end - video.start : 0);

	// A mezők a mentett értéket mutatják, amíg a felhasználó nem ír beléjük.
	$effect(() => {
		if (!video) return;
		startText = formatClock(video.start);
		endText = formatClock(video.end);
	});

	// Beágyazhatóság — videónként egyszer (nem reaktív gyorsítótár).
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const checked = new Map<string, Check>();
	$effect(() => {
		const id = video?.id;
		preview = false;
		if (!id) {
			check = null;
			return;
		}
		const cached = checked.get(id);
		if (cached) {
			check = cached;
			return;
		}
		checking = true;
		check = null;
		let cancelled = false;
		fetch(`${resolve('/admin/video')}?id=${encodeURIComponent(id)}`)
			.then((r) => r.json() as Promise<Check>)
			.catch((): Check => ({ status: 'unknown' }))
			.then((result) => {
				checked.set(id, result);
				if (!cancelled) check = result;
			})
			.finally(() => {
				if (!cancelled) checking = false;
			});
		return () => {
			cancelled = true;
		};
	});

	function attach() {
		const id = parseYouTubeId(link);
		if (!id) {
			linkError = 'Ez nem YouTube-link (pl. youtube.com/watch?v=… vagy youtu.be/…).';
			return;
		}
		linkError = null;
		const start = parseYouTubeStart(link) ?? 0;
		draft.video = { id, start, end: start + 20, gate: true };
		if (draft.layout.preset !== 'video_split') draft.layout.preset = 'video_full';
		link = '';
	}

	function commitTimes() {
		if (!draft.video) return;
		const start = parseClock(startText);
		const end = parseClock(endText);
		if (start === null || end === null) {
			linkError = 'Az időt perc:mp formában add meg (pl. 1:23).';
			return;
		}
		linkError = null;
		draft.video = { ...draft.video, start, end };
	}

	function remove() {
		draft.video = null;
		if (VIDEO_PRESETS.some((p) => p.value === draft.layout.preset)) draft.layout.preset = 'classic';
	}

	function setPreset(value: LayoutPreset) {
		draft.layout.preset = value;
	}

	const clipProblem = $derived(
		!video
			? null
			: clip <= 0
				? 'A vége legyen később, mint a kezdete.'
				: clip > MAX_VIDEO_CLIP
					? `Legfeljebb ${MAX_VIDEO_CLIP / 60} perces részlet lehet.`
					: null
	);
</script>

<section class="video" aria-label="YouTube-videó">
	<h3>YouTube-videó</h3>
	{#if !video}
		<form
			class="attach"
			onsubmit={(e) => {
				e.preventDefault();
				attach();
			}}
		>
			<input
				type="url"
				inputmode="url"
				placeholder="YouTube link beillesztése"
				aria-label="YouTube link"
				bind:value={link}
				onpaste={() => setTimeout(attach)}
			/>
			<button type="submit" disabled={!link.trim()}>Hozzáadás</button>
		</form>
		<p class="dim">A videó csak a kivetítőn szól, a telefonokon nem.</p>
	{:else}
		<div class="times">
			<label>
				<span>Kezdés</span>
				<input
					type="text"
					inputmode="numeric"
					bind:value={startText}
					onchange={commitTimes}
					aria-label="Kezdés (perc:mp)"
				/>
			</label>
			<label>
				<span>Vége</span>
				<input
					type="text"
					inputmode="numeric"
					bind:value={endText}
					onchange={commitTimes}
					aria-label="Vége (perc:mp)"
				/>
			</label>
			<span class="clip" class:bad={!!clipProblem}>{clip > 0 ? `${clip} mp` : '—'}</span>
		</div>

		<div class="player">
			{#if preview}
				<iframe
					title="Videó előnézet"
					src={`https://www.youtube-nocookie.com/embed/${video.id}?start=${video.start}&end=${video.end}&autoplay=1&rel=0&playsinline=1`}
					allow="autoplay; encrypted-media; picture-in-picture"
					referrerpolicy="strict-origin-when-cross-origin"
				></iframe>
			{:else}
				<button
					type="button"
					class="thumb"
					style={`background-image: url(https://i.ytimg.com/vi/${video.id}/hqdefault.jpg)`}
					onclick={() => (preview = true)}
				>
					<span>▶ A kivágott rész lejátszása</span>
				</button>
			{/if}
		</div>

		{#if clipProblem}
			<p class="note warn" role="alert">{clipProblem}</p>
		{:else if linkError}
			<p class="note warn" role="alert">{linkError}</p>
		{/if}
		{#if checking}
			<p class="note">Beágyazhatóság ellenőrzése…</p>
		{:else if check?.status === 'ok'}
			<p class="note ok">
				<b>Beágyazható.</b>
				{check.title}
			</p>
		{:else if check?.status === 'blocked'}
			<p class="note warn" role="alert">
				A videó tulajdonosa letiltotta a beágyazást — a kivetítőn nem fog lejátszódni. Válassz másik
				feltöltést.
			</p>
		{:else if check?.status === 'missing' || check?.status === 'invalid'}
			<p class="note warn" role="alert">A videó nem található (törölt vagy privát).</p>
		{:else if check?.status === 'unknown'}
			<p class="note">A beágyazhatóságot most nem sikerült ellenőrizni.</p>
		{/if}

		<h3 class="sub">Válaszidő indulása</h3>
		<div class="segmented" role="radiogroup" aria-label="Válaszidő indulása">
			<button
				type="button"
				role="radio"
				aria-checked={video.gate}
				class:active={video.gate}
				onclick={() => draft.video && (draft.video.gate = true)}>A videó után</button
			>
			<button
				type="button"
				role="radio"
				aria-checked={!video.gate}
				class:active={!video.gate}
				onclick={() => draft.video && (draft.video.gate = false)}>Videó közben</button
			>
		</div>
		<p class="dim">
			{#if video.gate}
				A telefonokon a lapok a klip végéig inaktívak; a {clip > 0 ? `${clip} mp-es` : ''} klip után indul
				a {draft.time_limit_seconds} mp válaszidő.
			{:else}
				A videó a kérdéssel együtt indul; {draft.reading_seconds ?? readingDefault} mp olvasás után már
				lehet válaszolni, a videó közben tovább megy.
			{/if}
		</p>

		<h3 class="sub">Videó a kivetítőn</h3>
		<div class="segmented" role="radiogroup" aria-label="Videó megjelenése">
			{#each VIDEO_PRESETS as p (p.value)}
				<button
					type="button"
					role="radio"
					aria-checked={draft.layout.preset === p.value ||
						(p.value === 'video_full' && draft.layout.preset !== 'video_split')}
					class:active={draft.layout.preset === p.value ||
						(p.value === 'video_full' && draft.layout.preset !== 'video_split')}
					onclick={() => setPreset(p.value)}>{p.label}</button
				>
			{/each}
		</div>

		<button type="button" class="remove" onclick={remove}>Videó eltávolítása</button>
	{/if}
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	h3 {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--marquee-dim);
	}

	h3.sub {
		margin-top: 0.4rem;
	}

	p {
		margin: 0;
		line-height: 1.45;
	}

	.dim {
		color: var(--marquee-dim);
		font-size: 0.82rem;
	}

	.attach {
		display: flex;
		gap: 0.4rem;
	}

	input {
		min-width: 0;
		height: 2.3rem;
		box-sizing: border-box;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.5rem;
		padding: 0 0.55rem;
		font: inherit;
		color: var(--marquee);
		background: var(--cabinet-2);
	}

	.attach input {
		flex: 1;
	}

	button {
		font: inherit;
		cursor: pointer;
	}

	.attach button,
	.remove {
		min-height: 2.3rem;
		padding: 0 0.8rem;
		border: 1px solid var(--field-border, #d5cec0);
		border-radius: 0.55rem;
		background: var(--cabinet-2);
		color: var(--marquee);
	}

	.attach button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.remove {
		color: var(--danger);
		border-color: color-mix(in srgb, var(--danger) 35%, var(--cabinet-2));
	}

	.times {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
	}

	.times label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--marquee-dim);
	}

	.times input {
		width: 5rem;
		font-variant-numeric: tabular-nums;
	}

	.clip {
		margin-left: auto;
		padding-bottom: 0.5rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.clip.bad {
		color: var(--danger);
	}

	.player {
		aspect-ratio: 16 / 9;
		border-radius: 0.6rem;
		overflow: hidden;
		background: #1b1c1a;
	}

	.player iframe {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
	}

	.thumb {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: flex-end;
		padding: 0.6rem;
		border: 0;
		background-color: #1b1c1a;
		background-size: cover;
		background-position: center;
		color: #fff;
	}

	.thumb span {
		padding: 0.3rem 0.6rem;
		border-radius: 0.4rem;
		background: rgb(0 0 0 / 65%);
		font-size: 0.82rem;
		font-weight: 600;
	}

	.note {
		padding: 0.5rem 0.65rem;
		border-radius: 0.5rem;
		background: var(--cabinet);
		font-size: 0.82rem;
	}

	.note.ok {
		background: color-mix(in srgb, var(--cyan) 12%, var(--cabinet-2));
	}

	.note.warn {
		background: color-mix(in srgb, #c77c1e 16%, var(--cabinet-2));
	}

	.segmented {
		display: inline-flex;
		align-self: flex-start;
		padding: 3px;
		border-radius: 0.6rem;
		background: var(--cabinet);
	}

	.segmented button {
		height: 2rem;
		padding: 0 0.7rem;
		border: 0;
		border-radius: 0.45rem;
		background: transparent;
		color: var(--marquee-dim);
	}

	.segmented button.active {
		background: var(--cabinet-2);
		color: var(--marquee);
		font-weight: 700;
		box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
	}

	input:focus-visible,
	button:focus-visible {
		outline: 3px solid var(--cyan);
		outline-offset: 1px;
	}
</style>
