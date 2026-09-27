// Text helpers shared by all of search: normalizing what people type and what the data says, so the two
// can be compared.

// Lower-case, strip accents, turn "&" into "and", and turn every run of punctuation into one space.
// "SECO-LARM / Enforcer" -> "seco larm enforcer"
export function normalize(text: string | null | undefined): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accent marks
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Same as normalize() but with no spaces at all, so "cat 6" and "cat6" compare equal.
export function removeSpaces(text: string | null | undefined): string {
  return normalize(text).replace(/ /g, '');
}

// Split a search into normalized words: "Horn-Strobe  24V" -> ["horn", "strobe", "24v"]
export function searchWordsOf(text: string | null | undefined): string[] {
  return normalize(text).split(' ').filter(Boolean);
}

// "https://www.altronix.com/" -> "altronix.com"
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Make text safe to drop into HTML.
export function escapeHtml(text: string): string {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(text).replace(/[&<>"']/g, (character) => replacements[character]);
}

// Wrap the parts of `text` that match the search words in <mark> tags.
// Punctuation between letters is allowed, so "secolarm" still highlights "SECO-LARM".
export function highlightMatches(text: string, searchWords: string[]): string {
  if (!searchWords.length) return escapeHtml(text);

  const escapeForRegex = (character: string) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = searchWords.map((word) => word.split('').map(escapeForRegex).join('[^a-z0-9]*'));
  const matcher = new RegExp('(' + patterns.join('|') + ')', 'gi');

  let result = '';
  let lastEnd = 0;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text)) !== null) {
    if (match[0] === '') {
      matcher.lastIndex++;
      continue;
    }
    result +=
      escapeHtml(text.slice(lastEnd, match.index)) + '<mark>' + escapeHtml(match[0]) + '</mark>';
    lastEnd = match.index + match[0].length;
  }
  return result + escapeHtml(text.slice(lastEnd));
}
