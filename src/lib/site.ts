import { env } from '$env/dynamic/public';
import type { Json } from '$lib/types/database.types';

// Két domain, egy Vercel projekt (docs/features/landing-and-registration.md):
//   PUBLIC_SITE_URL = https://kocsmakvizest.hu      — landing, esemény, lemondás, adatkezelés
//   PUBLIC_APP_URL  = https://app.kocsmakvizest.hu  — kezelő, host, csapatok, kivetítő
// Ha nincsenek beállítva (helyi fejlesztés, preview), minden egy hoston fut, és
// a linkek relatívak maradnak.

// A nyilvános oldal útvonalai; minden más az app-hoz tartozik.
const SITE_PREFIXES = ['/esemeny', '/lemondas', '/adatkezeles', '/impresszum', '/szabalyzat'];

export function isSitePath(pathname: string): boolean {
	return (
		pathname === '/' || SITE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
	);
}

function trimBase(url: string | undefined): string | null {
	const value = url?.trim().replace(/\/+$/, '');
	return value ? value : null;
}

export function siteBase(): string | null {
	return trimBase(env.PUBLIC_SITE_URL);
}

export function appBase(): string | null {
	return trimBase(env.PUBLIC_APP_URL);
}

export function siteUrl(path: string): string {
	return `${siteBase() ?? ''}${path}`;
}

export function appUrl(path: string): string {
	return `${appBase() ?? ''}${path}`;
}

// E-mailbe csak abszolút link mehet: a beállított nyilvános domain, különben a
// kérés saját originje.
export function absoluteSiteUrl(origin: string, path: string): string {
	return `${siteBase() ?? origin.replace(/\/+$/, '')}${path}`;
}

export type SiteInfo = {
	name: string;
	city: string;
	operatorName: string;
	contactEmail: string;
	/** Impresszum (Ekertv. 4. §): székhely, adószám, nyilvántartási szám */
	address: string;
	taxNumber: string;
	registration: string;
};

export function parseSiteInfo(raw: Json | null | undefined): SiteInfo {
	const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
	const text = (key: string) => {
		const value = obj[key];
		return typeof value === 'string' ? value.trim() : '';
	};
	return {
		name: text('site_name') || 'Kocsmakvízest',
		city: text('site_city'),
		operatorName: text('site_operator_name'),
		contactEmail: text('site_contact_email'),
		address: text('site_address'),
		taxNumber: text('site_tax_number'),
		registration: text('site_registration')
	};
}
