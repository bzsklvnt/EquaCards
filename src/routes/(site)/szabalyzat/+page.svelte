<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const operator = $derived(data.site.operatorName);
	const email = $derived(data.site.contactEmail);
</script>

<svelte:head>
	<title>Részvételi szabályzat — {data.site.name}</title>
</svelte:head>

<article class="doc">
	<h1>Részvételi szabályzat</h1>
	<p class="updated">Hatályos: 2026. szeptember 26-tól</p>

	<section>
		<h2>1. Általános</h2>
		<p>
			A {data.site.name} kvízesteket
			{#if operator}<strong>{operator}</strong>{:else}<mark>[ÜZEMELTETŐ NEVE]</mark>{/if} (a továbbiakban:
			szervező) rendezi. A kvízestek célja a szórakozás: csapatok mérik össze a tudásukat. A jelentkezéssel
			a csapat kapcsolattartója — a csapat nevében is — elfogadja ezt a szabályzatot.
		</p>
	</section>

	<section>
		<h2>2. Jelentkezés és létszám</h2>
		<ul>
			<li>
				Csapatonként egy jelentkezés kell, 1–12 fővel. A jelentkezést a kapcsolattartó adja le,
				valós névvel és elérhető e-mail címmel.
			</li>
			<li>
				Az esték létszámkorlátja főben értendő. A helyeket a jelentkezés sorrendjében osztjuk ki.
			</li>
			<li>
				Ha a csapat már nem fér be, várólistára kerül. Ha felszabadul elég hely, a várólistán sorban
				bekerülnek azok a csapatok, akiknek a létszáma belefér; erről e-mailt küldünk.
			</li>
			<li>A csapatnév nem lehet sértő, és nem egyezhet meg egy másik csapat nevével.</li>
		</ul>
	</section>

	<section>
		<h2>3. Csapatkód és csatlakozás</h2>
		<ul>
			<li>
				A megerősített csapat a visszaigazoló e-mailben egy 6 karakteres csapatkódot kap. Az estén a
				kivetítőn látható PIN megnyitása után ezzel lehet csatlakozni.
			</li>
			<li>
				A kód a csapaté: ne adjátok tovább. Ha lemerül vagy lecserélitek a telefont, ugyanezzel a
				kóddal léphettek vissza.
			</li>
			<li>
				Előzetes jelentkezés nélkül érkező csapat a helyszínen, szabad hely esetén a kvízmestertől
				kaphat kódot.
			</li>
		</ul>
	</section>

	<section>
		<h2>4. Lemondás</h2>
		<p>
			Ha mégsem tudtok jönni, kérjük, a visszaigazoló e-mailben lévő lemondási linkkel mondjátok le
			a jelentkezést az este kezdéséig, hogy a helyet egy másik csapat megkaphassa.
		</p>
	</section>

	<section>
		<h2>5. Nevezési díj</h2>
		<p>
			Az esetleges nevezési díjat és a fizetés módját az adott este leírása tartalmazza. A
			weboldalon keresztül nem kell fizetni.
		</p>
	</section>

	<section>
		<h2>6. Játékszabályok</h2>
		<ul>
			<li>
				A válaszokat a csapat a saját tudása alapján adja meg: internet, keresők, mesterséges
				intelligencia és más segítség használata tilos.
			</li>
			<li>
				A gyorsabban leadott helyes válasz több pontot érhet. A pontozást és a jokereket a
				kvízmester az este elején ismerteti.
			</li>
			<li>
				Vitás kérdésben a kvízmester dönt, a döntése végleges. Szabálysértés esetén a kvízmester
				pontot vonhat le, vagy kizárhatja a csapatot.
			</li>
		</ul>
	</section>

	<section>
		<h2>7. Eredmények és díjak</h2>
		<ul>
			<li>
				A csapatnevek és a pontszámok az estén a kivetítőn nyilvánosan megjelennek, a győztes csapat
				neve a weboldalon az elmúlt esték között is.
			</li>
			<li>
				Az esetleges díjakat az este leírása vagy a kvízmester ismerteti. A díjak a tudás alapján
				kerülnek kiosztásra, sorsolás nincs; a díj készpénzre nem váltható.
			</li>
		</ul>
	</section>

	<section>
		<h2>8. Helyszín</h2>
		<p>
			A helyszín házirendje minden résztvevőre vonatkozik. 18 év alatti résztvevő alkoholt nem
			fogyaszthat; a kiskorúak részvételéről a helyszín szabályai döntenek.
		</p>
	</section>

	<section>
		<h2>9. Változások</h2>
		<p>
			A szervező fenntartja a jogot, hogy egy este időpontját, helyszínét módosítsa, vagy az estét
			elmaradás esetén elhalassza; erről a jelentkezett csapatokat e-mailben értesíti. A szabályzat
			módosítását a weboldalon tesszük közzé.
		</p>
	</section>

	<section>
		<h2>Kapcsolat</h2>
		<p>
			{#if email}<a href={`mailto:${email}`}>{email}</a>{:else}<mark>[KAPCSOLATI E-MAIL]</mark>{/if}
			· A személyes adatok kezeléséről az
			<a href={resolve('/adatkezeles')}>adatkezelési tájékoztató</a> szól.
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
		margin: 0;
		font-family: var(--serif);
		font-size: clamp(2rem, 4vw, 2.75rem);
		font-weight: 400;
	}

	.updated {
		margin: 0.5rem 0 2rem;
		color: var(--muted);
		font-size: 0.9rem;
	}

	section {
		padding: 1.25rem 0;
		border-top: 1px solid var(--line);
	}

	h2 {
		margin: 0 0 0.6rem;
		font-size: 1.1rem;
		font-weight: 600;
	}

	p,
	li {
		line-height: 1.65;
		color: var(--ink-2);
	}

	p {
		margin: 0 0 0.6rem;
	}

	ul {
		margin: 0;
		padding-left: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	mark {
		padding: 0 0.25rem;
		background: #f8e3b5;
		color: var(--ink);
		border-radius: 0.2rem;
	}
</style>
