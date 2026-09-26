import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import { formatEventDate } from '$lib/datetime';
import { absoluteSiteUrl } from '$lib/site';
import { getSupabaseAdmin } from './admin';
import { escapeHtml, sendEmail, type EmailResult } from './email';

// Csapatregisztráció + várólista + értesítő e-mailek
// (docs/features/landing-and-registration.md). Az adatbázis-oldali logika
// (kapacitás, várólista, előléptetés) a register_team / cancel_registration /
// admin_* RPC-kben van; ez a modul csak az RPC-ket hívja és kiküldi a leveleket.

type Client = SupabaseClient<Database>;

export type RegistrationInput = {
	gameId: string;
	teamName: string;
	headcount: number;
	contactName: string;
	contactEmail: string;
	contactPhone?: string | null;
	note?: string | null;
};

const REGISTER_ERRORS: Record<string, string> = {
	invalid_input: 'Kérjük, ellenőrizd a megadott adatokat.',
	registration_closed: 'Erre az estére már nem lehet jelentkezni.',
	name_taken: 'Ezen a néven már jelentkezett egy csapat erre az estére — válassz másikat.'
};

const CANCEL_ERRORS: Record<string, string> = {
	not_found: 'Ez a lemondási link érvénytelen.',
	already_cancelled: 'Ezt a jelentkezést már lemondtátok.',
	too_late: 'Az este már elkezdődött, a jelentkezés nem mondható le.'
};

function mapError(message: string | undefined, table: Record<string, string>): string {
	const key = Object.keys(table).find((k) => message?.includes(k));
	return key ? table[key] : 'Váratlan hiba történt, kérjük, próbáld újra.';
}

// Az e-mailben mindig a nyilvános (landing) domain szerepel, ha be van állítva.
export function cancelUrl(origin: string, token: string): string {
	return absoluteSiteUrl(origin, `/lemondas/${token}`);
}

type EventInfo = {
	title: string;
	scheduledAt: string | null;
	venue: string | null;
};

function eventLines(event: EventInfo): string[] {
	return [
		event.title,
		event.scheduledAt ? formatEventDate(event.scheduledAt) : null,
		event.venue
	].filter((line): line is string => Boolean(line));
}

function layout(heading: string, paragraphs: string[], event: EventInfo, link: string): string {
	const details = eventLines(event)
		.map((line, i) =>
			i === 0
				? `<div style="font-size:18px;font-weight:600;color:#111827">${escapeHtml(line)}</div>`
				: `<div style="color:#4b5563">${escapeHtml(line)}</div>`
		)
		.join('');
	const body = paragraphs
		.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p)}</p>`)
		.join('');
	return `<!doctype html><html lang="hu"><body style="margin:0;background:#f6f5f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<h1 style="font-size:22px;margin:0 0 18px;color:#111827">${escapeHtml(heading)}</h1>
${body}
<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;margin:20px 0">${details}</div>
<p style="margin:0 0 6px;font-size:14px;color:#4b5563">Ha mégsem tudtok jönni, kérjük, mondjátok le, hogy más csapat kaphassa meg a helyet:</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="color:#0f766e;font-weight:600">Jelentkezés lemondása</a></p>
<p style="margin:0;font-size:12px;color:#9ca3af">Ezt a levelet azért kaptad, mert csapatot regisztráltál egy kvízestére. Erre az üzenetre válaszolva a szervezőket éred el.</p>
</div></body></html>`;
}

function plain(heading: string, paragraphs: string[], event: EventInfo, link: string): string {
	return [heading, '', ...paragraphs, '', ...eventLines(event), '', `Lemondás: ${link}`].join('\n');
}

function confirmationEmail(teamName: string, event: EventInfo, link: string) {
	const heading = 'Jelentkezés visszaigazolva';
	const paragraphs = [
		`A(z) „${teamName}” csapat jelentkezését rögzítettük. Várunk titeket!`,
		'Érkezéskor a kivetítőn megjelenő PIN-kóddal vagy QR-kóddal tudtok csatlakozni.'
	];
	return {
		subject: `Jelentkezés visszaigazolva – ${event.title}`,
		html: layout(heading, paragraphs, event, link),
		text: plain(heading, paragraphs, event, link)
	};
}

function waitlistEmail(teamName: string, position: number | null, event: EventInfo, link: string) {
	const heading = 'Várólistára kerültetek';
	const paragraphs = [
		`Az este jelenleg telt házas, ezért a(z) „${teamName}” csapat várólistára került${
			position ? ` (${position}. hely)` : ''
		}.`,
		'Ha felszabadul egy hely, automatikusan bekerültök, és erről e-mailt küldünk.'
	];
	return {
		subject: `Várólista – ${event.title}`,
		html: layout(heading, paragraphs, event, link),
		text: plain(heading, paragraphs, event, link)
	};
}

function promotedEmail(teamName: string, event: EventInfo, link: string) {
	const heading = 'Felszabadult egy hely — bekerültetek!';
	const paragraphs = [
		`Jó hír: a(z) „${teamName}” csapat a várólistáról bekerült a kvízestére. Várunk titeket!`
	];
	return {
		subject: `Bekerültetek – ${event.title}`,
		html: layout(heading, paragraphs, event, link),
		text: plain(heading, paragraphs, event, link)
	};
}

export type RegisterResult =
	| {
			ok: true;
			status: 'confirmed' | 'waitlist';
			waitlistPosition: number | null;
			email: EmailResult['status'];
	  }
	| { ok: false; message: string };

export async function registerTeam(
	supabase: Client,
	origin: string,
	input: RegistrationInput
): Promise<RegisterResult> {
	const { data, error } = await supabase.rpc('register_team', {
		p_game_id: input.gameId,
		p_team_name: input.teamName,
		p_headcount: input.headcount,
		p_contact_name: input.contactName,
		p_contact_email: input.contactEmail,
		p_contact_phone: input.contactPhone ?? undefined,
		p_note: input.note ?? undefined
	});
	const row = data?.[0];
	if (error || !row) {
		if (error) console.error('[register_team]', error);
		return { ok: false, message: mapError(error?.message, REGISTER_ERRORS) };
	}

	const status = row.status === 'waitlist' ? 'waitlist' : 'confirmed';
	const { data: info } = await supabase.rpc('registration_by_token', {
		p_token: row.cancel_token
	});
	const event: EventInfo = {
		title: info?.[0]?.game_title ?? 'Kvízest',
		scheduledAt: info?.[0]?.scheduled_at ?? null,
		venue: info?.[0]?.venue_name ?? null
	};
	const link = cancelUrl(origin, row.cancel_token);
	const teamName = input.teamName.trim();
	const message =
		status === 'waitlist'
			? waitlistEmail(teamName, row.waitlist_position, event, link)
			: confirmationEmail(teamName, event, link);
	const sent = await sendEmail({ to: input.contactEmail.trim(), ...message });

	return { ok: true, status, waitlistPosition: row.waitlist_position, email: sent.status };
}

// Az előléptetett csapat elérhetőségét csak service-role klienssel (anonim
// lemondás) vagy a kezelő saját kliensével (staff RLS) lehet kiolvasni.
async function notifyPromoted(
	fallback: Client,
	origin: string,
	ids: string[] | null | undefined
): Promise<void> {
	if (!ids?.length) return;
	const client = getSupabaseAdmin() ?? fallback;
	const { data, error } = await client
		.from('team_registrations')
		.select('team_name, contact_email, cancel_token, games(title, scheduled_at, venues(name))')
		.in('id', ids);
	if (error) {
		console.error('[notifyPromoted]', error);
		return;
	}
	await Promise.all(
		(data ?? []).map((row) => {
			const event: EventInfo = {
				title: row.games?.title ?? 'Kvízest',
				scheduledAt: row.games?.scheduled_at ?? null,
				venue: row.games?.venues?.name ?? null
			};
			return sendEmail({
				to: row.contact_email,
				...promotedEmail(row.team_name, event, cancelUrl(origin, row.cancel_token))
			});
		})
	);
}

export async function cancelRegistrationByToken(
	supabase: Client,
	origin: string,
	token: string
): Promise<{ ok: true } | { ok: false; message: string }> {
	const { data, error } = await supabase.rpc('cancel_registration', { p_token: token });
	if (error) {
		return { ok: false, message: mapError(error.message, CANCEL_ERRORS) };
	}
	await notifyPromoted(supabase, origin, data?.[0]?.promoted_ids);
	return { ok: true };
}

export type AdminResult = { ok: boolean; message?: string; promoted?: number };

export async function adminCancelRegistration(
	supabase: Client,
	origin: string,
	id: string
): Promise<AdminResult> {
	const { data: promoted, error } = await supabase.rpc('admin_cancel_registration', {
		p_id: id
	});
	if (error) return { ok: false, message: 'Nem sikerült lemondani a jelentkezést.' };
	await notifyPromoted(supabase, origin, promoted);
	return { ok: true, promoted: promoted?.length ?? 0 };
}

// Kézi beengedés: a kezelő döntése, a létszámkorlátot nem ellenőrzi.
export async function adminPromoteRegistration(
	supabase: Client,
	origin: string,
	id: string
): Promise<AdminResult> {
	const { data: promoted, error } = await supabase.rpc('admin_promote_registration', {
		p_id: id
	});
	if (error) return { ok: false, message: 'Nem sikerült beengedni a csapatot.' };
	if (promoted) await notifyPromoted(supabase, origin, [id]);
	return { ok: true, promoted: promoted ? 1 : 0 };
}

// A létszámkorlát emelése után: aki most belefér, sorrendben bekerül.
export async function adminFillFromWaitlist(
	supabase: Client,
	origin: string,
	gameId: string
): Promise<AdminResult> {
	const { data: promoted, error } = await supabase.rpc('admin_fill_from_waitlist', {
		p_game_id: gameId
	});
	if (error) return { ok: false, message: 'Nem sikerült a várólista feldolgozása.' };
	await notifyPromoted(supabase, origin, promoted);
	return { ok: true, promoted: promoted?.length ?? 0 };
}
