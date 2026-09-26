import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// A szerverfüggvények Dublinban (dub1) futnak, ugyanabban a régióban,
			// mint a Supabase adatbázis (eu-west-1) — docs/DECISIONS_LOG.md, kódaudit.
			adapter: adapter({ runtime: 'nodejs22.x', regions: ['dub1'] })
		})
	]
});
