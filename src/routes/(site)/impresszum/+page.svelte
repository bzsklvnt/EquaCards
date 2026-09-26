<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Az elektronikus kereskedelmi szolgáltatásokról szóló 2001. évi CVIII.
	// törvény (Ekertv.) 4. §-a szerinti kötelező adatok. A szolgáltató adatait
	// a rendszergazda a /admin/settings oldalon adja meg (site_* kulcsok); amíg
	// hiányoznak, feltűnő helykitöltő jelenik meg.
	const site = $derived(data.site);
</script>

<svelte:head>
	<title>Impresszum — {data.site.name}</title>
</svelte:head>

<article class="doc">
	<h1>Impresszum</h1>

	<section>
		<h2>Szolgáltató</h2>
		<dl>
			<div>
				<dt>Név</dt>
				<dd>
					{#if site.operatorName}{site.operatorName}{:else}<mark>[ÜZEMELTETŐ NEVE]</mark>{/if}
				</dd>
			</div>
			<div>
				<dt>Székhely</dt>
				<dd>
					{#if site.address}{site.address}{:else}<mark>[SZÉKHELY]</mark>{/if}
				</dd>
			</div>
			<div>
				<dt>E-mail</dt>
				<dd>
					{#if site.contactEmail}<a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a
						>{:else}<mark>[KAPCSOLATI E-MAIL]</mark>{/if}
				</dd>
			</div>
			<div>
				<dt>Adószám</dt>
				<dd>
					{#if site.taxNumber}{site.taxNumber}{:else}<mark>[ADÓSZÁM]</mark>{/if}
				</dd>
			</div>
			<div>
				<dt>Nyilvántartás</dt>
				<dd>
					{#if site.registration}{site.registration}{:else}<mark
							>[NYILVÁNTARTÁSI SZÁM ÉS NYILVÁNTARTÓ]</mark
						>{/if}
				</dd>
			</div>
		</dl>
	</section>

	<section>
		<h2>Tárhelyszolgáltató</h2>
		<p>
			<strong>Vercel Inc.</strong><br />
			440 N Barranca Ave #4133, Covina, CA 91723, USA<br />
			<a href="mailto:privacy@vercel.com">privacy@vercel.com</a> ·
			<a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>
		</p>
		<p>
			Az adatbázist a <strong>Supabase Inc.</strong> üzemelteti az Európai Unióban (Írország) —
			<a href="https://supabase.com" target="_blank" rel="noopener noreferrer">supabase.com</a>.
		</p>
	</section>

	<section>
		<h2>Egyéb</h2>
		<p>
			A kvízestek szervezésével kapcsolatos tudnivalók a
			<a href={resolve('/szabalyzat')}>részvételi szabályzatban</a>, a személyes adatok kezelése az
			<a href={resolve('/adatkezeles')}>adatkezelési tájékoztatóban</a> olvasható.
		</p>
	</section>
</article>

<style>
	.doc {
		max-width: 44rem;
		margin: 0 auto;
		padding: 3.5rem 0 1rem;
	}

	h1 {
		margin: 0 0 2rem;
		font-family: var(--serif);
		font-size: clamp(2rem, 4vw, 2.75rem);
		font-weight: 400;
	}

	section {
		padding: 1.25rem 0;
		border-top: 1px solid var(--line);
	}

	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
		font-weight: 600;
	}

	dl {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	dl div {
		display: grid;
		grid-template-columns: 9rem minmax(0, 1fr);
		gap: 1rem;
	}

	dt {
		color: var(--muted);
	}

	dd {
		margin: 0;
		color: var(--ink);
	}

	p {
		margin: 0 0 0.6rem;
		line-height: 1.65;
		color: var(--ink-2);
	}

	mark {
		padding: 0 0.25rem;
		background: #f8e3b5;
		color: var(--ink);
		border-radius: 0.2rem;
	}

	@media (max-width: 520px) {
		dl div {
			grid-template-columns: 1fr;
			gap: 0.1rem;
		}
	}
</style>
