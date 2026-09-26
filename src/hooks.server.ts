import type { Handle } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase';
import { appBase, isSitePath, siteBase } from '$lib/site';

// Két domain egy deploymentben (src/lib/site.ts): a nyilvános oldal útvonalai
// csak a landing domainen, minden más csak az app domainen érhető el — a
// rossz hostra érkező kérés 308-cal átirányul. Más host (Vercel preview,
// localhost) vagy hiányzó env esetén nincs átirányítás.
function domainRedirect(url: URL, hasAuthCookie: boolean): string | null {
	const site = siteBase();
	const app = appBase();
	if (!site || !app) return null;

	const path = url.pathname.replace(/\/__data\.json$/, '') || '/';
	if (path.startsWith('/_app/') || /\.[a-z0-9]+$/i.test(path)) return null;

	const siteHost = new URL(site).host;
	const appHost = new URL(app).host;
	if (url.host === siteHost && !isSitePath(path)) {
		return `${app}${url.pathname}${url.search}`;
	}
	if (url.host === appHost && isSitePath(path)) {
		// Az app gyökere: a kezelő a vezérlőpultra, a játékos a PIN-beíróra megy.
		if (path === '/') return `${app}${hasAuthCookie ? '/admin' : '/play'}`;
		return `${site}${url.pathname}${url.search}`;
	}
	return null;
}

export const handle: Handle = async ({ event, resolve }) => {
	const target = domainRedirect(
		event.url,
		event.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
	);
	if (target) {
		return new Response(null, { status: 308, headers: { location: target } });
	}

	event.locals.supabase = createSupabaseServerClient(event);

	// Fázis Q5 — élő tesztelésből: a Vercel logban minden /play kérésnél
	// megjelent a supabase-js getSession()-figyelmeztetése ("could be
	// insecure"). Ez a hooks.server.ts minden kérésnél lefut (a
	// /routes/+layout.server.ts globálisan hívja safeGetSession()-t), a
	// /play route-oknak viszont SOSE kellene Supabase Auth session-t
	// megkövetelniük — a csapatok device_token-alapú azonosítást
	// használnak (docs/architecture/DATA_MODEL.md 4. szakasz), nem
	// Supabase Auth-ot. A figyelmeztetés tehát valóban zaj (nem talált
	// olyan guard-ot ez az audit, ami a /play-en Auth session-re
	// támaszkodna), de a getUser()-t itt is a tényleges tekintélyként
	// kell kezelni: a session-t (ami CSAK az `expires_at` metaadatért
	// kell a gyökér +layout.svelte kliens-oldali auth-state-figyelőjének)
	// a getUser()-rel már validált felhasználó UTÁN kérjük le, nem előtte
	// "gyors kizárás" céljából.
	//
	// Kérésenként egyszer: a gyökér és az admin/host layout load egyaránt
	// meghívja, és a getUser() minden alkalommal egy hálózati kör-utazás a
	// Supabase Auth felé — a memo ezt egyre csökkenti.
	let sessionPromise: ReturnType<App.Locals['safeGetSession']> | undefined;
	event.locals.safeGetSession = () =>
		(sessionPromise ??= (async () => {
			const {
				data: { user },
				error
			} = await event.locals.supabase.auth.getUser();
			if (error || !user) {
				return { session: null, user: null };
			}

			const {
				data: { session }
			} = await event.locals.supabase.auth.getSession();

			return { session, user };
		})());

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
