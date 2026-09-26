import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import type { BankItem, Draft } from '$lib/builder/model';

type Client = SupabaseClient<Database>;

// A kvízösszerakó szerver-oldali adatbetöltése — docs/features/quiz-builder.md.

/** A megadott kérdések teljes (típusadatokkal együtti) piszkozata, az ids sorrendjében. */
export async function loadDrafts(supabase: Client, ids: string[]): Promise<Draft[]> {
	if (ids.length === 0) return [];
	const [{ data: questions }, { data: options }, { data: sliders }, { data: items }] =
		await Promise.all([
			supabase
				.from('questions')
				.select(
					'id, theme_id, prompt, image_url, image_pixelate, points, points_multiplier, time_limit_seconds, points_decay, reading_seconds, question_types(code)'
				)
				.in('id', ids),
			supabase
				.from('question_choice_options')
				.select('question_id, option_text, image_url, is_correct, order_index')
				.in('question_id', ids)
				.order('order_index'),
			supabase
				.from('question_slider_config')
				.select('question_id, min_value, max_value, step, correct_value, tolerance')
				.in('question_id', ids),
			supabase
				.from('question_ordering_items')
				.select('question_id, item_text, correct_position')
				.in('question_id', ids)
				.order('correct_position')
		]);

	const byId = new Map<string, Draft>();
	for (const q of questions ?? []) {
		const slider = sliders?.find((s) => s.question_id === q.id);
		const ordering = (items ?? []).filter((i) => i.question_id === q.id).map((i) => i.item_text);
		byId.set(q.id, {
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
			options: (options ?? [])
				.filter((o) => o.question_id === q.id)
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
		});
	}
	return ids.map((id) => byId.get(id)).filter((d): d is Draft => !!d);
}

export async function loadBank(supabase: Client, gameId: string): Promise<BankItem[]> {
	const [{ data: questions }, { data: usage }] = await Promise.all([
		supabase
			.from('questions')
			.select('id, prompt, theme_id, image_url, created_at, question_types(code)')
			.order('created_at', { ascending: false }),
		supabase
			.from('round_questions')
			.select('question_id, rounds!inner(game_id, games!inner(title, started_at))')
			.neq('rounds.game_id', gameId)
			.not('rounds.games.started_at', 'is', null)
	]);

	const played = new Map<string, { count: number; last: string; at: string }>();
	for (const u of usage ?? []) {
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

	return (questions ?? []).map((q) => ({
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

export async function readingDefault(supabase: Client): Promise<number> {
	const { data } = await supabase
		.from('app_settings')
		.select('value')
		.eq('key', 'question_reading_seconds')
		.maybeSingle();
	const value = Number(data?.value);
	return Number.isFinite(value) && value >= 0 ? value : 5;
}
