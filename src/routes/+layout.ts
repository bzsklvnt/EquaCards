import { dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';

// A Supabase kliens csak ott töltődik be, ahol a böngészőnek kell (host,
// csapat, kivetítő — lásd $lib/supabase-load.ts). A kezelői oldalak a
// szerveren kérdeznek (locals.supabase), a nyilvános oldal pedig így nem
// tölti le a Supabase könyvtárat, és nem kerül a HTML-be munkamenet-adat.
injectAnalytics({ mode: dev ? 'development' : 'production' });
