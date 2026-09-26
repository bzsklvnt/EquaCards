import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Helyszínek (DATA_MODEL.md 4. szakasz, venues) — egy kvízeste egy helyszínhez
// tartozik; a nyilvános oldalon a név, cím és térkép-link jelenik meg.
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: venues } = await supabase
		.from('venues')
		.select('id, name, address, city, maps_url, games(count)')
		.order('name');

	return {
		venues: (venues ?? []).map((v) => ({
			id: v.id,
			name: v.name,
			address: v.address,
			city: v.city,
			maps_url: v.maps_url,
			gameCount: v.games?.[0]?.count ?? 0
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
		const { error } = await supabase.from('venues').insert(parsed.venue);
		if (error) return fail(400, { error: error.message });
		return { success: true };
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
