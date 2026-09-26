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

	// A getUser() a tényleges tekintély (a Supabase Auth ellenőrzi a tokent);
	// a session-t csak utána, a már validált felhasználóhoz kérjük le. A
	// csapatok (/play) nem Supabase Auth-tal, hanem device_token-nel azonosulnak
	// (docs/architecture/DATA_MODEL.md 4. szakasz).
	//
	// Kérésenként egyszer, és csak ha egy betöltő kéri (admin/host/riport
	// layoutok, kezelői végpontok) — a nyilvános oldal, a csapat- és a
	// kivetítő-felület nem ellenőriz munkamenetet, így ott nincs Supabase Auth
	// hívás. A getUser() egy hálózati kör-utazás; a memo ezt egyre csökkenti.
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
