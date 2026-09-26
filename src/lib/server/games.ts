import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import {
	appendQuestionsToRound,
	saveParsedQuestion,
	type ParsedQuestionForm
} from '$lib/server/questions';

export function generatePin(): string {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

type GameInsert = Database['public']['Tables']['games']['Insert'];

/** Új kvízeste beszúrása egyedi PIN-nel: ütközéskor (egy futó estnek már ez a
 * PIN-je) új PIN-nel újrapróbálja. */
export async function insertGameWithPin(
	supabase: SupabaseClient<Database>,
	values: Omit<GameInsert, 'pin'>
): Promise<{ id: string } | { error: string }> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const { data, error } = await supabase
			.from('games')
			.insert({ ...values, pin: generatePin() })
			.select('id')
			.single();
		if (data) return { id: data.id };
		if (error?.code !== '23505') return { error: error?.message ?? 'Nem sikerült létrehozni.' };
	}
	return { error: 'Nem sikerült egyedi PIN-t generálni, próbáld újra.' };
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
	points_decay: true,
	reading_seconds: null
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

// A mintakérdés szerzője a bejelentkezett kezelő (admin_save_question: auth.uid()).
async function practiceQuestionIds(
	supabase: SupabaseClient<Database>
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
		.is('archived_at', null)
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
		const saved = await saveParsedQuestion(supabase, null, parsed);
		if ('error' in saved) return { error: saved.error };
		const question = saved;
		(seed.round === 1 ? result.round1 : result.round2).push(question.id);
	}
	return result;
}

export async function createPracticeGame(
	supabase: SupabaseClient<Database>,
	userId: string | undefined
): Promise<{ gameId: string } | { error: string }> {
	const questions = await practiceQuestionIds(supabase);
	if ('error' in questions) return questions;

	const stamp = new Date().toLocaleString('hu-HU', {
		timeZone: 'Europe/Budapest',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
	const created = await insertGameWithPin(supabase, {
		title: `Próbaeste – ${stamp}`,
		host_id: userId,
		is_practice: true,
		// Próbaestén szabad, név alapú csatlakozás (nincs jelentkezés, nincs csapatkód)
		join_requires_code: false
	});
	if ('error' in created) return { error: created.error };
	const game = created;

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
	if (error?.code === '23505') {
		// Egy futó estnek épp ugyanez a PIN-je: új PIN-nel nyitjuk újra.
		const { error: retryError } = await supabase
			.from('games')
			.update({ status: 'lobby', finished_at: null, pin: generatePin() })
			.eq('id', gameId)
			.eq('status', 'finished');
		return retryError ? { error: 'Nem sikerült újranyitni, próbáld újra.' } : null;
	}
	return error ? { error: error.message } : null;
}

// Kvízeste végleges törlése — csak rendszergazda (role_id = 1). A jogosultságot
// és a "futó este nem törölhető" szabályt az admin_delete_game() RPC és a
// games RLS is kikényszeríti (supabase/migrations/20260926190000_…).
export async function deleteGameAction(
	supabase: SupabaseClient<Database>,
	formData: FormData
): Promise<{ error: string } | { title: string }> {
	const gameId = formData.get('game_id');
	if (typeof gameId !== 'string' || !gameId) return { error: 'Hiányzó kvízeste azonosító.' };
	const { data, error } = await supabase.rpc('admin_delete_game', { p_game_id: gameId });
	if (error) {
		if (error.message.includes('game_running')) {
			return { error: 'Futó kvízestét nem lehet törölni — előbb zárd le.' };
		}
		if (error.code === '42501' || error.message.includes('insufficient_privilege')) {
			return { error: 'Kvízestét csak rendszergazda törölhet.' };
		}
		return { error: 'Nem sikerült törölni a kvízestét.' };
	}
	return { title: data ?? '' };
}
