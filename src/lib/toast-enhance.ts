import { toast } from 'svelte-sonner';
import type { SubmitFunction } from '@sveltejs/kit';

/**
 * Egységes use:enhance callback minden admin form mentéshez — Fázis N5,
 * a korábban admin/users + admin/settings-ben egyedileg megírt minta
 * megosztott változata. A `setSubmitting` opcionális, hogy a hívó oldal
 * a Button `loading` prop-jához köthesse (submit közbeni vizuális jelzés).
 */
export function withToast(options?: {
	successMessage?: string;
	setSubmitting?: (value: boolean) => void;
}): SubmitFunction {
	return () => {
		options?.setSubmitting?.(true);
		return async ({ result, update }) => {
			options?.setSubmitting?.(false);
			if (result.type === 'success') {
				if (options?.successMessage) toast.success(options.successMessage);
			} else if (result.type === 'failure') {
				toast.error((result.data?.error as string) ?? 'Nem sikerült a művelet.');
			} else if (result.type === 'error') {
				toast.error('Váratlan hiba történt.');
			}
			await update();
		};
	};
}
