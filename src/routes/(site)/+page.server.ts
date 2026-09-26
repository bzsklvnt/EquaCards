import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [upcoming, past] = await Promise.all([
		supabase.rpc('public_upcoming_events'),
		supabase.rpc('public_past_events', { p_limit: 8 })
	]);
	if (upcoming.error) console.error('[landing] public_upcoming_events', upcoming.error);
	if (past.error) console.error('[landing] public_past_events', past.error);

	return { upcoming: upcoming.data ?? [], past: past.data ?? [] };
};
