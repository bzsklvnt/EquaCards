import type { Handle } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/server/supabase';

export const handle: Handle = async ({ event, resolve }) => {
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
	event.locals.safeGetSession = async () => {
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
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
