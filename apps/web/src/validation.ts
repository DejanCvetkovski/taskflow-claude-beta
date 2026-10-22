export const TITLE_MAX = 120;

/** Returns an error message, or null when the trimmed title is valid. */
export function validateTitle(raw: string): string | null {
  const title = raw.trim();
  if (title.length === 0) return 'Please enter a task title.';
  if (title.length > TITLE_MAX) {
    return `Title must be ${TITLE_MAX} characters or fewer (currently ${title.length}).`;
  }
  return null;
}
