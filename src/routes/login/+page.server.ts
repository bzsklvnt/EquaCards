import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// A Supabase Auth angol hibaüzenetei magyarul (ismeretlen kódnál általános üzenet).
const AUTH_ERRORS: Record<string, string> = {
	invalid_credentials: 'Hibás e-mail cím vagy jelszó.',
	email_not_confirmed: 'Az e-mail címed még nincs megerősítve — nézd meg a leveleidet.',
	user_already_exists: 'Ezzel az e-mail címmel már van fiók.',
	email_exists: 'Ezzel az e-mail címmel már van fiók.',
	weak_password: 'A jelszó túl gyenge — legalább 8 karakter, betűk és számok.',
	over_request_rate_limit: 'Túl sok próbálkozás, várj egy kicsit.',
	over_email_send_rate_limit: 'Túl sok e-mail ment ki, próbáld újra pár perc múlva.',
	signup_disabled: 'A regisztráció jelenleg nem elérhető.',
	validation_failed: 'Érvénytelen e-mail cím vagy jelszó.'
};

function authMessage(error: { code?: string; message: string }): string {
	return (error.code && AUTH_ERRORS[error.code]) || 'Nem sikerült, próbáld újra.';
}

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (session) {
		redirect(303, '/admin');
	}
};

export const actions: Actions = {
	signin: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			return fail(400, { error: authMessage(error), email, mode: 'signin' as const });
		}

		redirect(303, '/admin');
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
			return fail(400, { error: authMessage(error), email, mode: 'signup' as const });
		}

		if (data.session) {
			redirect(303, '/admin');
		}

		return {
			success: true,
			message:
				'Sikeres regisztráció — ellenőrizd az e-mailed a megerősítéshez. A belépés után a rendszergazda ad jogosultságot a fiókodhoz.'
		};
	}
};
