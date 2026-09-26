import { error as kitError, fail } from '@sveltejs/kit';
import { fromBudapestLocalInput } from '$lib/datetime';
import { reopenGameAction } from '$lib/server/games';
import {
	adminAddWalkin,
	adminCancelRegistration,
	adminFillFromWaitlist,
	adminPromoteRegistration
} from '$lib/server/registrations';
import type { Actions, PageServerLoad } from './$types';

// Egy kvízeste esemény-adatai (időpont, helyszín, létszámkorlát, nyilvánosság,
// megjelenés) és a csapatjelentkezések kezelése —
// docs/features/landing-and-registration.md.
export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const [{ data: game }, { data: venues }, { data: themes }, { data: registrations }] =
		await Promise.all([
			supabase
				.from('games')
				.select(
					'id, title, status, pin, is_practice, scheduled_at, venue_id, is_public, max_players, public_note, design_theme_id, join_requires_code'
				)
				.eq('id', params.id)
				.single(),
			supabase.from('venues').select('id, name, city').order('name'),
			supabase.from('design_themes').select('id, title, is_default, design_tokens').order('title'),
			supabase
				.from('team_registrations')
				.select(
					'id, team_name, headcount, contact_name, contact_email, contact_phone, note, status, created_at, promoted_at, cancelled_at, join_code, team_id'
				)
				.eq('game_id', params.id)
				.order('created_at')
		]);

	if (!game) kitError(404, 'A kvízeste nem található.');

	return {
		game,
		venues: venues ?? [],
		themes: (themes ?? []).map((t) => {
			const tokens = (t.design_tokens ?? {}) as Record<string, string>;
			return {
				id: t.id,
				title: t.title,
				isDefault: t.is_default,
				swatch: {
					bg: tokens['--cabinet'] ?? '#ffffff',
					surface: tokens['--cabinet-2'] ?? '#ffffff',
					accent: tokens['--cyan'] ?? '#1e5b4f',
					text: tokens['--marquee'] ?? '#1c1b18'
				}
			};
		}),
		registrations: registrations ?? []
	};
};

function text(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

export const actions: Actions = {
	// Lezárt este újranyitása az este saját oldaláról (reopenGameAction).
	reopen: async ({ request, locals: { supabase } }) => {
		const failure = await reopenGameAction(supabase, await request.formData());
		if (failure) return fail(400, failure);
		return { success: true, reopened: true };
	},

	saveEvent: async ({ request, params, url, locals: { supabase } }) => {
		const form = await request.formData();
		const title = text(form, 'title');
		const scheduledRaw = text(form, 'scheduled_at');
		const maxRaw = text(form, 'max_players');
		const isPublic = form.get('is_public') === 'on';
		const publicNote = text(form, 'public_note');

		if (!title) return fail(400, { error: 'A kvízeste neve kötelező.' });

		const scheduledAt = scheduledRaw ? fromBudapestLocalInput(scheduledRaw) : null;
		if (scheduledRaw && !scheduledAt) return fail(400, { error: 'Érvénytelen időpont.' });
		if (isPublic && !scheduledAt) {
			return fail(400, { error: 'Nyilvános estéhez időpontot is meg kell adni.' });
		}

		const maxPlayers = maxRaw ? Number.parseInt(maxRaw, 10) : null;
		if (maxRaw && (!Number.isInteger(maxPlayers) || (maxPlayers ?? 0) < 1)) {
			return fail(400, { error: 'A létszámkorlát pozitív egész szám (fő) legyen.' });
		}
		if (publicNote.length > 1000) {
			return fail(400, { error: 'A leírás legfeljebb 1000 karakter lehet.' });
		}

		const { error } = await supabase
			.from('games')
			.update({
				title,
				scheduled_at: scheduledAt,
				venue_id: text(form, 'venue_id') || null,
				max_players: maxPlayers,
				is_public: isPublic,
				public_note: publicNote || null,
				design_theme_id: text(form, 'design_theme_id') || null,
				join_requires_code: form.get('join_requires_code') === 'on'
			})
			.eq('id', params.id);
		if (error) return fail(400, { error: error.message });

		// Ha a korlát nőtt, a várólistáról most beférő csapatok bekerülnek.
		const filled = await adminFillFromWaitlist(supabase, url.origin, params.id);
		return { success: true, promoted: filled.promoted ?? 0 };
	},

	// Helyszíni csapat: kódot kap, amit a kezelő szóban ad át.
	addWalkin: async ({ request, params, locals: { supabase } }) => {
		const form = await request.formData();
		const headcount = Number.parseInt(text(form, 'headcount'), 10);
		const result = await adminAddWalkin(supabase, params.id, text(form, 'team_name'), headcount);
		if (!result.ok) return fail(400, { error: result.message });
		return { success: true, walkinCode: result.joinCode, walkinName: text(form, 'team_name') };
	},

	cancel: async ({ request, url, locals: { supabase } }) => {
		const id = text(await request.formData(), 'registration_id');
		if (!id) return fail(400, { error: 'Hiányzó jelentkezés.' });
		const result = await adminCancelRegistration(supabase, url.origin, id);
		if (!result.ok) return fail(400, { error: result.message });
		return { success: true, promoted: result.promoted ?? 0 };
	},

	promote: async ({ request, url, locals: { supabase } }) => {
		const id = text(await request.formData(), 'registration_id');
		if (!id) return fail(400, { error: 'Hiányzó jelentkezés.' });
		const result = await adminPromoteRegistration(supabase, url.origin, id);
		if (!result.ok) return fail(400, { error: result.message });
		return { success: true, promoted: result.promoted ?? 0 };
	}
};
