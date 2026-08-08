// Hangeffektek a host/csapat/TV felülethez (Fázis 6 — "Polírozás").
//
// Ebben a sandboxban nincs mód valódi hangfájlokat beszerezni/tesztelni
// (nincs audio-asset pipeline), ezért a Web Audio API oszcillátoraival
// generált, rövid szintetikus hangokat használunk beágyazott fájlok
// helyett — nulla extra asset, nulla hálózati függés.

let audioContext: AudioContext | null = null;
let muted = false;

function getContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (!audioContext) {
		const Ctor =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Ctor) return null;
		audioContext = new Ctor();
	}
	// A böngészők autoplay-szabálya miatt az AudioContext "suspended"
	// állapotban indulhat, amíg nincs felhasználói gesztus — a resume()
	// hívás user-gesztus (kattintás) kontextusában nem-op, ha már fut.
	if (audioContext.state === 'suspended') void audioContext.resume();
	return audioContext;
}

export function setMuted(value: boolean) {
	muted = value;
}

export function isMuted() {
	return muted;
}

type Tone = { freq: number; start: number; duration: number; type?: OscillatorType; gain?: number };

function playTones(tones: Tone[]) {
	if (muted) return;
	const ctx = getContext();
	if (!ctx) return;
	try {
		const now = ctx.currentTime;
		for (const tone of tones) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = tone.type ?? 'square';
			osc.frequency.setValueAtTime(tone.freq, now + tone.start);
			const peak = tone.gain ?? 0.15;
			gain.gain.setValueAtTime(0, now + tone.start);
			gain.gain.linearRampToValueAtTime(peak, now + tone.start + 0.01);
			gain.gain.exponentialRampToValueAtTime(0.001, now + tone.start + tone.duration);
			osc.connect(gain).connect(ctx.destination);
			osc.start(now + tone.start);
			osc.stop(now + tone.start + tone.duration + 0.02);
		}
	} catch {
		// Hangkimenet nélküli környezet (pl. fejtelen teszt) — csendben elnyelve.
	}
}

/** Rövid, magas "tick" — timer visszaszámlálás utolsó másodpercei. */
export function playTick() {
	playTones([{ freq: 880, start: 0, duration: 0.08, gain: 0.1 }]);
}

/** Lejáró timer — mélyebb, hosszabb búgás. */
export function playCountdownEnd() {
	playTones([{ freq: 220, start: 0, duration: 0.4, type: 'sawtooth', gain: 0.18 }]);
}

/** Helyes válasz — emelkedő három hangból álló dallam. */
export function playCorrect() {
	playTones([
		{ freq: 523.25, start: 0, duration: 0.12 },
		{ freq: 659.25, start: 0.1, duration: 0.12 },
		{ freq: 783.99, start: 0.2, duration: 0.22 }
	]);
}

/** Helytelen/részleges válasz — ereszkedő, disszonáns pár. */
export function playIncorrect() {
	playTones([
		{ freq: 233.08, start: 0, duration: 0.18, type: 'sawtooth' },
		{ freq: 196.0, start: 0.14, duration: 0.28, type: 'sawtooth' }
	]);
}

/** Megoldás feltárása — semleges "ding", mielőtt kiderül a saját eredmény. */
export function playReveal() {
	playTones([{ freq: 987.77, start: 0, duration: 0.15, gain: 0.12 }]);
}

/** Joker aktiválása — felfelé ívelő "power-up" arpeggio. */
export function playJokerActivate() {
	playTones([
		{ freq: 392, start: 0, duration: 0.1 },
		{ freq: 523.25, start: 0.08, duration: 0.1 },
		{ freq: 659.25, start: 0.16, duration: 0.1 },
		{ freq: 987.77, start: 0.24, duration: 0.2 }
	]);
}

/** Kör-/végeredmény ranglista feltárása — rövid fanfár. */
export function playLeaderboard() {
	playTones([
		{ freq: 523.25, start: 0, duration: 0.1 },
		{ freq: 523.25, start: 0.12, duration: 0.1 },
		{ freq: 783.99, start: 0.24, duration: 0.3 }
	]);
}
