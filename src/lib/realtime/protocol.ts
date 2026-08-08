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
	// Egyetlen, előre formázott, emberi olvasásra kész string — a Fázis 4
	// egyelőre nem számol valós pontot (az evaluate_answer Edge Function
	// Fázis 5-ben készül el), ezért a payload csak a helyes választ mutatja,
	// nem a csapatok pontszámát. Lásd docs/architecture/REALTIME_PROTOCOL.md.
	correct_answer: string;
};
