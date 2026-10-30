/** True when every word of `query` appears somewhere in the given fields (case-insensitive). */
export function matchesSearch(query: string, ...fields: (string | number | string[] | undefined | null)[]): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = fields.flat().filter((f) => f !== undefined && f !== null).join(" ").toLowerCase();
  return words.every((w) => haystack.includes(w));
}
