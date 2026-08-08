<script lang="ts">
	let {
		pin,
		qrDataUrl,
		joinUrl
	}: {
		pin: string;
		qrDataUrl?: string;
		joinUrl?: string;
	} = $props();
</script>

<div class="pin-panel">
	<div class="pin-panel-content">
		<div class="pin">{pin}</div>
		{#if qrDataUrl}
			<img src={qrDataUrl} alt="QR kód a csatlakozáshoz" />
		{/if}
		{#if joinUrl}
			<p class="join-url">{joinUrl}</p>
		{/if}
	</div>
</div>

<style>
	.pin-panel {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		background: var(--cabinet-2);
		border: 2px solid var(--violet);
		border-radius: 1rem;
		padding: 1.5rem 2rem;
		box-shadow: 0 0 24px color-mix(in srgb, var(--violet) 35%, transparent);
		overflow: hidden;
	}

	/* Fázis K — az "arcade panel" mintának (docs/design/STYLE_GUIDE.html)
	   ez a scanline-textúrája hiányzott innen; a többi kártyaszerű
	   elemmel (kérdés-kártya) most már konzisztens. */
	.pin-panel::before {
		content: '';
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			to bottom,
			rgba(255, 255, 255, 0.035) 0px,
			rgba(255, 255, 255, 0.035) 1px,
			transparent 1px,
			transparent 3px
		);
		pointer-events: none;
	}

	.pin-panel-content {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.pin {
		font-family: var(--font-led);
		font-size: clamp(2.5rem, 8vw, 4rem);
		letter-spacing: 0.4rem;
		color: var(--coin);
		text-shadow: 0 0 16px color-mix(in srgb, var(--coin) 50%, transparent);
	}

	img {
		width: min(16rem, 60vw);
		border-radius: 0.5rem;
		background: white;
		padding: 0.5rem;
	}

	.join-url {
		font-family: var(--font-body);
		color: var(--marquee-dim);
		font-size: 0.9rem;
	}
</style>
