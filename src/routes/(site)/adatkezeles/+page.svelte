<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Az üzemeltető adatait a rendszergazda a /admin/settings oldalon adja meg
	// (site_operator_name, site_contact_email). Amíg üresek, feltűnő helykitöltő
	// jelenik meg, hogy ne maradjon észrevétlenül hiányos a tájékoztató.
	const operator = $derived(data.site.operatorName);
	const email = $derived(data.site.contactEmail);
</script>

<svelte:head>
	<title>Adatkezelési tájékoztató — {data.site.name}</title>
</svelte:head>

<article class="doc">
	<h1>Adatkezelési tájékoztató</h1>
	<p class="updated">Utolsó módosítás: 2026. szeptember 26.</p>

	<section>
		<h2>Ki kezeli az adatokat?</h2>
		<p>
			Az adatkezelő: {#if operator}<strong>{operator}</strong>{:else}<mark>[ÜZEMELTETŐ NEVE]</mark
				>{/if}, a {data.site.name} kvízestek szervezője. Kapcsolat:
			{#if email}<a href={`mailto:${email}`}>{email}</a>{:else}<mark>[KAPCSOLATI E-MAIL]</mark
				>{/if}.
		</p>
	</section>

	<section>
		<h2>Milyen adatokat kezelünk?</h2>
		<p>Ha csapatot jelentkeztetsz egy kvízestére:</p>
		<ul>
			<li>a csapat neve és létszáma,</li>
			<li>a kapcsolattartó neve és e-mail címe,</li>
			<li>ha megadod: telefonszám és megjegyzés,</li>
			<li>a jelentkezés és a hozzájárulás időpontja.</li>
		</ul>
		<p>
			Játék közben csak a csapat nevét és a leadott válaszokat, pontszámokat tároljuk; ehhez nem
			kérünk személyes adatot.
		</p>
	</section>

	<section>
		<h2>Mire használjuk?</h2>
		<p>
			Kizárólag az este szervezésére: a létszám és a várólista kezelésére, a visszaigazoló, a
			várólistás és a „bekerültetek” értesítő e-mailek kiküldésére, és ha szükséges, az esttel
			kapcsolatos gyakorlati tudnivalók közlésére. Hírlevelet nem küldünk, az adatokat nem adjuk el
			és nem adjuk tovább marketing célra.
		</p>
	</section>

	<section>
		<h2>Jogalap</h2>
		<p>
			A jelentkezéskor adott hozzájárulásod (GDPR 6. cikk (1) bekezdés a) pont). A hozzájárulást
			bármikor visszavonhatod: a visszaigazoló e-mailben lévő lemondási linkkel, vagy a fenti címre
			írt levéllel.
		</p>
	</section>

	<section>
		<h2>Meddig őrizzük?</h2>
		<p>
			A jelentkezési adatokat az este után 30 nappal automatikusan töröljük. A lemondott
			jelentkezések is ekkor törlődnek. Az elmúlt esték listájában a győztes csapat neve és a
			résztvevő csapatok száma megmarad.
		</p>
	</section>

	<section>
		<h2>Kik férnek hozzá?</h2>
		<p>
			A szervezők (a kezelői felületre bejelentkezett munkatársak), valamint az alábbi
			adatfeldolgozók, kizárólag a szolgáltatás működtetéséhez:
		</p>
		<ul>
			<li>
				<strong>Supabase</strong> — adatbázis és tárhely (az adatok az EU-ban, Írországban vannak),
			</li>
			<li><strong>Vercel</strong> — a weboldal futtatása,</li>
			<li><strong>Resend</strong> — az értesítő e-mailek kiküldése.</li>
		</ul>
		<p>
			A Vercel és a Resend amerikai szolgáltató; az adattovábbítás az EU–USA adatvédelmi
			keretrendszer, illetve az Európai Bizottság általános szerződési feltételei alapján történik.
		</p>
	</section>

	<section>
		<h2>Sütik és helyi tárolás</h2>
		<p>
			A nyilvános oldal nem használ követő, statisztikai vagy hirdetési sütiket. Játék közben a
			telefon böngészője egy azonosítót tárol, hogy a csapat újra tudjon csatlakozni, ha megszakad a
			kapcsolat. A kezelői belépés munkamenet-sütit használ.
		</p>
	</section>

	<section>
		<h2>Jogaid</h2>
		<p>
			Kérheted, hogy tájékoztassunk a rólad tárolt adatokról, javítsuk vagy töröljük azokat,
			korlátozzuk a kezelésüket, vagy géppel olvasható formában kiadjuk őket. Kérésedre legkésőbb
			egy hónapon belül válaszolunk.
		</p>
		<p>
			Ha úgy érzed, hogy megsértettük a jogaidat, panaszt tehetsz a Nemzeti Adatvédelmi és
			Információszabadság Hatóságnál (NAIH, 1055 Budapest, Falk Miksa utca 9–11.,
			<a href="https://www.naih.hu" target="_blank" rel="noopener noreferrer">www.naih.hu</a>), vagy
			bírósághoz fordulhatsz.
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
		margin: 0 0 0.6rem;
		padding-left: 1.25rem;
	}

	mark {
		padding: 0 0.25rem;
		background: #f8e3b5;
		color: var(--ink);
		border-radius: 0.2rem;
	}
</style>
