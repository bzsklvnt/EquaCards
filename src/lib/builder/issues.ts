import {
	correctSuitIndex,
	draftError,
	isChoiceType,
	type Draft,
	type QuestionTypeInfo
} from './model';

// Ellenőrzés indulás előtt (Áttekintés nézet): hibák (az élő indítást
// tiltják) és figyelmeztetések. docs/features/quiz-builder.md.

export type BuilderRound = { id: string; title: string; keys: string[] };

export type Issue = {
	level: 'error' | 'warn';
	roundId: string;
	key: string | null;
	text: string;
	/** Az AI-ellenőrzés észrevétele (docs/features/ai-assistant.md). */
	ai?: boolean;
};

/** Telefonon ennél hosszabb kérdés / válasz már lenyomja a lapokat. */
export const PHONE_PROMPT_MAX = 160;
export const PHONE_OPTION_MAX = 45;

/** Szabályalapú (AI nélküli) figyelmeztetések egy kérdésre. */
export function draftWarnings(draft: Draft): string[] {
	const out: string[] = [];
	if (draft.type_code === 'info') return out;
	const prompt = draft.prompt.trim();
	if (draft.layout.phone_prompt && prompt.length > PHONE_PROMPT_MAX) {
		out.push(
			`hosszú a kérdés a telefonhoz (${prompt.length} karakter, javasolt ≤ ${PHONE_PROMPT_MAX}).`
		);
	}
	if (isChoiceType(draft.type_code) && draft.type_code !== 'true_false') {
		const long = draft.options
			.map((o, i) => ({ i, len: o.text.trim().length }))
			.filter((o) => o.len > PHONE_OPTION_MAX);
		if (long.length > 0) {
			out.push(
				`hosszú válasz a telefonhoz: ${long.map((o) => 'ABCDEFGH'[o.i]).join(', ')} (javasolt ≤ ${PHONE_OPTION_MAX} karakter).`
			);
		}
		const seen = new Map<string, number>();
		const dupes: string[] = [];
		draft.options.forEach((o, i) => {
			const norm = o.text.trim().toLocaleLowerCase('hu').replace(/\s+/g, ' ');
			if (!norm) return;
			const first = seen.get(norm);
			if (first !== undefined) dupes.push(`${'ABCDEFGH'[first]}–${'ABCDEFGH'[i]}`);
			else seen.set(norm, i);
		});
		if (dupes.length > 0) out.push(`azonos válaszlehetőségek (${dupes.join(', ')}).`);
	}
	return out;
}

export function computeIssues(
	rounds: BuilderRound[],
	drafts: Record<string, Draft>,
	types: QuestionTypeInfo[],
	playedCount: (questionId: string) => number,
	unsaved: (key: string) => boolean,
	aiNotes: (key: string) => string[] = () => []
): Issue[] {
	const issues: Issue[] = [];
	rounds.forEach((round, ri) => {
		const label = `${ri + 1}. kör`;
		if (round.keys.length === 0) {
			issues.push({ level: 'warn', roundId: round.id, key: null, text: `${label}: még üres.` });
		}
		let prevSuit: number | null = null;
		let number = 0;
		const suits: number[] = [];
		round.keys.forEach((key) => {
			const draft = drafts[key];
			if (!draft) return;
			const info = draft.type_code === 'info';
			if (!info) number += 1;
			const where = info ? `${label}, magyarázó dia` : `${label}, ${number}. kérdés`;
			const error = draftError(draft, types);
			if (error) {
				issues.push({ level: 'error', roundId: round.id, key, text: `${where}: ${error}` });
			} else if (unsaved(key)) {
				issues.push({
					level: 'warn',
					roundId: round.id,
					key,
					text: `${where}: mentés folyamatban.`
				});
			}
			if (draft.id && playedCount(draft.id) > 0) {
				issues.push({
					level: 'warn',
					roundId: round.id,
					key,
					text: `${where}: már elhangzott egy korábbi estén.`
				});
			}
			for (const text of draftWarnings(draft)) {
				issues.push({ level: 'warn', roundId: round.id, key, text: `${where}: ${text}` });
			}
			for (const text of aiNotes(key)) {
				issues.push({ level: 'warn', roundId: round.id, key, text: `${where}: ${text}`, ai: true });
			}
			if (info) return;
			const suitIndex = correctSuitIndex(draft);
			if (suitIndex !== null) suits.push(suitIndex);
			if (suitIndex !== null && suitIndex === prevSuit) {
				issues.push({
					level: 'warn',
					roundId: round.id,
					key,
					text: `${where}: ugyanaz a helyes lap, mint az előzőnél.`
				});
			}
			prevSuit = suitIndex;
		});
		// Kitalálható minta: a körben minden helyes válasz ugyanazon a lapon.
		if (suits.length >= 4 && suits.every((x) => x === suits[0])) {
			issues.push({
				level: 'warn',
				roundId: round.id,
				key: null,
				text: `${label}: minden helyes válasz ugyanazon a lapon (${'ABCDEFGH'[suits[0]]}).`
			});
		}
	});
	return issues;
}
