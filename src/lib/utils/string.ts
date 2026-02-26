
/**
 * Normalizes a string by removing accents and converting to lowercase.
 * Useful for case-insensitive and accent-insensitive searching.
 */
export function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
