import { supabaseForLoad } from '$lib/supabase-load';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = ({ data, fetch }) => ({
	...data,
	supabase: supabaseForLoad(fetch)
});
