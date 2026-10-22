export const TITLE_MAX = 120;

/** Length in Unicode code points, which is how the API counts characters. */
export function titleLength(title: string): number {
  return [...title].length;
}

/** Returns an error message, or null when the trimmed title is valid. */
export function validateTitle(raw: string): string | null {
  const title = raw.trim();
  const length = titleLength(title);
  if (length === 0) return 'Please enter a task title.';
  if (length > TITLE_MAX) {
    return `Title must be ${TITLE_MAX} characters or fewer (currently ${length}).`;
  }
  return null;
}
