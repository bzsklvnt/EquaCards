import { createSupabaseBrowserClient } from '$lib/supabase';

// Kérdés- és opcióképek feltöltése a question-images bucketbe (Fázis Q6,
// DATA_MODEL.md 8a). A feltöltés előtti tömörítés csökkenti a tárhelyet és
// a betöltési időt kocsmai wifin. Közös út: ImageUpload és a kvízösszerakó
// vászna (behúzás, beillesztés).

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_BY_TYPE: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp'
};

export class ImageUploadError extends Error {}

/** Feltölti a képet és visszaadja a nyilvános URL-t; hibánál ImageUploadError. */
export async function uploadQuestionImage(file: File): Promise<string> {
	if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
		throw new ImageUploadError('Csak JPG, PNG vagy WebP formátumú kép tölthető fel.');
	}
	if (file.size > MAX_IMAGE_BYTES) {
		throw new ImageUploadError('A kép mérete legfeljebb 5 MB lehet.');
	}
	try {
		const imageCompression = (await import('browser-image-compression')).default;
		const compressed = await imageCompression(file, {
			maxSizeMB: 1,
			maxWidthOrHeight: 1920,
			useWebWorker: true,
			fileType: file.type
		});
		const path = `${crypto.randomUUID()}.${EXT_BY_TYPE[file.type]}`;
		const supabase = createSupabaseBrowserClient();
		const { error } = await supabase.storage
			.from('question-images')
			.upload(path, compressed, { contentType: file.type });
		if (error) throw error;
		return supabase.storage.from('question-images').getPublicUrl(path).data.publicUrl;
	} catch {
		throw new ImageUploadError('Nem sikerült feltölteni a képet, próbáld újra.');
	}
}
