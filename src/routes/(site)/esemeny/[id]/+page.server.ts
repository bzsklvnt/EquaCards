import { error, fail } from '@sveltejs/kit';
import { isRateLimited } from '$lib/server/rate-limit';
import { registerTeam } from '$lib/server/registrations';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	if (!UUID.test(params.id)) error(404, 'Nincs ilyen esemény.');
	const { data, error: rpcError } = await supabase.rpc('public_event', { p_id: params.id });
	if (rpcError) console.error('[esemeny] public_event', rpcError);
	const event = data?.[0];
	if (!event) error(404, 'Nincs ilyen esemény.');
	return { event };
};

function text(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

export const actions: Actions = {
	register: async ({ request, params, url, getClientAddress, locals: { supabase } }) => {
		const form = await request.formData();
		const values = {
			teamName: text(form, 'team_name'),
			headcount: text(form, 'headcount'),
			contactName: text(form, 'contact_name'),
			contactEmail: text(form, 'contact_email'),
			contactPhone: text(form, 'contact_phone'),
			note: text(form, 'note')
		};

		// Botcsapda: az emberek számára rejtett mező — ha ki van töltve, csendben
		// "sikert" mutatunk, de semmit nem mentünk.
		if (text(form, 'website')) {
			return { success: true, status: 'confirmed' as const, waitlistPosition: null, teamName: '' };
		}

		if (isRateLimited(`register:${getClientAddress()}`, 8, 10 * 60 * 1000)) {
			return fail(429, {
				message: 'Túl sok jelentkezés innen rövid idő alatt. Próbáld újra pár perc múlva.',
				values
			});
		}

		const headcount = Number.parseInt(values.headcount, 10);
		if (!values.teamName || !values.contactName || !values.contactEmail) {
			return fail(400, { message: 'Kérjük, tölts ki minden kötelező mezőt.', values });
		}
		if (!Number.isInteger(headcount) || headcount < 1 || headcount > 12) {
			return fail(400, { message: 'A létszám 1 és 12 fő között lehet.', values });
		}
		if (form.get('consent') !== 'on') {
			return fail(400, { message: 'A jelentkezéshez el kell fogadnod az adatkezelést.', values });
		}

		const result = await registerTeam(supabase, url.origin, {
			gameId: params.id,
			teamName: values.teamName,
			headcount,
			contactName: values.contactName,
			contactEmail: values.contactEmail,
			contactPhone: values.contactPhone || null,
			note: values.note || null
		});
		if (!result.ok) return fail(400, { message: result.message, values });

		return {
			success: true,
			status: result.status,
			waitlistPosition: result.waitlistPosition,
			teamName: values.teamName
		};
	}
};
