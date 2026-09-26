import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import type { Database } from '$lib/types/database.types';

// Az élő felületek (host, csapat, kivetítő) böngészős Supabase kliense. A
// szerveren (SSR) csak egy süti nélküli példány jön létre a típus kedvéért —
// ezek az oldalak a klienst kizárólag a böngészőben (onMount/$effect) használják.
export function supabaseForLoad(fetch: typeof globalThis.fetch) {
	return isBrowser()
		? createBrowserClient<Database>(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
				global: { fetch }
			})
		: createServerClient<Database>(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
				global: { fetch },
				cookies: { getAll: () => [] }
			});
}
