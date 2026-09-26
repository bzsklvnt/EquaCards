import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Helyszínek (DATA_MODEL.md 4. szakasz, venues) — egy kvízeste egy helyszínhez
// tartozik; a nyilvános oldalon a név, cím és térkép-link jelenik meg.
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: venues } = await supabase
		.from('venues')
		.select(
			'id, name, address, city, maps_url, games(id, title, scheduled_at, status, is_practice)'
		)
		.order('name');

	return {
		venues: (venues ?? []).map((v) => ({
			id: v.id,
			name: v.name,
			address: v.address,
			city: v.city,
			maps_url: v.maps_url,
			games: (v.games ?? [])
				.filter((g) => !g.is_practice)
				.sort((a, b) => (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''))
		}))
	};
};

function parseVenue(form: FormData) {
	const text = (key: string) => {
		const value = form.get(key);
		return typeof value === 'string' ? value.trim() : '';
	};
	const venue = {
		name: text('name'),
		address: text('address') || null,
		city: text('city') || null,
		maps_url: text('maps_url') || null
	};
	if (!venue.name) return { error: 'A helyszín neve kötelező.' } as const;
	if (venue.name.length > 80) return { error: 'A név legfeljebb 80 karakter lehet.' } as const;
	if (venue.maps_url && !/^https?:\/\//.test(venue.maps_url)) {
		return { error: 'A térkép-link http(s)://-sel kezdődjön.' } as const;
	}
	return { venue } as const;
}

export const actions: Actions = {
	create: async ({ request, locals: { supabase } }) => {
		const parsed = parseVenue(await request.formData());
		if ('error' in parsed) return fail(400, { error: parsed.error });
		const { data: created, error } = await supabase
			.from('venues')
			.insert(parsed.venue)
			.select('id')
			.single();
		if (error || !created) return fail(400, { error: error?.message ?? 'Nem sikerült.' });
		return { success: true, createdId: created.id };
	},

	update: async ({ request, locals: { supabase } }) => {
		const form = await request.formData();
		const id = form.get('id');
		if (typeof id !== 'string' || !id) return fail(400, { error: 'Hiányzó helyszín.' });
		const parsed = parseVenue(form);
		if ('error' in parsed) return fail(400, { error: parsed.error });
		const { error } = await supabase.from('venues').update(parsed.venue).eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { success: true };
	},

	// A hozzá tartozó esték megmaradnak, csak a helyszínük lesz üres (on delete set null).
	delete: async ({ request, locals: { supabase } }) => {
		const id = (await request.formData()).get('id');
		if (typeof id !== 'string' || !id) return fail(400, { error: 'Hiányzó helyszín.' });
		const { error } = await supabase.from('venues').delete().eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { success: true };
	}
};
