import { parseSiteInfo } from '$lib/site';
import type { LayoutServerLoad } from './$types';

// Nyilvános oldal (landing, esemény, lemondás, adatkezelés) — a szerkeszthető
// oldal-adatok az app_settings site_* kulcsaiból jönnek (/admin/settings).
export const load: LayoutServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase.rpc('public_site_info');
	return { site: parseSiteInfo(data) };
};
