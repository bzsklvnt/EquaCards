import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import type { Database } from '$lib/types/database.types';

// Service-role kliens — megkerüli az RLS-t, ezért KIZÁRÓLAG szerveren, és csak
// olyan szűk célra használjuk, ahol a hívó jogosultságát már ellenőriztük
// (pl. a lemondás után előléptetett csapat e-mail címének kiolvasása, amit az
// anonim lemondó nem láthat). Ha a kulcs nincs beállítva, null — a hívók
// ilyenkor az értesítő e-mailt kihagyják.
let cached: SupabaseClient<Database> | null | undefined;

export function getSupabaseAdmin(): SupabaseClient<Database> | null {
	if (cached !== undefined) return cached;
	const url = publicEnv.PUBLIC_SUPABASE_URL;
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	cached =
		url && key
			? createClient<Database>(url, key, {
					auth: { persistSession: false, autoRefreshToken: false }
				})
			: null;
	return cached;
}
