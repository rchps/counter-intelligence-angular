// Logos come in every shape, from square badges to 14:1 wordmarks. Fitting each to the same box makes
// the wide ones look huge and the compact ones tiny, so instead each gets about the same area: the area
// of an EQUAL_AREA_SIDE square. For width:height ratio r that's a height of EQUAL_AREA_SIDE / sqrt(r).

const MAX_HEIGHT = 52; // the logo plate's 72px minus its 10px top and bottom padding
const EQUAL_AREA_SIDE = 72;

/** The display height in px for a logo with these natural dimensions, or null if it has none (the
 *  stylesheet's default sizing applies then). Never taller than the image itself, so a small image isn't
 *  enlarged and blurred. */
export function balancedLogoHeight(naturalWidth: number, naturalHeight: number): number | null {
  if (!naturalWidth || !naturalHeight) return null;
  const ratio = naturalWidth / naturalHeight;
  return Math.round(Math.min(MAX_HEIGHT, naturalHeight, EQUAL_AREA_SIDE / Math.sqrt(ratio)));
}
