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
	| 'games'
	| 'game-setup'
	| 'game-event'
	| 'venues'
	| 'host-lobby'
	| 'host-live'
	| 'results'
	| 'design-themes'
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
					'Minden oldal ugyanúgy épül fel: bal oldalt a lista, középen a kijelölt elem részletei, jobb oldalt a műveletek, alul a billentyű-súgó. A változások automatikusan mentődnek.'
			},
			{
				element: 'nav-games',
				title: 'Kvízesték',
				description:
					'Itt hozod létre az estéket, innen jutsz az összerakóba, az eseményhez (jelentkezések) és az élő játékhoz. Itt a Próbaeste gomb is.'
			},
			{
				element: 'nav-questions',
				title: 'Kérdésbank',
				description:
					'Az összes kérdés egy helyen — a lista mellett ugyanazon a vásznon szerkeszted őket, mint az összerakóban.'
			},
			{
				element: 'nav-themes',
				title: 'Témák',
				description:
					'Tartalmi kategóriák (pl. Sport, Zene) a kérdésekhez és a random húzáshoz. Érdemes ezzel kezdeni.'
			},
			{
				element: 'nav-venues',
				title: 'Helyszínek',
				description: 'A kvízesték helyszínei — a nyilvános oldalon is ezek jelennek meg.'
			},
			{
				element: 'nav-design-themes',
				title: 'Vizuális témák',
				description:
					'A kinézet a host, a kivetítő és a telefonok felületén, élő előnézettel. Független a tartalmi témáktól.'
			},
			{
				element: 'nav-reports',
				title: 'Riportok',
				description: 'A lezárult esték eredményei és összesített statisztikái.'
			},
			{
				element: 'nav-settings',
				title: 'Felhasználók és beállítások',
				description:
					'Jogosultságok, olvasási idő, alap válaszidő, impresszum, e-mail — csak a Rendszergazda látja.'
			},
			{
				element: 'cmd-palette',
				title: 'Keresés és parancsok (Ctrl+K)',
				description:
					'Bárhonnan megkereshetsz egy estét, kérdést, helyszínt vagy témát, és parancsot is indíthatsz (pl. „Új kvízeste”). Oldalra ugrás: G, majd egy betű (G E Kvízesték, G K Kérdésbank…). A ? billentyű minden oldalon megmutatja a parancsokat.'
			},
			{
				element: 'tour-button',
				title: 'Bemutató gomb',
				description:
					'Minden oldalon itt indítod az adott oldal bemutatóját. A pötty azt jelzi, hogy ebben a böngészőben még nem nézted meg.'
			},
			{
				title: 'Javasolt sorrend egy új estéhez',
				description:
					'1. Témák → 2. Kérdésbank → 3. Kvízesték: összerakó → 4. Esemény és jelentkezések → 5. Élő lebonyolítás → 6. Riportok.<br><br>Tipp: először hozz létre egy Próbaestét, és azon kattints végig mindent.'
			}
		]
	},

	themes: {
		title: 'Témák',
		steps: [
			{
				element: 'theme-list',
				title: 'A témák',
				description:
					'Bal oldalt a témák a kérdésszámmal. ↑/↓ lépked, Enter a név szerkesztésére ugrik — az átnevezés automatikusan mentődik.'
			},
			{
				element: 'theme-create',
				title: 'Új téma',
				description: 'Írd be a nevét (N a mezőbe ugrik), majd +.'
			},
			{
				title: 'Tartalmi vagy vizuális téma?',
				description:
					'Az itteni témák a kérdések tartalmát csoportosítják. A kinézetet a Vizuális témák kezeli, a kettő független egymástól.'
			}
		]
	},

	questions: {
		title: 'Kérdésbank',
		steps: [
			{
				title: 'Lista és vászon egy nézetben',
				description:
					'Bal oldalt a kérdések, középen a kijelölt kérdés ugyanazon a vásznon, mint a kvízösszerakóban, jobb oldalt a beállításai. Minden változás automatikusan mentődik, amint a kérdés teljes.'
			},
			{
				element: 'q-filter',
				title: 'Szűrők',
				description:
					'Téma, típus, „Csak nem játszott”, „Van kép” — és a keresés (/) a kérdés szövegében.'
			},
			{
				element: 'q-table',
				title: 'A kérdések',
				description:
					'↑/↓ lépked, Enter a kérdés szövegébe ugrik. A jobb szélső jelzés: „új” = még nem hangzott el, „2×” = két estén már szerepelt.'
			},
			{
				element: 'q-new',
				title: 'Új kérdés',
				description:
					'N: új kérdés a vásznon. Addig nem kerül a bankba, amíg nem teljes (szöveg + helyes válasz) — a hiányzót a vászon felett látod.'
			},
			{
				element: 'qb-prompt',
				title: 'Szerkesztés billentyűzettel',
				description:
					'1–8: helyes válasz, Alt+1–8: a lap szövege, T: típus, Ctrl+V: kép beillesztése, Esc: vissza a listába.'
			},
			{
				element: 'qb-time',
				title: 'Válaszidő és olvasási idő',
				description:
					'Gyors választók + egyéni érték (5–600 mp). Az olvasási idő alapból a Beállításokban megadott érték, kérdésenként egyéni is lehet.'
			},
			{
				element: 'q-row-actions',
				title: 'Hol szerepel',
				description:
					'Mely estéken és körökben szerepel a kérdés; innen egy kör végére is hozzáadhatod (A). Figyelem: a törlés a korábbi esték eredményeiből is eltávolítja a válaszokat — javításhoz elég a szerkesztés.'
			}
		]
	},

	'game-event': {
		title: 'Esemény és jelentkezések',
		steps: [
			{
				element: 'ev-stats',
				title: 'Létszám',
				description: 'A megerősített csapatok összlétszáma a korláthoz képest és a szabad helyek.'
			},
			{
				element: 'ev-table',
				title: 'Jelentkezések',
				description:
					'Bal oldalt a csapatok: bekerült, várólista, lemondott. Középen a kijelölt csapat: csapatkód, belépett-e, kapcsolattartó. P: beengedés a várólistáról, Del: lemondás — mindkettőről e-mail megy.'
			},
			{
				element: 'ev-walkin',
				title: 'Helyszíni csapat és export',
				description:
					'W: előzetes jelentkezés nélkül érkezett csapat — kap egy csapatkódot, ezt mondd meg nekik. Az „Export CSV” Excelben nyitható listát ad.'
			},
			{
				element: 'ev-settings',
				title: 'Esemény adatai',
				description:
					'Név, időpont (magyar idő), helyszín, létszámkorlát főben — automatikus mentéssel. Ha a korlátot megemeled, a várólistáról bekerülnek, akik beleférnek.',
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
					'Bekapcsolva csak a jelentkezéskor kapott 6 karakteres csapatkóddal lehet csatlakozni — a PIN önmagában nem elég.',
				side: 'left'
			},
			{
				element: 'ev-theme',
				title: 'Megjelenés',
				description: 'Az este vizuális témája a kivetítőn, a host és a csapatok felületén.',
				side: 'left'
			},
			{
				element: 'ev-delete',
				title: 'Kvízeste törlése',
				description:
					'Csak rendszergazdának látszik. A jelentkezett csapatok nem kapnak értesítést — ha az este elmarad, előbb szólj nekik.',
				side: 'left'
			},
			{
				element: 'tab-rounds',
				title: 'Az este nézetei',
				description:
					'Szerkesztő, Áttekintés, Esemény, Eredmények — ugyanaz a fejléc minden nézetben.'
			}
		]
	},
	venues: {
		title: 'Helyszínek',
		steps: [
			{
				element: 'venues-list',
				title: 'Helyszínek',
				description:
					'Bal oldalt a lista, középen a kijelölt helyszín adatai automatikus mentéssel, alatta az előnézet: így látszik a nyilvános oldalon. Jobb oldalt az itt tartott esték.'
			},
			{
				element: 'venues-create',
				title: 'Új helyszín',
				description:
					'N vagy „+ Helyszín”: először csak a név kell, a címet, várost és térkép-linket utána adod meg. Törléskor az esték megmaradnak, csak a helyszínük lesz üres.'
			}
		]
	},
	games: {
		title: 'Kvízesték',
		steps: [
			{
				element: 'games-list',
				title: 'Az esték',
				description:
					'Csoportosítva: élő, közelgő, lezárt, próba. A chipekkel szűrhetsz, ↑/↓ lépked, Enter megnyitja az összerakót.'
			},
			{
				element: 'games-status',
				title: 'Állapot és teendők',
				description:
					'Középen a kijelölt este: jelentkezők, menetrend körönként és a teendők az estig (időpont, helyszín, nyilvánosság, üres körök, várólista).'
			},
			{
				element: 'games-create',
				title: 'Új kvízeste',
				description:
					'N vagy „+ Kvízeste”: nevet adsz, utána az esemény adatai jönnek (időpont, helyszín, létszámkorlát), majd az összerakó.'
			},
			{
				element: 'games-practice',
				title: 'Próbaeste',
				description:
					'Egy kattintással gyakorló este 2 körrel és mintakérdésekkel; a riportokban nem jelenik meg.'
			},
			{
				element: 'games-reopen',
				title: 'Újranyitás',
				description: 'Lezárt estén: Váró állapotba állítja vissza, hogy újra elindíthasd.'
			},
			{
				element: 'games-delete',
				title: 'Törlés (csak rendszergazda)',
				description:
					'Véglegesen törli az estét a köreivel, csapataival, válaszaival és jelentkezéseivel; a kérdések a bankban maradnak. Futó estét nem lehet törölni.'
			}
		]
	},

	'game-setup': {
		title: 'Kvízösszerakó',
		steps: [
			{
				title: 'Így épül fel egy este',
				description:
					'Bal oldalt a menetrend (körök és kérdések), középen a kérdés úgy, ahogy a kivetítőn látszik, jobb oldalt a beállításai. Minden változás automatikusan mentődik, amint a kérdés teljes. Szinte minden billentyűzettel is megy — a ? megmutatja az összes parancsot.'
			},
			{
				element: 'qb-rail',
				title: 'Menetrend',
				description:
					'↑/↓ (vagy J/K) lépked a kérdések között, Ctrl+↑/↓ a körök között, Alt+↑/↓ áthelyezi a kérdést (körök között is). A kör nevére kattintva átnevezheted, a ✕ törli a kört. A ● jelzi, hogy a kérdés után alapból megjelenik a köri állás.'
			},
			{
				element: 'gs-add-round',
				title: 'Új kör',
				description: 'Írd be a kör nevét és „+ Kör” (vagy Shift+N a mezőbe ugrik).'
			},
			{
				element: 'qb-new',
				title: 'Új kérdés',
				description:
					'N: új kérdés az aktuális után. Addig nem kerül a kérdésbankba, amíg nem teljes (szöveg + helyes válasz) — a hiányzót a vászon felett látod.'
			},
			{
				element: 'gs-pick',
				title: 'Kérdésbank',
				description:
					'B: a kérdésbank a szerkesztő fölött nyílik. Keresés, téma- és típusszűrő, „Csak még nem játszott”, többes kijelölés (Szóköz, Shift+↑↓), Enter hozzáadja az aktuális kérdés után. Random húzás is innen megy (R), a pihentetési idő figyelembevételével.'
			},
			{
				element: 'qb-prompt',
				title: 'A vászon',
				description:
					'Enter: kérdésszöveg. 1–8: helyes válasz jelölése, Alt+1–8: a lap szövege. Esc visszavisz a menetrendbe. Képet be is illeszthetsz (Ctrl+V).'
			},
			{
				element: 'qb-settings',
				title: 'Beállítások',
				description:
					'T: típusváltás. Válaszidő (gyors választók + egyéni mező), olvasási idő (alap vagy egyéni), pontozás, „Állás a kérdés után”, téma. Ctrl+D duplikál, Del kiveszi a körből (Ctrl+Z visszahozza).'
			},
			{
				element: 'qb-overview',
				title: 'Áttekintés',
				description:
					'O: az egész este egy nézetben, húzással átrendezhető, és itt a „Random töltés minden körbe”. Jobb oldalt az indulás előtti ellenőrzés: amíg hiba van, az élő indítás nem enged tovább. F8 a következő hibára ugrik.'
			},
			{
				element: 'tab-event',
				title: 'Esemény és eredmények',
				description:
					'Időpont, helyszín, létszámkorlát, nyilvánosság, megjelenés és a jelentkezések — az „Eredmények” fülön körönként és kérdésenként látod, melyik csapat mit válaszolt.'
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
				element: 'hlv-steps',
				title: 'A kérdés lépései',
				description:
					'Olvasás → Válaszidő → Felfedés → Állás a körben → Következő. A kiemelt lépés mindig látszik; a Space billentyű mindig a kiemelt gombot nyomja meg.'
			},
			{
				element: 'hlv-question',
				title: 'Az aktuális kérdés',
				description:
					'Te itt látod a kérdést (és a képét élesen); a csapatok ugyanezt látják a kivetítőn és a telefonjukon.'
			},
			{
				element: 'hlv-timer',
				title: 'Olvasás és visszaszámlálás',
				description:
					'Először az olvasási idő fut (alapból 5 mp, kérdésenként állítható): ilyenkor csak a kérdés látszik, a csapatok gombjai tiltva. Utána indul a válaszidő, egy közös szerveridőhöz igazítva. Space-szel az olvasás átugorható.'
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
					'Mindig az aktuális lépés gombja a kiemelt (Space): „Következő kérdés”, „Olvasás átugrása”, „Válaszok lezárása most” (L), „Megoldás feltárása”, a kör végén „Kör eredményének feltárása”, a legvégén „Végeredmény feltárása”. A „Játék lezárása” csak gombbal megy. Dupla lenyomás ellen 0,8 mp-es védelem van.'
			},
			{
				element: 'hlv-standings',
				title: 'Állás a körben',
				description:
					'Felfedés után a kör állása a kivetítőn: helyezés, előre-/hátralépés, a kérdésnél szerzett pont. Hogy ez a kiemelt lépés-e, a kvízösszerakóban kérdésenként állítod; S-sel kihagyható. A csapatok telefonja minden kérdés után mutatja a saját helyüket és a szomszédaikat, akkor is, ha a kivetítős állás kimarad.'
			},
			{
				element: 'hlv-keys',
				title: 'Billentyűk és hang',
				description:
					'Hang csak a kivetítőn szól (visszaszámlálás, gong, felfedés, állás, joker); M-mel innen távolról némíthatod. C: csapatkódok késve érkezőknek. ?: az összes parancs.'
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
				title: 'Csak a kezelő látja',
				description:
					'Ez a bontás soha nem jelenik meg a kivetítőn vagy a csapatok telefonján; ott csak az állások és a végeredmény látszik.'
			},
			{
				element: 'res-round',
				title: 'Kérdésenként',
				description: 'Bal oldalt a kérdések körönként (hány csapat találta el); ↑/↓ lépked.'
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
					'Mit küldött be a csapat, helyes volt-e, hány pontot kapott (pontcsökkenés, szorzó és joker után), és mennyi idő alatt. Jobb oldalt a kör és az este összesített állása.'
			},
			{
				element: 'game-reopen',
				title: 'Kvízeste újranyitása',
				description: 'Lezárt estén: Váró állapotba állítja vissza az estét.'
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
					'Színek és betűtípusok a host, a kivetítő és a telefonok felületén. Középen élő előnézet mutatja, hogyan fest a kivetítőn és a telefonon.'
			},
			{
				element: 'dt-list',
				title: 'A témák',
				description:
					'Bal oldalt a témák a fő színeikkel. Az alapértelmezettet nem lehet törölni; előbb jelölj ki másikat.'
			},
			{
				element: 'dte-default',
				title: 'Alapértelmezett',
				description:
					'Bekapcsolva minden olyan este ezt használja, amelyhez nem választottak külön témát (Esemény fül).'
			},
			{
				element: 'dte-tokens',
				title: 'Színek',
				description:
					'Színválasztókkal állíthatod a háttér, szöveg, kiemelés, siker, hiba stb. színét; a „Haladó” részben az összes token (pl. betűtípusok) JSON-ként. Minden automatikusan mentődik, és azonnal megjelenik a nyitott felületeken.'
			},
			{
				element: 'dt-new',
				title: 'Új téma',
				description: 'A Letisztult alapkészletből indul — utána színezd át.'
			}
		]
	},

	users: {
		title: 'Felhasználók',
		steps: [
			{
				title: 'Szerepkörök szerint',
				description: 'Bal oldalt a felhasználók szerepkörönként csoportosítva, ↑/↓ lépked, / keres.'
			},
			{
				element: 'us-role',
				title: 'Jogosultság',
				description:
					'A választás azonnal mentődik; mindegyik mellett ott a rövid leírása. A saját rendszergazda jogodat nem veheted el.'
			}
		]
	},

	settings: {
		title: 'Beállítások',
		steps: [
			{
				title: 'Kategóriák',
				description:
					'Bal oldalt: Játék, Megjelenés, Nyilvános oldal, Impresszum és jogi, E-mail. Minden mező automatikusan mentődik; jobb oldalt mindig látszik az élesítés állapota.'
			},
			{
				element: 'st-list',
				title: 'Játék',
				description:
					'Olvasási idő (alap 5 mp), alap válaszidő új kérdéshez, és a kérdés-pihentetés hónapokban.'
			},
			{
				element: 'st-cooldown',
				title: 'Kérdés-pihentetés',
				description:
					'Hány hónapig nem húzza újra a random betöltés a már játszott kérdést. Kézzel bármikor hozzáadható.'
			},
			{
				element: 'st-default-theme',
				title: 'Alapértelmezett kinézet',
				description:
					'A Megjelenés kategóriában: minden estén ez érvényes, ahol nem választottak külön témát.'
			}
		]
	},

	reports: {
		title: 'Riportok',
		steps: [
			{
				element: 'rp-games',
				title: 'Esték',
				description:
					'Bal oldalt az Összesítés és a lezárult esték; egy estére lépve a végeredménye jelenik meg.'
			},
			{
				element: 'rp-stats',
				title: 'Összesített statisztikák',
				description: 'Csak a lezárult, valódi estékből számolunk; a Próbaesték nem számítanak bele.'
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
