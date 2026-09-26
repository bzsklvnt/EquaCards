import { correctSuitIndex, draftError, type Draft, type QuestionTypeInfo } from './model';

// Ellenőrzés indulás előtt (Áttekintés nézet): hibák (az élő indítást
// tiltják) és figyelmeztetések. docs/features/quiz-builder.md.

export type BuilderRound = { id: string; title: string; keys: string[] };

export type Issue = {
	level: 'error' | 'warn';
	roundId: string;
	key: string | null;
	text: string;
};

export function computeIssues(
	rounds: BuilderRound[],
	drafts: Record<string, Draft>,
	types: QuestionTypeInfo[],
	playedCount: (questionId: string) => number,
	unsaved: (key: string) => boolean
): Issue[] {
	const issues: Issue[] = [];
	rounds.forEach((round, ri) => {
		const label = `${ri + 1}. kör`;
		if (round.keys.length === 0) {
			issues.push({ level: 'warn', roundId: round.id, key: null, text: `${label}: még üres.` });
		}
		let prevSuit: number | null = null;
		let number = 0;
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
			if (info) return;
			const suitIndex = correctSuitIndex(draft);
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
	});
	return issues;
}
