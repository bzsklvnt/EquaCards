<script lang="ts">
	import type { QuestionShowPayload } from '$lib/realtime/protocol';
	import {
		effectivePreset,
		formatClock,
		normalizeLayout,
		normalizeVideo,
		stagePreset,
		youtubeThumbnail
	} from '$lib/questions/layout';
	import TimerRing from './TimerRing.svelte';
	import PixelatedImage from './PixelatedImage.svelte';
	import QuestionAnswerDisplay from './QuestionAnswerDisplay.svelte';
	import YouTubePlayer from './YouTubePlayer.svelte';

	// A kérdés a kivetítőn, a kérdés saját megjelenése szerint (elrendezés,
	// időzítő helye, kör/kérdésszám, betűméret) — docs/features/question-layout.md.
	// A kivetítő és a kvízösszerakó előnézete is ezt használja.
	let {
		question,
		readingLeft = 0,
		secondsLeft = 0,
		duration = null,
		locked = false,
		startTime = null,
		videoElapsed = null,
		videoMuted = true,
		videoReplay = 0,
		preview = false
	}: {
		question: QuestionShowPayload;
		readingLeft?: number;
		secondsLeft?: number;
		/** A válaszidő hossza; null = még nincs időzítő (vagy info dia). */
		duration?: number | null;
		locked?: boolean;
		/** A válaszidő kezdete (pixeles képfelfedéshez). */
		startTime?: string | null;
		/** Ennyi mp-e indult a videó; null = még nem indulhat. */
		videoElapsed?: number | null;
		videoMuted?: boolean;
		videoReplay?: number;
		/** Előnézet (kvízösszerakó): videó helyett bélyegkép, nincs lejátszás. */
		preview?: boolean;
	} = $props();

	const info = $derived(question.question_type === 'info');
	const layout = $derived(normalizeLayout(question.layout));
	const video = $derived(info ? null : normalizeVideo(question.video));
	const chosen = $derived(effectivePreset(layout, { info, video: !!video }));
	const preset = $derived(stagePreset(chosen, !!question.image_url));

	let videoDone = $state(false);
	let lastReplay = $state(0);
	$effect(() => {
		if (videoReplay !== lastReplay) {
			lastReplay = videoReplay;
			videoDone = false;
		}
	});

	const reading = $derived(readingLeft > 0);
	const gated = $derived(!!video?.gate);
	// Videó teljes képernyőn: amíg a klip megy és még nem lehet válaszolni.
	const videoFull = $derived(
		!!video && preset === 'video_full' && !videoDone && (reading || duration === null)
	);
	// A videó teljes nézete után (vagy „Videó + kérdés”-nél) a videó a kérdés mellett marad,
	// amíg le nem ment; „Videó teljes”-nél a klip vége után a kérdés egyedül látszik.
	const videoSide = $derived(!!video && !videoFull && (preset === 'video_split' || !videoDone));
	const showTimer = $derived(!info && duration !== null && !reading);
	const clip = $derived(video ? video.end - video.start : 0);
	const hasImage = $derived(!!question.image_url && !video);
	const choiceCount = $derived(question.options?.length ?? 0);
	// Alacsonyabb kijelzőn (pl. 720p projektor) és videó mellett a „nagy”
	// időzítő a sarokba kerül, hogy a kérdés és a lapok elférjenek.
	let innerHeight = $state(1080);
	const sideLayout = $derived(videoSide || preset === 'image_left' || preset === 'image_right');
	const timerPos = $derived(
		(layout.timer === 'big' &&
			preset !== 'image_bg' &&
			(videoFull || videoSide || innerHeight < 860)) ||
			(layout.timer === 'below' && sideLayout && innerHeight < 860)
			? 'corner'
			: layout.timer
	);
	const corner = $derived(!info && timerPos === 'corner');
	const big = $derived(innerHeight < 860 ? 150 : 200);
</script>

{#snippet counter()}
	<div class="counter">
		<span class="round">{question.round_title}</span>
		{#if info}
			<span class="count">Tudtad?</span>
		{:else}
			<span class="count">{question.order_index} / {question.total_questions}</span>
		{/if}
	</div>
{/snippet}

{#snippet image(big: boolean)}
	{#if question.image_url && question.image_pixelate && !info}
		<PixelatedImage
			--pixel-max-height={big ? '34rem' : '24rem'}
			src={question.image_url}
			{startTime}
			duration={duration ?? 0}
			sharp={locked}
		/>
	{:else if question.image_url}
		<img class="question-image" src={question.image_url} alt="" />
	{/if}
{/snippet}

{#snippet player()}
	{#if video}
		<div class="video" class:full={videoFull}>
			{#if !preview && videoElapsed !== null}
				<YouTubePlayer
					videoId={video.id}
					start={video.start}
					end={video.end}
					muted={videoMuted}
					elapsed={videoElapsed}
					replay={videoReplay}
					onended={() => (videoDone = true)}
				/>
			{/if}
			{#if preview || videoElapsed === null || videoDone}
				<div class="video-still" style={`background-image: url(${youtubeThumbnail(video.id)})`}>
					<span
						>{videoDone
							? 'A klip lement'
							: preview
								? `Videó · ${formatClock(video.start)}–${formatClock(video.end)} (${clip} mp)`
								: 'A videó mindjárt indul'}</span
					>
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet timer(size: number)}
	{#if showTimer}
		<div class="timer">
			{#if locked}
				<p class="locked-label">Lezárva</p>
			{:else}
				<TimerRing {secondsLeft} duration={duration ?? 0} {size} />
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet readingBanner()}
	{#if reading && !info}
		{#if gated && video}
			<div class="video-progress" role="status">
				<div class="bar">
					<div style="width: {Math.min(100, (1 - readingLeft / Math.max(1, clip)) * 100)}%"></div>
				</div>
				<span>A videó után indul a válaszidő · még {readingLeft} mp</span>
			</div>
		{:else}
			<div class="reading" role="status">
				<span class="reading-count">{readingLeft}</span>
				<span>Olvassátok el — a válaszadás mindjárt indul</span>
			</div>
		{/if}
	{/if}
{/snippet}

{#snippet answers(stack: boolean)}
	{#if !info}
		<div class="answers" class:stack class:four={preset === 'image_bg' && choiceCount === 4}>
			<QuestionAnswerDisplay
				questionType={question.question_type}
				options={question.options}
				slider={question.slider}
				orderingItems={question.ordering_items}
				veiled={duration === null || reading}
			/>
		</div>
	{/if}
{/snippet}

<svelte:window bind:innerHeight />

<div
	class="stage"
	class:has-corner={corner}
	data-preset={videoFull
		? 'video_full'
		: videoSide
			? 'video_split'
			: preset === 'video_full' || preset === 'video_split'
				? 'text'
				: preset}
	data-size={layout.size}
	data-timer={timerPos}
	style={preset === 'image_bg' && question.image_url
		? `--bg: url("${question.image_url}")`
		: undefined}
>
	{#if layout.counter === 'top'}{@render counter()}{/if}

	<div class="body">
		{#if info}
			<div class="info-text">
				<h1 class="prompt">{question.prompt}</h1>
				{#if question.info_text}<p class="info-body">{question.info_text}</p>{/if}
			</div>
			{#if question.image_url}
				<div class="media">{@render image(preset === 'info_image')}</div>
			{/if}
		{:else if videoFull}
			<div class="media">{@render player()}</div>
			<div class="caption">
				<h1 class="prompt">{question.prompt}</h1>
				{@render readingBanner()}
			</div>
		{:else if videoSide}
			<div class="media">{@render player()}</div>
			<div class="side">
				<h1 class="prompt">{question.prompt}</h1>
				{@render readingBanner()}
				{#if timerPos === 'below'}{@render timer(110)}{/if}
				{@render answers(true)}
			</div>
		{:else if preset === 'image_left' || preset === 'image_right'}
			<div class="media">{@render image(true)}</div>
			<div class="side">
				<h1 class="prompt">{question.prompt}</h1>
				{@render readingBanner()}
				{#if timerPos === 'below'}{@render timer(110)}{/if}
				{@render answers(true)}
				{#if timerPos === 'big'}{@render timer(Math.min(big, 160))}{/if}
			</div>
		{:else if preset === 'image_bg'}
			{#if timerPos === 'big'}{@render timer(Math.min(big, 170))}{/if}
			<div class="panel">
				<h1 class="prompt">{question.prompt}</h1>
				{@render readingBanner()}
				{#if timerPos === 'below'}{@render timer(110)}{/if}
				{@render answers(false)}
			</div>
		{:else}
			<h1 class="prompt" class:solo={preset === 'text' || !hasImage}>{question.prompt}</h1>
			{@render readingBanner()}
			{#if timerPos === 'below'}{@render timer(110)}{/if}
			{#if preset !== 'text' && hasImage}
				<div class="media">{@render image(false)}</div>
			{/if}
			{@render answers(false)}
			{#if timerPos === 'big'}{@render timer(big)}{/if}
		{/if}
	</div>

	{#if layout.counter === 'bottom'}{@render counter()}{/if}
	{#if corner}
		<div class="corner">{@render timer(96)}</div>
	{/if}
</div>

<style>
	.stage {
		--prompt-scale: 1;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: clamp(0.75rem, 2vh, 1.5rem);
		width: 100%;
		min-height: 100%;
		color: var(--marquee);
		font-family: var(--font-body);
		text-align: center;
	}

	.stage[data-size='large'] {
		--prompt-scale: 1.2;
	}

	.stage[data-size='xl'] {
		--prompt-scale: 1.45;
	}

	.counter {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.6rem 1.2rem;
		border-radius: 0.8rem;
		background: color-mix(in srgb, var(--cabinet-2) 85%, transparent);
		color: var(--marquee-dim);
		font-size: clamp(0.9rem, 1.8vw, 1.35rem);
	}

	.counter .round {
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.counter .count {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: clamp(0.75rem, 2vh, 1.5rem);
		min-height: 0;
	}

	.prompt {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: calc(clamp(1.5rem, 4.2vw, 3.4rem) * var(--prompt-scale));
		line-height: 1.12;
		overflow-wrap: anywhere;
	}

	.prompt.solo {
		font-size: calc(clamp(1.8rem, 5.2vw, 4.4rem) * var(--prompt-scale));
		margin: clamp(0.5rem, 4vh, 3rem) 0;
	}

	.media {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		min-height: 0;
	}

	.question-image {
		display: block;
		max-width: 100%;
		max-height: min(28rem, 36vh);
		border-radius: 0.9rem;
		object-fit: contain;
	}

	.answers {
		width: 100%;
	}

	.answers :global(.answer-options),
	.answers :global(.answer-ordering),
	.answers :global(.answer-slider) {
		margin: 0 auto;
	}

	.answers.stack :global(.answer-options) {
		grid-template-columns: minmax(0, 1fr);
		max-width: none;
	}

	.answers.stack :global(.choice) {
		min-height: 0;
		padding: 0;
	}

	.answers.stack :global(.choice .body) {
		padding: 0.6rem 1rem;
	}

	.answers.four :global(.answer-options) {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.timer {
		display: flex;
		justify-content: center;
	}

	.stage.has-corner .body {
		padding-right: 6.5rem;
	}

	.corner {
		position: absolute;
		top: 4.2rem;
		right: 1rem;
		z-index: 2;
	}

	.locked-label {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1rem, 2.5vw, 1.5rem);
		color: var(--danger);
	}

	.reading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		font-size: clamp(1rem, 2.4vw, 1.6rem);
		color: var(--marquee-dim);
	}

	.reading-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 50%;
		border: 5px solid var(--cyan);
		font-family: var(--font-display);
		font-size: 2.2rem;
		color: var(--marquee);
	}

	/* Kép (vagy videó) oldalt: két oszlop. */
	.stage[data-preset='image_left'] .body,
	.stage[data-preset='image_right'] .body,
	.stage[data-preset='video_split'] .body,
	.stage[data-preset='info_split'] .body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: center;
		gap: clamp(1rem, 3vw, 3rem);
		text-align: left;
	}

	.stage[data-preset='video_split'] .body {
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
	}

	.stage[data-preset='image_right'] .media {
		order: 2;
	}

	.stage[data-preset='image_left'] .question-image,
	.stage[data-preset='image_right'] .question-image {
		max-height: min(36rem, 70vh);
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: clamp(0.6rem, 1.6vh, 1.1rem);
		min-width: 0;
	}

	.side .prompt {
		font-size: calc(clamp(1.3rem, 3vw, 2.6rem) * var(--prompt-scale));
	}

	.side .timer {
		justify-content: flex-start;
	}

	/* Kép háttérben: sötétített teljes háttér, a kérdés egy világos panelen. */
	.stage[data-preset='image_bg'] {
		padding: clamp(0.75rem, 2vh, 1.5rem);
		border-radius: 1.2rem;
		background:
			linear-gradient(rgb(0 0 0 / 45%), rgb(0 0 0 / 45%)),
			var(--bg) center / cover no-repeat;
	}

	.stage[data-preset='image_bg'] .body {
		justify-content: flex-end;
	}

	.stage[data-preset='image_bg'] .timer {
		flex: 1;
		align-items: center;
	}

	.stage[data-preset='image_bg'] .body > .timer :global(.seconds) {
		color: #fff;
	}

	.stage[data-preset='image_bg'] .counter {
		background: rgb(0 0 0 / 35%);
		color: #f2f4f2;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: clamp(1rem, 2.5vh, 1.6rem) clamp(1rem, 2.5vw, 1.8rem);
		border-radius: 1.1rem;
		background: color-mix(in srgb, var(--cabinet-2) 95%, transparent);
	}

	/* Magyarázó dia. */
	.info-text {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		justify-content: center;
	}

	.info-body {
		margin: 0;
		font-size: calc(clamp(1.1rem, 2.2vw, 1.8rem) * var(--prompt-scale));
		line-height: 1.45;
		color: var(--marquee);
		white-space: pre-line;
	}

	.stage[data-preset='info_split'] .media {
		order: 2;
	}

	.stage[data-preset='info_split'] .question-image {
		max-height: min(36rem, 70vh);
	}

	.stage[data-preset='info_image'] .body {
		flex-direction: column-reverse;
		justify-content: flex-end;
	}

	.stage[data-preset='info_image'] .question-image {
		max-height: min(40rem, 62vh);
	}

	.stage[data-preset='info_image'] .info-text {
		gap: 0.5rem;
	}

	.stage[data-preset='info_image'] .prompt {
		font-size: calc(clamp(1.3rem, 3vw, 2.4rem) * var(--prompt-scale));
	}

	/* Videó. */
	.video {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 1rem;
		overflow: hidden;
		background: #0f100e;
	}

	.video.full {
		max-height: 68vh;
		width: auto;
		max-width: 100%;
		margin: 0 auto;
		height: min(68vh, 56vw);
	}

	.video-still {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: flex-end;
		justify-content: flex-start;
		padding: 0.8rem;
		background-color: #0f100e;
		background-size: cover;
		background-position: center;
	}

	.video-still span {
		padding: 0.35rem 0.75rem;
		border-radius: 0.5rem;
		background: rgb(0 0 0 / 65%);
		color: #fff;
		font-size: clamp(0.8rem, 1.4vw, 1.1rem);
		font-weight: 600;
	}

	.caption {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.caption .prompt {
		font-size: calc(clamp(1.2rem, 2.6vw, 2.2rem) * var(--prompt-scale));
	}

	.video-progress {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		color: var(--marquee-dim);
		font-size: clamp(0.9rem, 1.8vw, 1.25rem);
	}

	.video-progress .bar {
		height: 6px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--marquee-dim) 30%, transparent);
		overflow: hidden;
	}

	.video-progress .bar div {
		height: 100%;
		background: var(--cyan);
		transition: width 0.25s linear;
	}

	@media (max-width: 720px) {
		.stage[data-preset] .body {
			display: flex;
			flex-direction: column;
		}
	}
</style>
