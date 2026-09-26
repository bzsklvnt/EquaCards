import { describe, expect, it } from 'vitest';
import { recordFailure, tooManyFailures } from '$lib/server/rate-limit';

describe('PIN-találgatás elleni védelem', () => {
	it('a sikeres csatlakozások nem fogyasztják a keretet', () => {
		// Csak a recordFailure számít — sikeres csatlakozáskor nem hívjuk.
		expect(tooManyFailures('pub-ip', 3, 60_000)).toBe(false);
	});

	it('a keret betelte után a további próbálkozás tiltott', () => {
		for (let i = 0; i < 3; i++) recordFailure('attacker-ip', 60_000);
		expect(tooManyFailures('attacker-ip', 3, 60_000)).toBe(true);
		expect(tooManyFailures('other-ip', 3, 60_000)).toBe(false);
	});
});
