import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireStaff } from '$lib/server/auth';
import { parseYouTubeId } from '$lib/questions/layout';

// YouTube-videó ellenőrzése a szerkesztőnek (docs/features/question-layout.md):
// létezik-e, és engedi-e a tulajdonos a beágyazást. Az oEmbed végpont 401-et
// ad, ha a beágyazás tiltott, és 404-et, ha a videó nem létezik / privát.
export const GET: RequestHandler = async ({ url, locals, fetch }) => {
	await requireStaff(locals, [1, 2]);
	const id = parseYouTubeId(url.searchParams.get('id') ?? '');
	if (!id) return json({ status: 'invalid' });

	try {
		const res = await fetch(
			`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
				`https://www.youtube.com/watch?v=${id}`
			)}`,
			{ signal: AbortSignal.timeout(5000) }
		);
		if (res.status === 401 || res.status === 403) return json({ status: 'blocked' });
		if (res.status === 404 || res.status === 400) return json({ status: 'missing' });
		if (!res.ok) return json({ status: 'unknown' });
		const body = (await res.json()) as { title?: string; author_name?: string };
		return json({ status: 'ok', title: body.title ?? '', author: body.author_name ?? '' });
	} catch {
		return json({ status: 'unknown' });
	}
};
