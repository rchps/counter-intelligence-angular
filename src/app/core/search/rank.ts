// Orders search results best match first (see lineMatchRank for the tiers). The Line Card component
// does the rendering.

export interface RankableLine {
  name: string;
  normalizedName: string;
  normalizedShortName: string;
}

// Exact name match (case-insensitive, with or without the part in parentheses).
export function isExactName(line: RankableLine, normalizedSearch: string): boolean {
  return line.normalizedName === normalizedSearch || line.normalizedShortName === normalizedSearch;
}

// 0 = exact name, 1 = name starts with the search, 2 = name contains it, 3 = matched some other way
// (a brand alias or product term). Lower ranks sort first.
export function lineMatchRank(line: RankableLine, normalizedSearch: string): 0 | 1 | 2 | 3 {
  if (isExactName(line, normalizedSearch)) return 0;
  if (line.normalizedName.startsWith(normalizedSearch)) return 1;
  if (line.normalizedName.includes(normalizedSearch)) return 2;
  return 3;
}

// Per NN/g: rank the exact match first in ONE list. Don't hide the rest, and don't put it in a
// separate "best match" box (people skip those like ads).
export function sortByBestMatch<T extends RankableLine>(lines: T[], normalizedSearch: string): T[] {
  return [...lines].sort(
    (a, b) =>
      lineMatchRank(a, normalizedSearch) - lineMatchRank(b, normalizedSearch) ||
      a.name.localeCompare(b.name),
  );
}
