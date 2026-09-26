import { error } from '@sveltejs/kit';

// A kezelői JSON végpontok (kvízösszerakó, kérdésbank, keresés) közös
// jogosultság-ellenőrzése. A tényleges védelmet az RLS és a security-definer
// függvények adják; ez a korai, érthető hibaüzenetért van.
export async function requireStaff(
	locals: App.Locals,
	roles: number[]
): Promise<{ userId: string; roleId: number }> {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Bejelentkezés szükséges.');
	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('role_id')
		.eq('id', user.id)
		.single();
	if (!profile || !roles.includes(profile.role_id)) error(403, 'Nincs jogosultságod.');
	return { userId: user.id, roleId: profile.role_id };
}
