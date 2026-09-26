import { supabaseForLoad } from '$lib/supabase-load';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = ({ fetch }) => ({ supabase: supabaseForLoad(fetch) });
