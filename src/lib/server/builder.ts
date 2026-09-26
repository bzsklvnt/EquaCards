import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import type { BankItem, Draft, QuestionUsage } from '$lib/builder/model';

type Client = SupabaseClient<Database>;

// A kvízösszerakó szerver-oldali adatbetöltése — docs/features/quiz-builder.md.

// A Supabase API egy kérésre legfeljebb 1000 sort ad vissza — a kérdésbank
// ennél nagyobb is lehet, ezért a teljes listák lapozva töltődnek.
const PAGE = 1000;

export async function fetchAllRows<T>(
	page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
	const rows: T[] = [];
	for (let from = 0; ; from += PAGE) {
		const { data, error } = await page(from, from + PAGE - 1);
		if (error || !data) break;
		rows.push(...data);
		if (data.length < PAGE) break;
	}
	return rows;
}

const DRAFT_COLUMNS =
	'id, theme_id, prompt, image_url, image_pixelate, points, points_multiplier, time_limit_seconds, points_decay, reading_seconds, question_types(code), question_choice_options(option_text, image_url, is_correct, order_index), question_slider_config(min_value, max_value, step, correct_value, tolerance), question_ordering_items(item_text, correct_position)';

type DraftRow = {
	id: string;
	theme_id: string | null;
	prompt: string;
	image_url: string | null;
	image_pixelate: boolean;
	points: number | null;
	points_multiplier: number | null;
	time_limit_seconds: number | null;
	points_decay: boolean | null;
	reading_seconds: number | null;
	question_types: { code: string } | null;
	question_choice_options:
		| { option_text: string; image_url: string | null; is_correct: boolean; order_index: number }[]
		| null;
	question_slider_config: {
		min_value: number;
		max_value: number;
		step: number;
		correct_value: number;
		tolerance: number;
	} | null;
	question_ordering_items: { item_text: string; correct_position: number }[] | null;
};

function toDraft(q: DraftRow): Draft {
	const slider = q.question_slider_config;
	const ordering = [...(q.question_ordering_items ?? [])]
		.sort((a, b) => a.correct_position - b.correct_position)
		.map((i) => i.item_text);
	return {
		key: q.id,
		id: q.id,
		type_code: q.question_types?.code ?? 'single_choice',
		theme_id: q.theme_id,
		prompt: q.prompt,
		image_url: q.image_url,
		image_pixelate: q.image_pixelate,
		points: q.points ?? 1000,
		points_multiplier: Number(q.points_multiplier ?? 1),
		time_limit_seconds: q.time_limit_seconds ?? 30,
		points_decay: q.points_decay ?? true,
		reading_seconds: q.reading_seconds,
		options: [...(q.question_choice_options ?? [])]
			.sort((a, b) => a.order_index - b.order_index)
			.map((o) => ({ text: o.option_text, image_url: o.image_url, is_correct: o.is_correct })),
		slider: slider
			? {
					min_value: Number(slider.min_value),
					max_value: Number(slider.max_value),
					step: Number(slider.step),
					correct_value: Number(slider.correct_value),
					tolerance: Number(slider.tolerance)
				}
			: { min_value: 0, max_value: 100, step: 1, correct_value: 50, tolerance: 0 },
		ordering: ordering.length > 0 ? ordering : ['', '', '']
	};
}

/** A megadott kérdések teljes (típusadatokkal együtti) piszkozata, az ids sorrendjében
 * — egyetlen, beágyazott lekérdezéssel. */
export async function loadDrafts(supabase: Client, ids: string[]): Promise<Draft[]> {
	if (ids.length === 0) return [];
	const { data } = await supabase.from('questions').select(DRAFT_COLUMNS).in('id', ids);
	const byId = new Map(((data ?? []) as unknown as DraftRow[]).map((q) => [q.id, toDraft(q)]));
	return ids.map((id) => byId.get(id)).filter((d): d is Draft => !!d);
}

/** Egy kvízeste köreinek kérdései a teljes piszkozatokkal együtt, egy lekérdezésben. */
export async function loadGameRoundQuestions(supabase: Client, gameId: string) {
	const { data } = await supabase
		.from('round_questions')
		.select(
			`round_id, question_id, order_index, show_standings, rounds!inner(game_id), questions(${DRAFT_COLUMNS})`
		)
		.eq('rounds.game_id', gameId)
		.order('order_index');
	const rows = (data ?? []) as unknown as {
		round_id: string;
		question_id: string;
		show_standings: boolean;
		questions: DraftRow | null;
	}[];
	const drafts = new Map<string, Draft>();
	for (const r of rows) if (r.questions) drafts.set(r.question_id, toDraft(r.questions));
	return {
		rows: rows.map(({ round_id, question_id, show_standings }) => ({
			round_id,
			question_id,
			show_standings
		})),
		drafts: [...drafts.values()]
	};
}

export async function loadBank(supabase: Client, gameId?: string): Promise<BankItem[]> {
	const [questions, usage] = await Promise.all([
		fetchAllRows((from, to) =>
			supabase
				.from('questions')
				.select('id, prompt, theme_id, image_url, created_at, question_types(code)')
				.is('archived_at', null)
				.order('created_at', { ascending: false })
				.order('id')
				.range(from, to)
		),
		fetchAllRows((from, to) => {
			let query = supabase
				.from('round_questions')
				.select(
					'question_id, rounds!inner(game_id, games!rounds_game_id_fkey!inner(title, started_at))'
				)
				.not('rounds.games.started_at', 'is', null);
			if (gameId) query = query.neq('rounds.game_id', gameId);
			return query.order('question_id').order('round_id').range(from, to);
		})
	]);

	const played = new Map<string, { count: number; last: string; at: string }>();
	for (const u of usage) {
		const game = u.rounds?.games;
		if (!game?.started_at) continue;
		const prev = played.get(u.question_id);
		if (!prev) played.set(u.question_id, { count: 1, last: game.title, at: game.started_at });
		else {
			prev.count += 1;
			if (game.started_at > prev.at) {
				prev.last = game.title;
				prev.at = game.started_at;
			}
		}
	}

	return questions.map((q) => ({
		id: q.id,
		prompt: q.prompt,
		theme_id: q.theme_id,
		type_code: q.question_types?.code ?? '',
		has_image: !!q.image_url,
		created_at: q.created_at,
		played_count: played.get(q.id)?.count ?? 0,
		played_last: played.get(q.id)?.last ?? null
	}));
}

/** A kérdés-beállítások alapértékei egy lekérdezésben (Beállítások › Játék). */
export async function questionDefaults(
	supabase: Client
): Promise<{ readingDefault: number; defaultTime: number }> {
	const { data } = await supabase
		.from('app_settings')
		.select('key, value')
		.in('key', ['question_reading_seconds', 'question_default_time_seconds']);
	const value = (key: string) => Number(data?.find((r) => r.key === key)?.value);
	const reading = value('question_reading_seconds');
	const time = value('question_default_time_seconds');
	return {
		readingDefault: Number.isFinite(reading) && reading >= 0 ? reading : 5,
		defaultTime: Number.isInteger(time) && time >= 5 && time <= 600 ? time : 30
	};
}

/** Mely estéken (körökben) szerepel a kérdés — a kérdésbank „Hol szerepel” listája. */
export async function loadUsage(supabase: Client, questionId: string): Promise<QuestionUsage[]> {
	const { data } = await supabase
		.from('round_questions')
		.select('rounds!inner(title, games!rounds_game_id_fkey(id, title, status, scheduled_at))')
		.eq('question_id', questionId);
	return (data ?? [])
		.map((row) => {
			const game = row.rounds?.games;
			return game
				? {
						game_id: game.id,
						game_title: game.title,
						status: game.status,
						scheduled_at: game.scheduled_at,
						round_title: row.rounds.title
					}
				: null;
		})
		.filter((u): u is QuestionUsage => !!u)
		.sort((a, b) => (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''));
}
