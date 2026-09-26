// Oldalankénti bemutatók (a "Bemutató ▶" gombbal indíthatók, docs/features/guided-tours.md).
// Az `element` egy `data-tour="…"` jelölésű elemre mutat; ha nincs megadva,
// a buborék a képernyő közepén jelenik meg. A nem látható elemekhez tartozó
// lépések futáskor kimaradnak (src/lib/tours/run.ts).

export type TourStep = {
	element?: string;
	title: string;
	description: string;
	side?: 'top' | 'right' | 'bottom' | 'left';
};

export type TourId =
	| 'dashboard'
	| 'themes'
	| 'questions'
	| 'question-form'
	| 'games'
	| 'game-setup'
	| 'game-event'
	| 'venues'
	| 'host-lobby'
	| 'host-live'
	| 'results'
	| 'design-themes'
	| 'design-theme-editor'
	| 'users'
	| 'settings'
	| 'reports'
	| 'report-detail';

export const TOURS: Record<TourId, { title: string; steps: TourStep[] }> = {
	dashboard: {
		title: 'Első lépések',
		steps: [
			{
				title: 'Üdv a kezelőfelületen!',
				description:
					'Ez a bemutató végigvezet a menün. Minden oldalnak saját bemutatója van: bármikor újraindíthatod a jobb felső „Bemutató ▶” gombbal.'
			},
			{
				element: 'nav-themes',
				title: 'Témák',
				description:
					'Tartalmi kategóriák, például Sport vagy Zene. A kérdéseket ezekhez rendeled, és egy estére témánként lehet random kérdéseket húzni. Érdemes ezzel kezdeni.'
			},
			{
				element: 'nav-questions',
				title: 'Kérdésbank',
				description:
					'Az összes kérdés egy helyen, öt kérdéstípussal. Egy kérdést több estén is fel lehet használni.'
			},
			{
				element: 'nav-design-themes',
				title: 'Vizuális témák',
				description:
					'A kinézet (színek, betűtípusok) a host, a kivetítő és a telefonok felületén. Független a tartalmi témáktól.'
			},
			{
				element: 'nav-games',
				title: 'Kvízesték',
				description:
					'Itt hozod létre az estéket, állítod össze a köröket és a kérdéseket, és innen indítod az élő játékot. Itt találod a Próbaeste gombot is.'
			},
			{
				element: 'nav-venues',
				title: 'Helyszínek',
				description:
					'A kvízesték helyszínei (név, cím, térkép-link). Az estéknél ebből a listából választasz, és a nyilvános oldalon is ez jelenik meg.'
			},
			{
				element: 'nav-users',
				title: 'Felhasználók',
				description: 'Ki mit érhet el: itt osztod ki a szerepköröket. Csak a Rendszergazda látja.'
			},
			{
				element: 'nav-settings',
				title: 'Beállítások',
				description:
					'Globális alapértékek, például az alapértelmezett kinézet. Csak a Rendszergazda látja.'
			},
			{
				element: 'nav-reports',
				title: 'Riportok',
				description: 'A lezárult esték eredményei és összesített statisztikái.'
			},
			{
				element: 'tour-button',
				title: 'Bemutató gomb',
				description:
					'Minden oldalon itt indítod az adott oldal bemutatóját. A rózsaszín pont azt jelzi, hogy ebben a böngészőben még nem nézted meg.'
			},
			{
				title: 'Javasolt sorrend egy új estéhez',
				description:
					'1. Témák → 2. Kérdésbank → 3. Kvízesték: körök és kérdések → 4. Élő lebonyolítás → 5. Riportok.<br><br>Tipp: először hozz létre egy Próbaestét a Kvízesték oldalon, és azon kattints végig mindent.'
			}
		]
	},

	themes: {
		title: 'Témák',
		steps: [
			{
				element: 'theme-create',
				title: 'Új téma',
				description:
					'Írd be a nevét (pl. „Zene – 90-es évek”), majd Hozzáadás. A témát a kérdés szerkesztésekor választod ki.'
			},
			{
				element: 'theme-list',
				title: 'A témák listája',
				description:
					'Törölni csak olyan témát lehet, amelyhez már nem tartozik kérdés. Előbb a kérdéseket tedd át másik témába.'
			},
			{
				title: 'Tartalmi vagy vizuális téma?',
				description:
					'Az itteni témák a kérdések tartalmát csoportosítják. A kinézetet a Vizuális témák menüpont kezeli, a kettő független egymástól.'
			}
		]
	},

	questions: {
		title: 'Kérdésbank',
		steps: [
			{
				element: 'q-filter',
				title: 'Témaszűrő',
				description:
					'Csak egy téma kérdéseit mutatja. Az „összes” választással minden kérdés látszik.'
			},
			{
				element: 'q-new',
				title: 'Új kérdés',
				description: 'Megnyitja a kérdés-űrlapot. Ott is van saját bemutató.'
			},
			{
				element: 'q-table',
				title: 'A kérdések listája',
				description: 'Kérdés, téma, típus és alappontszám. A legutóbb felvett kérdés van felül.'
			},
			{
				element: 'q-last-used',
				title: 'Utoljára játszva',
				description:
					'Ha egy kérdés bekerül egy estébe, a random húzás egy ideig nem választja újra (alapból 6 hónapig, a Beállításokban módosítható). Kézzel viszont bármikor hozzáadhatod egy körhöz.'
			},
			{
				element: 'q-row-actions',
				title: 'Szerkesztés és törlés',
				description:
					'Figyelem: egy már lejátszott kérdés törlése a korábbi esték részletes eredményeiből is eltávolítja az arra adott válaszokat. Ha csak javítani kell, használd a Szerkesztést.'
			}
		]
	},

	'question-form': {
		title: 'Kérdés szerkesztése',
		steps: [
			{
				element: 'qf-round-context',
				title: 'Egyenesen a körbe',
				description:
					'Ezt az űrlapot egy kvízeste köréből nyitottad meg: mentés után a kérdés a kérdésbankba és a kör végére is bekerül, majd visszavisz az estére.'
			},
			{
				element: 'qf-theme',
				title: 'Téma',
				description:
					'A kérdésbank szűréséhez és a random húzáshoz kell. Téma nélküli kérdés is menthető, de azt a random húzás nem választja ki.'
			},
			{
				element: 'qf-type',
				title: 'Kérdéstípus',
				description:
					'<b>Feleletválasztós:</b> 4 opció, 1 helyes.<br><b>Több helyes:</b> 6–8 opció, több is helyes lehet.<br><b>Igaz/Hamis.</b><br><b>Csúszka:</b> szám becslése tűréshatárral.<br><b>Sorrendbe állítás.</b><br>A típustól függően változik az űrlap alsó része.'
			},
			{
				element: 'qf-prompt',
				title: 'A kérdés szövege',
				description: 'Ez jelenik meg a kivetítőn és a csapatok telefonján.'
			},
			{
				element: 'qf-image',
				title: 'Kép a kérdéshez',
				description:
					'Opcionális. JPG, PNG vagy WebP, legfeljebb 5 MB; feltöltés előtt automatikusan tömörítjük.'
			},
			{
				element: 'qf-pixelate',
				title: 'Pixeles felfedés',
				description:
					'Bekapcsolva a kép erősen pixelesen indul, és a visszaszámlálás alatt élesedik. Aki korábban felismeri, több pontot kap (ha a pontcsökkenés be van kapcsolva).'
			},
			{
				element: 'qf-scoring',
				title: 'Pontozás és idő',
				description:
					'<b>Pontszám:</b> ennyit ér a helyes válasz.<br><b>Pont-szorzó:</b> 2 = dupla pontos kérdés.<br><b>Időlimit:</b> ennyi idő van válaszolni.<br><b>Pontcsökkenés:</b> az azonnali helyes válasz a teljes pontot, a limit végén adott már csak a felét éri.<br>A csapatok egyszeri „Duplázás” jokere erre még rászoroz.'
			},
			{
				element: 'qf-answers',
				title: 'Válaszok',
				description:
					'Feleletválasztósnál jelöld be a „Helyes” opció(ka)t, és opciónként képet is tehetsz („+ Kép”). Csúszkánál a helyes érték és a tűréshatár, sorrendnél a helyes sorrend (felülről lefelé) számít.'
			},
			{
				element: 'qf-save',
				title: 'Mentés',
				description:
					'Mentés előtt ellenőrizzük, hogy minden kötelező mező ki van-e töltve és van-e helyes válasz. A Mégse visszavisz mentés nélkül.'
			}
		]
	},

	'game-event': {
		title: 'Esemény és jelentkezések',
		steps: [
			{
				element: 'ev-settings',
				title: 'Esemény adatai',
				description:
					'Időpont (magyar idő szerint), helyszín és létszámkorlát főben. Ha a korlátot megemeled és mentesz, a várólistáról sorban bekerülnek azok, akik beleférnek, és e-mailt kapnak.',
				side: 'left'
			},
			{
				element: 'ev-public',
				title: 'Nyilvános',
				description:
					'Bekapcsolva az este megjelenik a kezdőlapon, és a kezdésig lehet rá jelentkezni. Időpont nélkül nem lehet nyilvános.',
				side: 'left'
			},
			{
				element: 'ev-join-code',
				title: 'Csatlakozás csapatkóddal',
				description:
					'Bekapcsolva az estén csak a jelentkezéskor kapott 6 karakteres csapatkóddal lehet csatlakozni — a PIN önmagában nem elég. A kóddal a játék indulása után is be lehet lépni, és egy csapat másik telefonról is visszaléphet vele.',
				side: 'left'
			},
			{
				element: 'ev-theme',
				title: 'Megjelenés',
				description:
					'Az este vizuális témája a kivetítőn, a host és a csapatok felületén. Alapból Letisztult; buli-hangulathoz válaszd az Arcade (fun) témát.',
				side: 'left'
			},
			{
				element: 'ev-stats',
				title: 'Létszám',
				description:
					'A megerősített csapatok összlétszáma a korláthoz képest, a várólista és a szabad helyek.'
			},
			{
				element: 'ev-table',
				title: 'Jelentkezések',
				description:
					'A csapatok a kapcsolattartó adataival. Lemondáskor a várólistáról automatikusan bekerül, aki belefér; a „Beenged” a korláttól függetlenül beenged egy várólistás csapatot. Mindkét esetben e-mail megy a csapatnak.'
			},
			{
				element: 'ev-walkin',
				title: 'Helyszíni csapat',
				description:
					'Előzetes jelentkezés nélkül érkezett csapatnak itt kérsz csapatkódot — ezt mondd meg nekik. A host lobbyban is megteheted.'
			},
			{
				element: 'tab-rounds',
				title: 'Körök és kérdések',
				description: 'Itt állítod össze az este köreit és kérdéseit.'
			}
		]
	},
	venues: {
		title: 'Helyszínek',
		steps: [
			{
				element: 'venues-create',
				title: 'Új helyszín',
				description:
					'Név, cím és város. A térkép-link nem kötelező — ha üres, a nyilvános oldal a címből keres a térképen.',
				side: 'left'
			},
			{
				element: 'venues-list',
				title: 'Helyszínek listája',
				description:
					'Szerkesztés és törlés. Törléskor a hozzá tartozó esték megmaradnak, csak a helyszínük lesz üres.'
			}
		]
	},
	games: {
		title: 'Kvízesték',
		steps: [
			{
				element: 'games-create',
				title: 'Új kvízeste',
				description:
					'Adj nevet az estének. Létrehozás után az esemény adatai jönnek (időpont, helyszín, létszámkorlát), majd a körök összeállítása.'
			},
			{
				element: 'games-practice',
				title: 'Próbaeste',
				description:
					'Egy kattintással létrehoz egy gyakorló estét 2 körrel és mintakérdésekkel. Nyugodtan végigjátszhatod telefonnal és kivetítővel; a riportokban nem jelenik meg.'
			},
			{
				element: 'games-list',
				title: 'Az esték listája',
				description:
					'A névre kattintva nyílik az este összeállítása. A kártyán a PIN-kód és a csatlakozott csapatok száma látszik.'
			},
			{
				element: 'games-status',
				title: 'Állapot',
				description:
					'<b>Váró:</b> a csapatok csatlakozhatnak.<br><b>Aktív:</b> a játék fut.<br><b>Lezárva:</b> vége, az eredmények a riportokban.'
			},
			{
				element: 'games-reopen',
				title: 'Újranyitás',
				description:
					'Egy lezárt estét vissza lehet állítani Váró állapotba, ha folytatni vagy megismételni szeretnéd. Ugyanez a gomb az este saját oldalán, a fejlécben is megvan.'
			}
		]
	},

	'game-setup': {
		title: 'Kvízeste összeállítása',
		steps: [
			{
				title: 'Így épül fel egy este',
				description:
					'Egy este körökből áll, minden körben kérdésekkel. A kérdéseket húzhatod véletlenszerűen egy témából, válogathatod kézzel a kérdésbankból, vagy létrehozhatsz újat helyben.'
			},
			{
				element: 'gs-add-round',
				title: 'Új kör',
				description: 'Adj nevet a körnek (pl. „Sport”), majd „+ Kör hozzáadása”.'
			},
			{
				element: 'gs-draw-all',
				title: 'Random kérdések minden körbe',
				description:
					'Válassz témát, és minden kör megkapja a saját darabszámának megfelelő véletlen kérdést. Ha újra megnyomod, további kérdéseket ad hozzá, nem cseréli le a meglévőket.'
			},
			{
				element: 'gs-count',
				title: 'Darabszám',
				description: 'Hány kérdést húzzon ebbe a körbe a random betöltés.'
			},
			{
				element: 'gs-pick',
				title: 'Kézi válogatás vagy új kérdés',
				description:
					'„+ Kérdés a kérdésbankból”: téma és keresés alapján több kérdést is kijelölhetsz.<br>„+ Új kérdés ehhez a körhöz”: felugró ablakban új kérdést írsz, mentéskor egyből a kör végére kerül, és az oldalon maradsz.'
			},
			{
				element: 'gs-question-list',
				title: 'A kör kérdései',
				description:
					'Ebben a sorrendben kerülnek sorra. Az „Eltávolítás” csak a körből veszi ki a kérdést, a kérdésbankban megmarad.'
			},
			{
				element: 'gs-clear',
				title: 'Összes kérdés törlése',
				description:
					'Egy mozdulattal kiüríti a kört (a kérdések a kérdésbankban maradnak). Utána újratöltheted.'
			},
			{
				element: 'gs-delete-round',
				title: 'Kör törlése',
				description: 'A kört és a benne lévő kérdés-hozzárendeléseket törli.'
			},
			{
				element: 'tab-event',
				title: 'Esemény és jelentkezések',
				description:
					'Időpont, helyszín, létszámkorlát, nyilvánosság és megjelenés (Letisztult vagy Arcade), valamint a csapatjelentkezések és a várólista. Az „Eredmények” fülön körönként és kérdésenként látod, melyik csapat mit válaszolt.'
			},
			{
				element: 'game-reopen',
				title: 'Kvízeste újranyitása',
				description:
					'Lezárt estén jelenik meg: Váró állapotba állítja vissza az estét, hogy újra elindíthasd.'
			},
			{
				element: 'gs-open-host',
				title: 'Élő lebonyolítás',
				description:
					'Ezzel indul a játék: megnyílik a host felület a PIN-kóddal. Az estét később is szerkesztheted, de a már futó kérdést ne módosítsd.'
			}
		]
	},

	'host-lobby': {
		title: 'Host – várakozás',
		steps: [
			{
				title: 'A kvízmester felülete',
				description:
					'Ezt a laptopon használod. A kérdéseket a kivetítő (TV mód) mutatja, a csapatok a saját telefonjukon válaszolnak.'
			},
			{
				element: 'hl-pin',
				title: 'Csatlakozás',
				description:
					'A csapatok a QR-kód beolvasásával vagy a /play oldalon a PIN-kód beírásával csatlakoznak, majd csapatnevet adnak meg.'
			},
			{
				element: 'hl-tv',
				title: 'Kivetítő',
				description:
					'Új lapon nyitja meg a TV módot. Húzd át a kivetítőre, és tedd teljes képernyőre (F11). A kivetítőn nincs mit kezelni, mindent innen vezérelsz.'
			},
			{
				element: 'hl-theme',
				title: 'Az este kinézete',
				description:
					'Ha itt választasz vizuális témát, az azonnal megjelenik a kivetítőn és a telefonokon is.'
			},
			{
				element: 'hl-codes',
				title: 'Csapatkódok',
				description:
					'Csapatkódos estén itt látod a megerősített csapatok kódjait (ha valaki nem találja az e-mailt), és azt, ki lépett már be. Helyszíni csapatnak itt kérhetsz kódot.'
			},
			{
				element: 'hl-teams',
				title: 'Csatlakozott csapatok',
				description:
					'Élőben frissül. Ha egy telefon lecsatlakozik, ugyanarról a telefonról automatikusan vissza tud lépni.'
			},
			{
				element: 'host-status',
				title: 'Kapcsolat',
				description:
					'Zöld: minden rendben. Sárga: újracsatlakozás folyamatban. Piros: nincs kapcsolat.'
			},
			{
				element: 'hl-start',
				title: 'Kvíz indítása',
				description:
					'Elindítja az első kört. Indítás után új csapat már nem csatlakozhat, a már csatlakozottak viszont vissza tudnak lépni.'
			},
			{
				element: 'host-exit',
				title: 'Kilépés',
				description: 'Visszavisz az este összeállításához. A játék állapota megmarad.'
			}
		]
	},

	'host-live': {
		title: 'Host – élő játék',
		steps: [
			{
				element: 'hlv-progress',
				title: 'Hol tartunk',
				description: 'Az aktuális kör és kérdés sorszáma.'
			},
			{
				element: 'hlv-question',
				title: 'Az aktuális kérdés',
				description:
					'Te itt látod a kérdést (és a képét élesen); a csapatok ugyanezt látják a kivetítőn és a telefonjukon.'
			},
			{
				element: 'hlv-timer',
				title: 'Visszaszámlálás',
				description:
					'A kérdéssel együtt automatikusan indul, és egy közös szerveridőhöz igazodik, ezért a kivetítőn és a telefonokon is ugyanannyit mutat.'
			},
			{
				element: 'hlv-submissions',
				title: 'Beérkezett válaszok',
				description:
					'Ha minden csapat válaszolt, vagy lejár az idő, a kérdés magától lezárul, és megjelenik a megoldás.'
			},
			{
				element: 'hlv-controls',
				title: 'Vezérlés',
				description:
					'Mindig az aktuális lépés gombja látszik: „Következő kérdés”, vészhelyzetre „Zárás most” és „Megoldás feltárása”, a kör végén „Kör eredményének feltárása”, a legvégén „Végeredmény feltárása” és „Játék lezárása”.'
			},
			{
				element: 'hlv-teams',
				title: 'Csapatok',
				description:
					'Ha egy csapat beveti az egyszeri „Duplázás” jokerét, itt fent egy üzenet jelzi. Az a csapat erre a kérdésre dupla pontot kap.'
			},
			{
				title: 'A végén',
				description:
					'A lezárt este eredményei a Riportokban és a Részletes eredményekben láthatók. Ha újra kell játszani, a Kvízesték oldalon újranyitható.'
			}
		]
	},

	results: {
		title: 'Részletes eredmények',
		steps: [
			{
				element: 'game-reopen',
				title: 'Kvízeste újranyitása',
				description:
					'Lezárt estén jelenik meg: Váró állapotba állítja vissza az estét, hogy újra elindíthasd.'
			},
			{
				title: 'Csak a kezelő látja',
				description:
					'Ez a bontás soha nem jelenik meg a kivetítőn vagy a csapatok telefonján; ott csak a Top 3 és a végeredmény látszik.'
			},
			{
				element: 'res-round',
				title: 'Körönként, kérdésenként',
				description: 'Minden kérdés alatt táblázat mutatja az összes csapatot.'
			},
			{
				element: 'res-correct',
				title: 'Helyes válasz',
				description: 'Összevetéshez a kérdés helyes válasza.'
			},
			{
				element: 'res-table',
				title: 'A csapatok válaszai',
				description:
					'Mit küldött be a csapat, helyes volt-e, hány pontot kapott (pontcsökkenés, szorzó és joker után), és mennyi idő alatt válaszolt.'
			}
		]
	},

	'design-themes': {
		title: 'Vizuális témák',
		steps: [
			{
				element: 'dt-hint',
				title: 'Mi a vizuális téma?',
				description:
					'Színek és betűtípusok a host, a kivetítő és a telefonok felületén. Bármelyik este bármelyik témát használhatja.'
			},
			{
				element: 'dt-new',
				title: 'Új téma',
				description: 'Létrehoz egy új kinézetet. A szerkesztőnek is van saját bemutatója.'
			},
			{
				element: 'dt-list',
				title: 'A témák',
				description:
					'A névre kattintva szerkesztheted. Az alapértelmezett témát nem lehet törölni; előbb jelölj ki másikat alapértelmezettnek.'
			},
			{
				title: 'Hol választod ki?',
				description:
					'Estéhez a host felületén, várakozás közben („Vizuális köntös”). Ha ott nem választasz, az alapértelmezett érvényes, amit a Beállításokban is átállíthatsz.'
			}
		]
	},

	'design-theme-editor': {
		title: 'Vizuális téma szerkesztése',
		steps: [
			{
				element: 'dte-title',
				title: 'Név',
				description: 'Így jelenik meg a témaválasztókban.'
			},
			{
				element: 'dte-default',
				title: 'Alapértelmezett',
				description:
					'Ha bejelölöd, minden olyan este ezt használja, amelyhez a host nem választott külön témát.'
			},
			{
				element: 'dte-tokens',
				title: 'Színek és betűtípusok',
				description:
					'Kulcs–érték párok. Például: <code>--cabinet</code> a háttér, <code>--marquee</code> a szöveg, <code>--cyan</code>, <code>--coin</code>, <code>--violet</code> a kiemelő színek. A <code>font_display</code>, <code>font_body</code>, <code>font_led</code> értéke egy Google Fonts betűtípus neve; ezeket automatikusan betöltjük. Hibás JSON-t nem lehet elmenteni.'
			},
			{
				element: 'dte-save',
				title: 'Mentés',
				description:
					'A változás azonnal megjelenik minden nyitott felületen, amelyik ezt a témát használja.'
			}
		]
	},

	users: {
		title: 'Felhasználók',
		steps: [
			{
				element: 'us-table',
				title: 'A regisztrált felhasználók',
				description: 'Az új regisztrálók „Csak megtekintés” jogot kapnak, amíg itt át nem állítod.'
			},
			{
				element: 'us-role',
				title: 'Jogosultság',
				description:
					'A választás azonnal mentődik.<br><b>Rendszergazda:</b> minden, a Felhasználók és a Beállítások is.<br><b>Kérdésbank kezelő:</b> kérdésbank, témák, kvízesték.<br><b>Kvízmester:</b> élő lebonyolítás.<br><b>Csak megtekintés:</b> riportok.'
			}
		]
	},

	settings: {
		title: 'Beállítások',
		steps: [
			{
				element: 'st-default-theme',
				title: 'Alapértelmezett kinézet',
				description:
					'Ez érvényes minden estén, ahol a host nem választott külön vizuális témát. A váltás azonnal megjelenik a nyitott felületeken.'
			},
			{
				element: 'st-list',
				title: 'További beállítások',
				description: 'Mindegyiket külön, a saját „Mentés” gombjával mented.'
			},
			{
				element: 'st-cooldown',
				title: 'Kérdés-újrafelhasználási türelmi idő',
				description:
					'Hány hónapig nem húzza újra a random betöltés azt a kérdést, amelyet már játszottatok. Kézi válogatással ettől függetlenül bármikor hozzáadható.'
			}
		]
	},

	reports: {
		title: 'Riportok',
		steps: [
			{
				element: 'rp-stats',
				title: 'Összesített statisztikák',
				description: 'Csak a lezárult, valódi estékből számolunk; a Próbaesték nem számítanak bele.'
			},
			{
				element: 'rp-games',
				title: 'Lezárult kvízesték',
				description: 'Kattints egy estére a végeredményért.'
			}
		]
	},

	'report-detail': {
		title: 'Egy este eredménye',
		steps: [
			{
				element: 'rd-podium',
				title: 'Végeredmény',
				description:
					'A csapatok összpontszám szerint. A kérdésenkénti bontást a kezelő a Kvízesték → Részletes eredmények oldalon látja.'
			}
		]
	}
};
