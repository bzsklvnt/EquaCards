import { createBrowserClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import type { Database } from '$lib/types/database.types';

export function createSupabaseBrowserClient() {
	if (!env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_ANON_KEY) {
		throw new Error('PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY is not set — see .env.example');
	}

	return createBrowserClient<Database>(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY);
}
