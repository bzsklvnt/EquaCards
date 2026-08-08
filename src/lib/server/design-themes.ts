// Megosztott form-feldolgozás az admin design-themes new/[id] oldalakhoz.

export type ParsedDesignTheme = {
	title: string;
	is_default: boolean;
	design_tokens: Record<string, string>;
};

export function parseDesignThemeForm(formData: FormData): ParsedDesignTheme | { error: string } {
	const title = (formData.get('title') as string)?.trim();
	if (!title) {
		return { error: 'A téma neve kötelező.' };
	}

	const tokensRaw = (formData.get('design_tokens') as string) ?? '';
	let parsedTokens: unknown;
	try {
		parsedTokens = JSON.parse(tokensRaw);
	} catch {
		return { error: 'A token-készlet nem érvényes JSON.' };
	}

	if (
		typeof parsedTokens !== 'object' ||
		parsedTokens === null ||
		Array.isArray(parsedTokens) ||
		Object.values(parsedTokens).some((v) => typeof v !== 'string')
	) {
		return { error: 'A token-készlet egy sima { kulcs: "érték" } objektum kell legyen.' };
	}

	return {
		title,
		is_default: formData.get('is_default') === 'true',
		design_tokens: parsedTokens as Record<string, string>
	};
}
