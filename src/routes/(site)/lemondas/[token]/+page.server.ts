import { fail } from '@sveltejs/kit';
import { isRateLimited } from '$lib/server/rate-limit';
import { cancelRegistrationByToken } from '$lib/server/registrations';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A lemondás szándékosan két lépéses (GET: megerősítő oldal, POST: lemondás):
// az e-mail-szolgáltatók linkellenőrzői megnyitják a leveleinkben lévő
// linkeket, egy GET-re lefutó lemondás így véletlenül is lemondaná a helyet.
export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	if (!UUID.test(params.token)) return { registration: null };
	const { data } = await supabase.rpc('registration_by_token', { p_token: params.token });
	return { registration: data?.[0] ?? null };
};

export const actions: Actions = {
	cancel: async ({ params, url, getClientAddress, locals: { supabase } }) => {
		if (isRateLimited(`cancel:${getClientAddress()}`, 10, 10 * 60 * 1000)) {
			return fail(429, { message: 'Túl sok próbálkozás. Próbáld újra pár perc múlva.' });
		}
		if (!UUID.test(params.token)) {
			return fail(400, { message: 'Ez a lemondási link érvénytelen.' });
		}
		const result = await cancelRegistrationByToken(supabase, url.origin, params.token);
		if (!result.ok) return fail(400, { message: result.message });
		return { cancelled: true };
	}
};
