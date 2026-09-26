import { TOURS, type TourId } from './tours';
import { markTourSeen } from './state.svelte';

function isVisible(anchor: string): boolean {
	const el = document.querySelector(`[data-tour="${anchor}"]`);
	if (!el) return false;
	const rect = el.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
}

export async function startTour(id: TourId) {
	const [{ driver }] = await Promise.all([
		import('driver.js'),
		import('driver.js/dist/driver.css')
	]);

	// Az épp nem látható elemekhez tartozó lépéseket kihagyjuk (pl. üres kör,
	// mobilon elrejtett oldalsáv), így a "3 / 7" számláló is pontos marad.
	const steps = TOURS[id].steps
		.filter((step) => !step.element || isVisible(step.element))
		.map((step) => ({
			element: step.element ? `[data-tour="${step.element}"]` : undefined,
			popover: { title: step.title, description: step.description, side: step.side }
		}));

	const tour = driver({
		steps,
		showProgress: true,
		progressText: '{{current}} / {{total}}',
		nextBtnText: 'Tovább →',
		prevBtnText: '← Vissza',
		doneBtnText: 'Kész',
		popoverClass: 'equacards-tour',
		overlayColor: '#0b0718',
		overlayOpacity: 0.72,
		stagePadding: 6,
		stageRadius: 8,
		onDestroyed: () => markTourSeen(id)
	});
	tour.drive();
}
