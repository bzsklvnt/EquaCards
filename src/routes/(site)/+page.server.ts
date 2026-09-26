import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders, locals: { supabase } }) => {
	// A főoldal mindenkinek ugyanaz (nincs benne munkamenet-adat): a Vercel CDN
	// 60 mp-ig kiszolgálja gyorsítótárból, utána a háttérben frissíti.
	setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' });
	const [upcoming, past] = await Promise.all([
		supabase.rpc('public_upcoming_events'),
		supabase.rpc('public_past_events', { p_limit: 8 })
	]);
	if (upcoming.error) console.error('[landing] public_upcoming_events', upcoming.error);
	if (past.error) console.error('[landing] public_past_events', past.error);

	return { upcoming: upcoming.data ?? [], past: past.data ?? [] };
};
