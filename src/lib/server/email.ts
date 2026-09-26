import { env } from '$env/dynamic/private';

// Tranzakciós e-mail a Resend HTTP API-n keresztül (nincs SDK-függőség).
// Ha RESEND_API_KEY / EMAIL_FROM nincs beállítva, a küldés csendben kimarad —
// a jelentkezés ettől még sikeres, a visszaigazolás az oldalon is megjelenik.
export type EmailMessage = {
	to: string;
	subject: string;
	html: string;
	text: string;
};

export type EmailResult =
	{ status: 'sent' } | { status: 'skipped' } | { status: 'failed'; detail: string };

export function isEmailConfigured(): boolean {
	return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
	if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { status: 'skipped' };

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from: env.EMAIL_FROM,
				to: [message.to],
				reply_to: env.EMAIL_REPLY_TO || undefined,
				subject: message.subject,
				html: message.html,
				text: message.text
			}),
			signal: AbortSignal.timeout(8000)
		});
		if (!response.ok) {
			const body = await response.text();
			console.error('[email] Resend error', response.status, body);
			return { status: 'failed', detail: `${response.status}: ${resendMessage(body)}` };
		}
		return { status: 'sent' };
	} catch (error) {
		console.error('[email] send failed', error);
		return { status: 'failed', detail: error instanceof Error ? error.message : String(error) };
	}
}

// A Resend hibaválasza JSON ({ name, message }); ha nem az, a nyers szöveg.
function resendMessage(body: string): string {
	try {
		const parsed = JSON.parse(body) as { message?: string };
		return parsed.message ?? body;
	} catch {
		return body;
	}
}

// A Beállítások oldal "Élesítés állapota" panelje: melyik beállítás van meg
// (titkos kulcsnál csak igen/nem, a feladó címe megjeleníthető).
export function emailSetupStatus() {
	return {
		apiKey: Boolean(env.RESEND_API_KEY),
		from: env.EMAIL_FROM || null,
		replyTo: env.EMAIL_REPLY_TO || null
	};
}

export function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
