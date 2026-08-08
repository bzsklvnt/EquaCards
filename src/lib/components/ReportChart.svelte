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
		textColor
	}: {
		type: 'bar' | 'line';
		labels: string[];
		data: number[];
		label: string;
		color: string;
		gridColor: string;
		textColor: string;
	} = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | undefined;

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
					x: { ticks: { color: textColor }, grid: { color: gridColor } },
					y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
				}
			}
		});
	});

	onDestroy(() => {
		chart?.destroy();
	});
</script>

<div class="chart-wrap">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.chart-wrap {
		position: relative;
		height: 16rem;
	}
</style>
