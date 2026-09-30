import { error, json } from '@sveltejs/kit';
import type { Config } from '@sveltejs/adapter-vercel';
import type { RequestHandler } from './$types';
import { requireStaff } from '$lib/server/auth';
import { loadGameRoundQuestions } from '$lib/server/builder';
import { AiError, reviewQuestions, suggestQuestions, type AiRoundContext } from '$lib/server/ai';
import {
	draftToAi,
	promptKey,
	suggestionUsable,
	type AiQuestion,
	type Difficulty,
	type SuggestType
} from '$lib/builder/ai';

// AI-segéd a kvízösszerakóban (docs/features/ai-assistant.md). A javaslat
// kontextusa szándékosan CSAK ennek a kvízestnek a köre és kérdései (a
// szerver tölti be az adatbázisból), a kérdésbank többi része nem.
// Az AI-hívás lassú lehet, ezért hosszabb futásidő.
export const config: Config = { maxDuration: 120 };

type Body =
	| {
			op: 'suggest';
			round_id: string;
			count: number;
			type: SuggestType;
			difficulty: Difficulty;
			note?: string;
	  }
	| { op: 'review'; round_id: string; questions: AiQuestion[] };

const TYPES: SuggestType[] = ['mixed', 'single_choice', 'multi_choice', 'true_false', 'slider'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const [, body] = await Promise.all([
		requireStaff(locals, [1, 2]),
		request.json() as Promise<Body>
	]);
	const { supabase } = locals;
	const gameId = params.id;

	const [{ data: game }, { data: rounds }] = await Promise.all([
		supabase.from('games').select('title').eq('id', gameId).single(),
		supabase.from('rounds').select('id, title').eq('game_id', gameId).order('order_index')
	]);
	if (!game || !rounds) error(404, 'A kvízeste nem található.');
	const roundIndex = rounds.findIndex((r) => r.id === body.round_id);
	if (roundIndex === -1) error(400, 'A kör nem ehhez a kvízesthez tartozik.');

	try {
		if (body.op === 'suggest') {
			const count = Math.max(1, Math.min(10, Math.round(Number(body.count) || 5)));
			const type = TYPES.includes(body.type) ? body.type : 'mixed';
			const difficulty = DIFFICULTIES.includes(body.difficulty) ? body.difficulty : 'medium';
			const { rows, drafts } = await loadGameRoundQuestions(supabase, gameId);
			const byId = new Map(drafts.map((d) => [d.id, d]));
			const context: AiRoundContext[] = rounds.map((r) => ({
				title: r.title,
				questions: rows
					.filter((row) => row.round_id === r.id)
					.map((row) => byId.get(row.question_id))
					.filter((d) => !!d)
					.map((d) => {
						const q = draftToAi(d);
						delete q.key;
						return q;
					})
			}));
			const suggestions = await suggestQuestions({
				gameTitle: game.title,
				rounds: context,
				targetRound: roundIndex,
				count,
				type,
				difficulty,
				note: String(body.note ?? '').slice(0, 500)
			});
			// Az estén már szereplő kérdés (azonos szöveg) és a hibás szerkezetű
			// javaslat kimarad.
			const existing = new Set(drafts.map((d) => promptKey(d.prompt)));
			const usable = suggestions.filter(
				(s) => suggestionUsable(s) && !existing.has(promptKey(s.prompt))
			);
			if (usable.length === 0) {
				return json(
					{ error: 'Az AI nem adott használható javaslatot, próbáld újra.' },
					{ status: 502 }
				);
			}
			return json({ suggestions: usable });
		}

		if (body.op === 'review') {
			const questions = (body.questions ?? [])
				.filter((q) => q?.key && typeof q.prompt === 'string')
				.slice(0, 40) as (AiQuestion & { key: string })[];
			if (questions.length === 0) return json({ findings: [] });
			const findings = await reviewQuestions({
				gameTitle: game.title,
				roundTitle: rounds[roundIndex].title,
				questions
			});
			return json({ findings });
		}
	} catch (err) {
		if (err instanceof AiError) return json({ error: err.message }, { status: 502 });
		throw err;
	}

	return json({ error: 'Ismeretlen művelet.' }, { status: 400 });
};
