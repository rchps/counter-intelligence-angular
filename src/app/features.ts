// ANGULAR_CONVERSION.md section 7: build.py's MODULES list, kept as switches so an add-on can be removed
// without touching the pages that host it. Set one to false and it disappears everywhere it shows up.
export const FEATURES = {
  /** "Try these instead": SDS lines to offer when someone searches for a brand SDS doesn't carry. */
  alternatives: true,
  /** "Use in an AI chat": copy the Line Card as plain text for an AI chat. */
  aiCopy: true,
} as const;
