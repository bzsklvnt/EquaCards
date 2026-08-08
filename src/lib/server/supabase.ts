import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import type { Database } from '$lib/types/database.types';

export function createSupabaseServerClient(event: RequestEvent) {
	if (!env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_ANON_KEY) {
		throw new Error('PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY is not set — see .env.example');
	}

	const cookies: CookieMethodsServer = {
		getAll: () => event.cookies.getAll(),
		setAll: (cookiesToSet) => {
			cookiesToSet.forEach(({ name, value, options }) => {
				event.cookies.set(name, value, { ...options, path: '/' });
			});
		}
	};

	return createServerClient<Database>(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
		cookies
	});
}
