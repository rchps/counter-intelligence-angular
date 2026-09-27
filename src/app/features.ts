// Optional add-ons, kept as switches so one can be removed
// without touching the pages that host it. Set one to false and it disappears everywhere it shows up.
export const FEATURES = {
  /** "Try these instead": SDS lines to offer when someone searches for a brand SDS doesn't carry. */
  alternatives: true,
  /** "Use in an AI chat": copy the Line Card as plain text for an AI chat. */
  aiCopy: true,
} as const;
