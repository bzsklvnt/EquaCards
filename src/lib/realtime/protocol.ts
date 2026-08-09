// Broadcast/presence esemény típusok a `game:{game_id}` csatornához.
// Séma forrás: docs/architecture/REALTIME_PROTOCOL.md — tartsd szinkronban.

export type PresenceTeam = { team_id: string; name: string };

export type TeamJoinedPayload = { team_id: string; name: string };

export type QuestionShowPayload = {
	question_id: string;
	question_type: string; // question_types.code
	round_title: string;
	prompt: string;
	image_url: string | null;
	time_limit_seconds: number;
	order_index: number;
	total_questions: number;
	// Szándékosan NINCS bennük helyes-válasz infó (is_correct / correct_value /
	// correct_position) — csak a question_reveal payload tartalmazza, a
	// megoldás feltárásakor.
	options?: { id: string; option_text: string }[]; // single_choice | multi_choice | true_false
	slider?: { min_value: number; max_value: number; step: number };
	ordering_items?: { id: string; item_text: string }[]; // véletlenszerűen összekevert sorrendben
};

export type TimerStartPayload = {
	question_id: string;
	duration: number; // másodperc
	server_start_time: string; // ISO timestamp
};

export type JokerActivatePayload = {
	team_id: string;
	question_id: string;
	joker_type: string;
};

export type AnswerLockedPayload = {
	question_id: string;
};

export type QuestionRevealPayload = {
	question_id: string;
	// Egyetlen, előre formázott, emberi olvasásra kész string. Szándékosan
	// NINCS benne pontszám sem Fázis 5-ben — a payload mindenkihez eljut a
	// csatornán, a csapatok pontja viszont csak a sajátjuké lehet (lásd
	// section 5 tervezési elve). A kliens a `team_answer_result` RPC-vel
	// kérdezi le a saját pontját ugyanerre a question_id-ra, a reveal
	// beérkezésekor. Lásd docs/architecture/REALTIME_PROTOCOL.md.
	correct_answer: string;
	// Fázis P6 — a host/TV megoldás-feltárás vizuális feldúsításához
	// (a csapatok saját telefonján marad az egyszerű, szöveges
	// correct_answer visszajelzés, ezeket a mezőket a /play NEM használja).
	// Reveal-kor (nem előtte) már biztonságosan nyilvános adat — pontosan
	// egy mező töltött ki a kérdés típusától függően:
	correct_option_ids?: string[]; // single_choice | multi_choice | true_false
	correct_value?: number; // slider
	correct_order?: { id: string; item_text: string }[]; // ordering
};

export type RoundLeaderboardRevealPayload = {
	round_id: string;
	round_title: string;
	top3: { team_id: string; name: string; round_score: number; rank: number }[];
};

export type FinalLeaderboardRevealPayload = {
	standings: { team_id: string; name: string; total_score: number; rank: number }[];
};
