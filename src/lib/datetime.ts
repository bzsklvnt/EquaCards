// A kvízesték időpontja magyar idő szerint értendő, a szerver (Vercel) viszont
// UTC-ben fut — ezek a függvények a <input type="datetime-local"> értékét
// (időzóna nélküli "YYYY-MM-DDTHH:mm") Europe/Budapest szerint értelmezik.
const TIME_ZONE = 'Europe/Budapest';

function partsInZone(date: Date): Record<string, string> {
	const formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone: TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	});
	return Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
}

export function toBudapestLocalInput(iso: string | null | undefined): string {
	if (!iso) return '';
	const p = partsInZone(new Date(iso));
	return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function fromBudapestLocalInput(value: string): string | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
	if (!m) return null;
	const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
	const p = partsInZone(new Date(asUtc));
	const zoneAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
	return new Date(asUtc - (zoneAsUtc - asUtc)).toISOString();
}

export function formatEventDate(iso: string): string {
	return new Date(iso).toLocaleString('hu-HU', {
		timeZone: TIME_ZONE,
		month: 'long',
		day: 'numeric',
		weekday: 'long',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function eventDateParts(iso: string): {
	day: string;
	month: string;
	weekday: string;
	time: string;
} {
	const date = new Date(iso);
	const fmt = (opts: Intl.DateTimeFormatOptions) =>
		date.toLocaleString('hu-HU', { timeZone: TIME_ZONE, ...opts });
	return {
		day: fmt({ day: 'numeric' }).replace('.', ''),
		month: fmt({ month: 'short' }).replace('.', ''),
		weekday: fmt({ weekday: 'long' }),
		time: fmt({ hour: '2-digit', minute: '2-digit' })
	};
}
