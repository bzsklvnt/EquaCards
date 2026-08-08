<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		BarController,
		LineController,
		CategoryScale,
		LinearScale,
		BarElement,
		LineElement,
		PointElement,
		Tooltip
	} from 'chart.js';

	Chart.register(
		BarController,
		LineController,
		CategoryScale,
		LinearScale,
		BarElement,
		LineElement,
		PointElement,
		Tooltip
	);

	let {
		type,
		labels,
		data,
		label,
		color,
		gridColor,
		textColor,
		yStepSize
	}: {
		type: 'bar' | 'line';
		labels: string[];
		data: number[];
		label: string;
		color: string;
		gridColor: string;
		textColor: string;
		/** Csak kis, ismert tartományú egész-szám metrikákhoz (pl. csapatszám) —
		 * nagyobb/ismeretlen tartományú számláló-adatnál (pl. téma-használat)
		 * ne add meg, mert stepSize:1 nagy értékeknél túl sűrű tengelyt adna;
		 * a `precision: 0` alább önmagában is kizárja a törtszám-tick-eket. */
		yStepSize?: number;
	} = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | undefined;
	let ready = $state(false);

	onMount(() => {
		chart = new Chart(canvas, {
			type,
			data: {
				labels,
				datasets: [
					{
						label,
						data,
						backgroundColor: type === 'bar' ? color : 'transparent',
						borderColor: color,
						borderWidth: 2,
						tension: 0.3,
						pointBackgroundColor: color
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false }
				},
				scales: {
					x: {
						ticks: { color: textColor, maxRotation: 45, minRotation: 0, autoSkip: true },
						grid: { color: gridColor }
					},
					y: {
						ticks: {
							color: textColor,
							precision: 0,
							...(yStepSize ? { stepSize: yStepSize } : {})
						},
						grid: { color: gridColor },
						beginAtZero: true
					}
				}
			}
		});
		ready = true;
	});

	onDestroy(() => {
		chart?.destroy();
	});
</script>

<div class="chart-wrap">
	{#if !ready}
		<p class="loading">Diagram betöltése…</p>
	{/if}
	<canvas bind:this={canvas} class:hidden={!ready}></canvas>
</div>

<style>
	.chart-wrap {
		position: relative;
		width: 100%;
		min-width: 0;
		height: 18rem;
	}

	.loading {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--marquee-dim);
		font-size: 0.85rem;
		margin: 0;
	}

	.hidden {
		visibility: hidden;
	}
</style>
