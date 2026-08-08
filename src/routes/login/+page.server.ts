import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (session) {
		redirect(303, '/');
	}
};

export const actions: Actions = {
	signin: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			return fail(400, { error: error.message, email, mode: 'signin' as const });
		}

		redirect(303, '/');
	},

	signup: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const displayName = formData.get('display_name') as string;

		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { display_name: displayName } }
		});
		if (error) {
			return fail(400, { error: error.message, email, mode: 'signup' as const });
		}

		if (data.session) {
			redirect(303, '/');
		}

		return {
			success: true,
			message: 'Sikeres regisztráció — ellenőrizd az emailed a megerősítéshez.'
		};
	}
};
