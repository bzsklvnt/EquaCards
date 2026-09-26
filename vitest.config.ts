import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// Egységtesztek (npm test): a kliens és szerver közös, tiszta logikája —
// kérdés-validáció, köri állás, rate limit.
export default defineConfig({
	plugins: [sveltekit()],
	test: { include: ['src/**/*.test.ts'], environment: 'node' }
});
