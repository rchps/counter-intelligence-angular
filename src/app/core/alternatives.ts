import { normalize } from './search/normalize';

// Ported from modules/alternatives.html ("Try these instead"): which brands SDS doesn't carry a search
// points to, so the Line Card can offer SDS lines that cover the same ground.

export interface AlternativeBrand {
  brand: string;
  /** What a rep might type. */
  match: string[];
  /** SDS lines to offer instead (names match lines.json exactly; validate-data checks). */
  offer: string[];
  /** Optional, factual (e.g. NDAA Section 889). */
  note?: string;
}

export interface BrandsForSearchInput {
  brands: AlternativeBrand[];
  carriedNames: string[];
  search: string;
  /** The typo-corrected search, when there is one ("hickvision" -> "hikvision"). */
  correctedSearch: string;
}

export function brandsForSearch({
  brands,
  carriedNames,
  search,
  correctedSearch,
}: BrandsForSearchInput): AlternativeBrand[] {
  const typed = normalize(correctedSearch || search);
  if (!typed) return [];

  const carried = carriedNames.map((name) => normalize(name));
  // While someone is still typing the start of a line we DO carry ("honeywell"), don't guess a
  // not-carried brand that merely starts the same way ("Honeywell Home").
  const partialGuessAllowed = !carried.some((name) => name.startsWith(typed));

  return brands.filter((brand) => {
    if (carried.includes(normalize(brand.brand))) return false; // SDS carries it now
    return brand.match.some((spelling) => {
      const term = normalize(spelling);
      const exact = typed === term;
      const insideLongerSearch = term.length >= 4 && ` ${typed} `.includes(` ${term} `);
      const stillTyping = partialGuessAllowed && typed.length >= 4 && term.startsWith(typed);
      return exact || insideLongerSearch || stillTyping;
    });
  });
}
