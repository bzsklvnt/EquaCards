/** Join Tailwind / conditional class strings (no extra dependency). */
export function cn(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(' ');
}
