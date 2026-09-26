import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { draftToFormData, type Draft, type QuestionTypeInfo } from '$lib/builder/model';
import {
	createQuestionFromForm,
	parseQuestionForm,
	replaceQuestionTypeData,
	validateQuestionForm
} from '$lib/server/questions';
import { loadDrafts } from '$lib/server/builder';

// A kvízösszerakó műveletei (automatikus mentés, átrendezés, kérdésbank,
// körök) — docs/features/quiz-builder.md. Minden művelet a kezelő saját
// Supabase kliensén fut, tehát az RLS és a security-definer RPC-k
// szerepkör-ellenőrzése (role_id 1–2) érvényesül; az itteni ellenőrzés csak
// a korai, érthető hibaüzenetért van.

type Body =
	| { op: 'save'; draft: Draft; round_id?: string; order?: string[] }
	| { op: 'setRound'; round_id: string; question_ids: string[] }
	| { op: 'setStandings'; round_id: string; question_id: string; show: boolean }
	| { op: 'duplicate'; question_id: string; round_id: string; order: string[] }
	| { op: 'addFromBank'; round_id: string; order: string[]; new_ids: string[] }
	| { op: 'draw'; round_id: string; theme_id: string; count: number }
	| { op: 'drawAll'; theme_id: string; count: number }
	| { op: 'addRound'; title: string }
	| { op: 'renameRound'; round_id: string; title: string }
	| { op: 'deleteRound'; round_id: string };

const NEW = '__new__';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const { supabase, safeGetSession } = locals;
	const { user } = await safeGetSession();
	if (!user) error(401, 'Bejelentkezés szükséges.');
	const { data: profile } = await supabase
		.from('profiles')
		.select('role_id')
		.eq('id', user.id)
		.single();
	if (!profile || ![1, 2].includes(profile.role_id)) error(403, 'Nincs jogosultságod.');

	const body = (await request.json()) as Body;
	const gameId = params.id;

	async function roundBelongsToGame(roundId: string): Promise<boolean> {
		const { data } = await supabase
			.from('rounds')
			.select('id')
			.eq('id', roundId)
			.eq('game_id', gameId)
			.maybeSingle();
		return !!data;
	}

	async function setRound(roundId: string, ids: string[]): Promise<string | null> {
		const { error: rpcError } = await supabase.rpc('admin_set_round_questions', {
			p_round_id: roundId,
			p_question_ids: ids
		});
		return rpcError?.message ?? null;
	}

	async function roundIds(roundId: string): Promise<string[]> {
		const { data } = await supabase
			.from('round_questions')
			.select('question_id')
			.eq('round_id', roundId)
			.order('order_index');
		return (data ?? []).map((r) => r.question_id);
	}

	if ('round_id' in body && body.round_id && !(await roundBelongsToGame(body.round_id))) {
		error(400, 'A kör nem ehhez a kvízesthez tartozik.');
	}

	switch (body.op) {
		case 'save': {
			const { data: types } = await supabase
				.from('question_types')
				.select('id, code, label, min_options, max_options');
			const typeList = (types ?? []) as QuestionTypeInfo[];
			const formData = draftToFormData(body.draft, typeList);

			if (!body.draft.id) {
				const created = await createQuestionFromForm(supabase, formData, user.id);
				if ('error' in created) return json({ error: created.error }, { status: 400 });
				if (body.round_id) {
					const order = (body.order ?? [NEW]).map((k) => (k === NEW ? created.id : k));
					if (!order.includes(created.id)) order.push(created.id);
					const failure = await setRound(body.round_id, order);
					if (failure) {
						return json(
							{ id: created.id, error: `A kérdés elmentve, de nem került a körbe: ${failure}` },
							{ status: 400 }
						);
					}
				}
				return json({ id: created.id });
			}

			const type = typeList.find((t) => t.code === body.draft.type_code);
			if (!type) return json({ error: 'Érvénytelen kérdéstípus.' }, { status: 400 });
			const parsed = parseQuestionForm(formData, type.code);
			const validationError = validateQuestionForm(parsed, type);
			if (validationError) return json({ error: validationError }, { status: 400 });

			const { error: updateError } = await supabase
				.from('questions')
				.update({
					theme_id: parsed.theme_id,
					question_type_id: parsed.question_type_id,
					prompt: parsed.prompt,
					image_url: parsed.image_url,
					image_pixelate: parsed.image_pixelate,
					points: parsed.points,
					points_multiplier: parsed.points_multiplier,
					time_limit_seconds: parsed.time_limit_seconds,
					points_decay: parsed.points_decay,
					reading_seconds: parsed.reading_seconds
				})
				.eq('id', body.draft.id);
			if (updateError) return json({ error: updateError.message }, { status: 400 });
			const childError = await replaceQuestionTypeData(supabase, body.draft.id, parsed);
			if (childError) return json({ error: childError }, { status: 400 });
			return json({ id: body.draft.id });
		}

		case 'setRound': {
			const failure = await setRound(body.round_id, body.question_ids);
			if (failure) return json({ error: failure }, { status: 400 });
			return json({ ok: true });
		}

		case 'setStandings': {
			const { error: updateError } = await supabase
				.from('round_questions')
				.update({ show_standings: body.show })
				.eq('round_id', body.round_id)
				.eq('question_id', body.question_id);
			if (updateError) return json({ error: updateError.message }, { status: 400 });
			return json({ ok: true });
		}

		case 'duplicate': {
			const { data: newId, error: dupError } = await supabase.rpc('admin_duplicate_question', {
				p_question_id: body.question_id
			});
			if (dupError || !newId) {
				return json({ error: dupError?.message ?? 'Nem sikerült másolni.' }, { status: 400 });
			}
			const failure = await setRound(
				body.round_id,
				body.order.map((k) => (k === NEW ? newId : k))
			);
			if (failure) return json({ error: failure }, { status: 400 });
			const [draft] = await loadDrafts(supabase, [newId]);
			return json({ id: newId, draft });
		}

		case 'addFromBank': {
			const failure = await setRound(body.round_id, body.order);
			if (failure) return json({ error: failure }, { status: 400 });
			return json({ drafts: await loadDrafts(supabase, body.new_ids) });
		}

		case 'draw': {
			const before = new Set(await roundIds(body.round_id));
			const { error: drawError } = await supabase.rpc('draw_random_questions_for_round', {
				p_theme_id: body.theme_id,
				p_round_id: body.round_id,
				p_count: Math.max(1, Math.min(40, Math.round(body.count)))
			});
			if (drawError) return json({ error: drawError.message }, { status: 400 });
			const after = await roundIds(body.round_id);
			const added = after.filter((id) => !before.has(id));
			if (added.length === 0) {
				return json(
					{ error: 'Nincs elérhető (nem pihentetett) kérdés ebben a témában.' },
					{ status: 400 }
				);
			}
			return json({ question_ids: after, drafts: await loadDrafts(supabase, added) });
		}

		case 'drawAll': {
			// Szándékosan soros: a húzás a last_used_at cooldown-szűrőre
			// támaszkodik, amit a round_questions insert triggere frissít.
			const { data: rounds } = await supabase
				.from('rounds')
				.select('id, title')
				.eq('game_id', gameId)
				.order('order_index');
			const result: Record<string, string[]> = {};
			const addedAll: string[] = [];
			const errors: string[] = [];
			for (const round of rounds ?? []) {
				const before = new Set(await roundIds(round.id));
				const { error: drawError } = await supabase.rpc('draw_random_questions_for_round', {
					p_theme_id: body.theme_id,
					p_round_id: round.id,
					p_count: Math.max(1, Math.min(40, Math.round(body.count)))
				});
				if (drawError) errors.push(`„${round.title}”: ${drawError.message}`);
				const after = await roundIds(round.id);
				result[round.id] = after;
				addedAll.push(...after.filter((id) => !before.has(id)));
			}
			return json({
				rounds: result,
				drafts: await loadDrafts(supabase, addedAll),
				error: errors.length > 0 ? errors.join(' ') : undefined
			});
		}

		case 'addRound': {
			const title = body.title.trim();
			if (!title) return json({ error: 'A kör neve kötelező.' }, { status: 400 });
			const { data: last } = await supabase
				.from('rounds')
				.select('order_index')
				.eq('game_id', gameId)
				.order('order_index', { ascending: false })
				.limit(1);
			const { data: round, error: insertError } = await supabase
				.from('rounds')
				.insert({ game_id: gameId, title, order_index: (last?.[0]?.order_index ?? 0) + 1 })
				.select('id, title')
				.single();
			if (insertError || !round) {
				return json({ error: insertError?.message ?? 'Nem sikerült.' }, { status: 400 });
			}
			return json({ round });
		}

		case 'renameRound': {
			const title = body.title.trim();
			if (!title) return json({ error: 'A kör neve kötelező.' }, { status: 400 });
			const { error: updateError } = await supabase
				.from('rounds')
				.update({ title })
				.eq('id', body.round_id);
			if (updateError) return json({ error: updateError.message }, { status: 400 });
			return json({ ok: true });
		}

		case 'deleteRound': {
			const { error: deleteError } = await supabase.from('rounds').delete().eq('id', body.round_id);
			if (deleteError) return json({ error: deleteError.message }, { status: 400 });
			return json({ ok: true });
		}
	}

	return json({ error: 'Ismeretlen művelet.' }, { status: 400 });
};
