<script lang="ts">
	import { navigating } from '$app/state';
</script>

<!-- Élő tesztből: lassú (szerver-oldali betöltést igénylő) navigációknál —
     pl. a host "Kilépés" linkje — semmi nem jelezte, hogy a kattintás
     megtörtént. Globális, minden felületre érvényes visszajelzés. -->
{#if navigating.to}
	<div class="nav-progress" role="progressbar" aria-label="Oldal betöltése…">
		<div class="bar"></div>
	</div>
{/if}

<style>
	.nav-progress {
		position: fixed;
		inset: 0 0 auto 0;
		height: 3px;
		z-index: 1000;
		overflow: hidden;
		pointer-events: none;
		/* Gyors navigációnál ne villanjon fel. */
		animation: appear 0s linear 150ms both;
	}

	.bar {
		width: 40%;
		height: 100%;
		background: var(--cyan, #35e7ff);
		box-shadow: 0 0 8px var(--cyan, #35e7ff);
		animation: slide 1s ease-in-out infinite;
	}

	@keyframes appear {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slide {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(250%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			width: 100%;
			animation: none;
			opacity: 0.8;
		}
	}
</style>
