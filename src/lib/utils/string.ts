
/**
 * Normalizes a string by removing accents and converting to lowercase.
 * Useful for case-insensitive and accent-insensitive searching.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Normalize multiple spaces
}

/**
 * Specifically cleans surnames by removing common prefixes like "Familia "
 */
export function cleanSurnames(str: string): string {
  let cleaned = str.trim();
  const prefix = "familia ";
  if (cleaned.toLowerCase().startsWith(prefix)) {
    cleaned = cleaned.substring(prefix.length).trim();
  }
  return cleaned;
}
