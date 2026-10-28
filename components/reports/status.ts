/**
 * Status words a report may already use, and the colour each one takes. Generic vocabulary only; the report's own
 * text is never changed. A word is coloured only where it is unmistakably a status:
 *   - a table cell whose whole text is the word;
 *   - a parenthesised note that starts with the word, e.g. "(word)" or "(word، more)";
 *   - a bold span whose whole text is the word.
 * Anything else stays as written: a word inside an ordinary sentence is never guessed at.
 */

export type StatusTone = 'ok' | 'progress' | 'bad';

export const STATUS_WORDS: Record<string, StatusTone> = {
  // Done, proven or resolved.
  'تأییدشده': 'ok',
  'برطرف‌شده': 'ok',
  'بازیابی‌شده': 'ok',
  'مهارشده': 'ok',
  'رفع ابهام‌شده': 'ok',
  // Still moving, or not yet proven.
  'در حال تکمیل': 'progress',
  'در حال بازیابی': 'progress',
  'در حال تأیید': 'progress',
  'مشکوک': 'progress',
  // Open, unresolved or lost.
  'باز': 'bad',
  'رفع‌نشده': 'bad',
  'از دست رفته': 'bad',
};

/** The tone of a text that is exactly one status word (after trimming), or null. */
export function statusOf(text: string): StatusTone | null {
  return STATUS_WORDS[text.trim()] ?? null;
}

const WORDS = Object.keys(STATUS_WORDS)
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

/** "(word)" or "(word، …)" / "(word, …)": the word must open the note and end at the bracket or a comma. */
export const STATUS_NOTE = new RegExp(`\\((${WORDS})(?=[)،,])[^()]*\\)`, 'g');
