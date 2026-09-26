<script lang="ts" module>
	// A YouTube IFrame API egyszer töltődik be oldalanként.
	type YTPlayer = {
		playVideo(): void;
		pauseVideo(): void;
		seekTo(seconds: number, allowSeekAhead: boolean): void;
		mute(): void;
		unMute(): void;
		getCurrentTime(): number;
		destroy(): void;
	};
	type YTNamespace = {
		Player: new (
			el: HTMLElement,
			options: {
				host?: string;
				videoId: string;
				width?: string;
				height?: string;
				playerVars?: Record<string, string | number>;
				events?: {
					onReady?: () => void;
					onStateChange?: (e: { data: number }) => void;
					onError?: (e: { data: number }) => void;
				};
			}
		) => YTPlayer;
	};

	let apiPromise: Promise<YTNamespace> | null = null;

	function loadApi(): Promise<YTNamespace> {
		const w = window as unknown as {
			YT?: YTNamespace & { loaded?: number };
			onYouTubeIframeAPIReady?: () => void;
		};
		if (w.YT?.Player) return Promise.resolve(w.YT);
		if (apiPromise) return apiPromise;
		apiPromise = new Promise((resolve) => {
			const previous = w.onYouTubeIframeAPIReady;
			w.onYouTubeIframeAPIReady = () => {
				previous?.();
				resolve(w.YT as YTNamespace);
			};
			const script = document.createElement('script');
			script.src = 'https://www.youtube.com/iframe_api';
			script.async = true;
			document.head.appendChild(script);
		});
		return apiPromise;
	}
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';

	// YouTube-részlet lejátszása a kivetítőn (docs/features/question-layout.md):
	// csak a [start, end) szakasz, vezérlők és ajánlások nélkül. A lejátszás a
	// kérdés indulásához igazodik (`elapsed` mp-cel később csatlakozó
	// kivetítő onnan folytatja), a `replay` számláló növelése elölről indítja.
	let {
		videoId,
		start,
		end,
		muted = false,
		elapsed = 0,
		replay = 0,
		onended,
		onerror
	}: {
		videoId: string;
		start: number;
		end: number;
		muted?: boolean;
		/** Ennyi másodperce indult a klip (újratöltött kivetítőnél > 0). */
		elapsed?: number;
		replay?: number;
		onended?: () => void;
		onerror?: () => void;
	} = $props();

	let host = $state<HTMLDivElement>();
	let player: YTPlayer | null = null;
	let ready = $state(false);
	let finished = false;

	function finish() {
		if (finished) return;
		finished = true;
		player?.pauseVideo();
		onended?.();
	}

	onMount(() => {
		let cancelled = false;
		let poll: ReturnType<typeof setInterval> | undefined;
		const from = untrack(() => Math.min(end, start + Math.max(0, elapsed)));
		if (from >= untrack(() => end) - 0.5) {
			finish();
			return;
		}
		void loadApi().then((YT) => {
			if (cancelled || !host) return;
			player = new YT.Player(host, {
				host: 'https://www.youtube-nocookie.com',
				videoId: untrack(() => videoId),
				width: '100%',
				height: '100%',
				playerVars: {
					start: Math.floor(from),
					end: untrack(() => end),
					autoplay: 1,
					controls: 0,
					disablekb: 1,
					fs: 0,
					iv_load_policy: 3,
					modestbranding: 1,
					playsinline: 1,
					rel: 0
				},
				events: {
					onReady: () => {
						ready = true;
						if (untrack(() => muted)) player?.mute();
						else player?.unMute();
						player?.playVideo();
					},
					onStateChange: (e) => {
						if (e.data === 0) finish();
					},
					onError: () => onerror?.()
				}
			});
			// Tartalék: az `end` paramétert a YouTube nem mindig tartja be pontosan.
			poll = setInterval(() => {
				if (!ready || finished) return;
				if ((player?.getCurrentTime() ?? 0) >= untrack(() => end) - 0.2) finish();
			}, 250);
		});
		return () => {
			cancelled = true;
			clearInterval(poll);
			player?.destroy();
			player = null;
		};
	});

	$effect(() => {
		if (!ready || !player) return;
		if (muted) player.mute();
		else player.unMute();
	});

	let lastReplay = untrack(() => replay);
	$effect(() => {
		const r = replay;
		if (r === lastReplay || !ready || !player) return;
		lastReplay = r;
		finished = false;
		player.seekTo(start, true);
		player.playVideo();
	});
</script>

<div class="yt">
	<div bind:this={host}></div>
</div>

<style>
	.yt {
		position: relative;
		width: 100%;
		height: 100%;
		background: #0f100e;
	}

	.yt :global(iframe) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}
</style>
