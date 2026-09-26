import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import {
	appendQuestionsToRound,
	insertQuestionTypeData,
	type ParsedQuestionForm
} from '$lib/server/questions';

export function generatePin(): string {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

// Próbaeste (docs/features/guided-tours.md): a mintakérdések egy saját témába
// kerülnek, és csak az első alkalommal jönnek létre — utána újrahasznosítjuk
// őket. Így a gyakorlás sosem "használja el" a valódi kérdésbank kérdéseit
// (a random húzás last_used_at-alapú türelmi idejét nem érinti).
export const PRACTICE_THEME_TITLE = 'Próbaeste – mintakérdések';

const FLAG_IMAGE =
	'data:image/svg+xml;utf8,' +
	encodeURIComponent(
		"<svg xmlns='http://www.w3.org/2000/svg' width='900' height='600' viewBox='0 0 900 600'><rect width='900' height='600' fill='#ffffff'/><circle cx='450' cy='300' r='180' fill='#bc002d'/></svg>"
	);

type Seed = {
	type: string;
	round: 1 | 2;
	form: Omit<ParsedQuestionForm, 'theme_id' | 'question_type_id'>;
};

const base = {
	image_url: null,
	image_pixelate: false,
	points: 1000,
	points_multiplier: 1,
	time_limit_seconds: 20,
	points_decay: true
};

const choices = (texts: string[], correct: number[]) =>
	texts.map((option_text, i) => ({
		option_text,
		image_url: null,
		is_correct: correct.includes(i),
		order_index: i
	}));

const SEEDS: Seed[] = [
	{
		type: 'single_choice',
		round: 1,
		form: {
			...base,
			prompt: 'Hány játékos van egyszerre a pályán egy futballcsapatból?',
			choiceOptions: choices(['9', '10', '11', '12'], [2])
		}
	},
	{
		type: 'true_false',
		round: 1,
		form: {
			...base,
			prompt: 'A Rubik-kockát egy magyar feltaláló, Rubik Ernő alkotta meg.',
			choiceOptions: choices(['Igaz', 'Hamis'], [0])
		}
	},
	{
		type: 'multi_choice',
		round: 1,
		form: {
			...base,
			time_limit_seconds: 30,
			prompt: 'Melyek magyar találmányok? (Több helyes válasz is lehet.)',
			choiceOptions: choices(
				['Golyóstoll', 'Holográfia', 'Rubik-kocka', 'Telefon', 'Villanykörte', 'Gőzmozdony'],
				[0, 1, 2]
			)
		}
	},
	{
		type: 'single_choice',
		round: 2,
		form: {
			...base,
			image_url: FLAG_IMAGE,
			image_pixelate: true,
			prompt: 'Melyik ország zászlaja látható a képen?',
			choiceOptions: choices(['Japán', 'Grönland', 'Kanada', 'Svájc'], [0])
		}
	},
	{
		type: 'slider',
		round: 2,
		form: {
			...base,
			prompt: 'Hány méter magas az Országház kupolája?',
			sliderConfig: { min_value: 50, max_value: 150, step: 1, correct_value: 96, tolerance: 3 }
		}
	},
	{
		type: 'ordering',
		round: 2,
		form: {
			...base,
			time_limit_seconds: 30,
			prompt: 'Állítsd időrendbe, a legkorábbival kezdve!',
			orderingItems: [
				{ item_text: 'Honfoglalás', correct_position: 1 },
				{ item_text: 'Mohácsi csata', correct_position: 2 },
				{ item_text: '1848-as forradalom', correct_position: 3 },
				{ item_text: 'Rendszerváltás', correct_position: 4 }
			]
		}
	}
];

async function practiceQuestionIds(
	supabase: SupabaseClient<Database>,
	userId: string | undefined
): Promise<{ round1: string[]; round2: string[] } | { error: string }> {
	let { data: theme } = await supabase
		.from('themes')
		.select('id')
		.eq('title', PRACTICE_THEME_TITLE)
		.maybeSingle();
	if (!theme) {
		const { data, error } = await supabase
			.from('themes')
			.insert({ title: PRACTICE_THEME_TITLE })
			.select('id')
			.single();
		if (error || !data) return { error: error?.message ?? 'Nem sikerült a próbatémát létrehozni.' };
		theme = data;
	}

	const { data: existing } = await supabase
		.from('questions')
		.select('id')
		.eq('theme_id', theme.id)
		.order('created_at');
	if (existing && existing.length > 0) {
		const half = Math.ceil(existing.length / 2);
		return {
			round1: existing.slice(0, half).map((q) => q.id),
			round2: existing.slice(half).map((q) => q.id)
		};
	}

	const { data: types } = await supabase.from('question_types').select('id, code');
	const typeId = new Map((types ?? []).map((t) => [t.code, t.id]));
	const result = { round1: [] as string[], round2: [] as string[] };

	for (const seed of SEEDS) {
		const questionTypeId = typeId.get(seed.type);
		if (!questionTypeId) return { error: `Ismeretlen kérdéstípus: ${seed.type}` };
		const parsed: ParsedQuestionForm = {
			...seed.form,
			theme_id: theme.id,
			question_type_id: questionTypeId
		};
		const { data: question, error } = await supabase
			.from('questions')
			.insert({
				theme_id: parsed.theme_id,
				question_type_id: parsed.question_type_id,
				prompt: parsed.prompt,
				image_url: parsed.image_url,
				image_pixelate: parsed.image_pixelate,
				points: parsed.points,
				points_multiplier: parsed.points_multiplier,
				time_limit_seconds: parsed.time_limit_seconds,
				points_decay: parsed.points_decay,
				created_by: userId
			})
			.select('id')
			.single();
		if (error || !question)
			return { error: error?.message ?? 'Nem sikerült a mintakérdést létrehozni.' };
		const childError = await insertQuestionTypeData(supabase, question.id, parsed);
		if (childError) return { error: childError };
		(seed.round === 1 ? result.round1 : result.round2).push(question.id);
	}
	return result;
}

export async function createPracticeGame(
	supabase: SupabaseClient<Database>,
	userId: string | undefined
): Promise<{ gameId: string } | { error: string }> {
	const questions = await practiceQuestionIds(supabase, userId);
	if ('error' in questions) return questions;

	const stamp = new Date().toLocaleString('hu-HU', {
		timeZone: 'Europe/Budapest',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
	const { data: game, error } = await supabase
		.from('games')
		.insert({
			title: `Próbaeste – ${stamp}`,
			pin: generatePin(),
			host_id: userId,
			is_practice: true
		})
		.select('id')
		.single();
	if (error || !game) return { error: error?.message ?? 'Nem sikerült a próbaestét létrehozni.' };

	const { data: rounds, error: roundsError } = await supabase
		.from('rounds')
		.insert([
			{ game_id: game.id, title: 'Bemelegítő', order_index: 1 },
			{ game_id: game.id, title: 'Képek és számok', order_index: 2 }
		])
		.select('id, order_index');
	if (roundsError || !rounds || rounds.length !== 2) {
		await supabase.from('games').delete().eq('id', game.id);
		return { error: roundsError?.message ?? 'Nem sikerült a próbaest köreit létrehozni.' };
	}

	for (const round of rounds) {
		const ids = round.order_index === 1 ? questions.round1 : questions.round2;
		const { error: appendError } = await appendQuestionsToRound(supabase, round.id, ids);
		if (appendError) {
			await supabase.from('games').delete().eq('id', game.id);
			return { error: appendError };
		}
	}

	return { gameId: game.id };
}

// Fázis Q3 — a "Kvízeste újranyitása" a games.status-t 'lobby'-ra állítja
// vissza (nem 'active'-re és nem 'paused'-re, lásd docs/DECISIONS_LOG.md), és
// törli a finished_at-ot; a trg_audit_games trigger naplózza. A kvízestek
// listája és az este saját oldalai (Körök, Esemény) is ezt használják.
export async function reopenGameAction(
	supabase: SupabaseClient<Database>,
	formData: FormData
): Promise<{ error: string } | null> {
	const gameId = formData.get('game_id');
	if (typeof gameId !== 'string' || !gameId) return { error: 'Hiányzó kvízeste azonosító.' };
	const { error } = await supabase
		.from('games')
		.update({ status: 'lobby', finished_at: null })
		.eq('id', gameId)
		.eq('status', 'finished');
	return error ? { error: error.message } : null;
}
