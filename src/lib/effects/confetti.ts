// Ünneplő animáció a kör-végi/végső Top 3 reveal-hez (Fázis I —
// "Játékélmény polírozás"), kizárólag az 1. helyezett csapatnál sül el.
// A `canvas-confetti` egy kicsi, függőségmentes csomag — nincs értelme
// saját konfetti-rendszert építeni ugyanerre.

import confetti from 'canvas-confetti';

export function fireWinnerConfetti() {
	if (typeof window === 'undefined') return;

	confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
	confetti({ particleCount: 60, spread: 100, origin: { y: 0.6 }, startVelocity: 45 });
}
