// The manufacturers someone keeps coming back to: the ones they've pinned and the ones they opened last.
// Both are lists of line names, since a name is unique (validate-data checks it) and survives data updates.

export const MAX_RECENT = 6;

/** A saved list of names, or an empty one if nothing is saved or it isn't a list of strings. */
export function parseNames(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** Pins `name` at the end of the list, or unpins it if it's already there. */
export function togglePinned(pinned: readonly string[], name: string): string[] {
  return pinned.includes(name) ? pinned.filter((item) => item !== name) : [...pinned, name];
}

/** Moves `name` to the front of the recent list, keeping at most `max`. */
export function pushRecent(recent: readonly string[], name: string, max = MAX_RECENT): string[] {
  return [name, ...recent.filter((item) => item !== name)].slice(0, max);
}

/** The lines with these names, in the names' order. Names no longer in the data are skipped. */
export function linesByName<T extends { name: string }>(
  lines: readonly T[],
  names: readonly string[],
): T[] {
  const byName = new Map(lines.map((line) => [line.name, line]));
  return names.flatMap((name) => byName.get(name) ?? []);
}
