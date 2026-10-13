import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Room labels the page knows more about, keyed by the exact English label the service sends. A 'person' entry is a
 * KSS partner: shown with a photo when public/avatars/<photo>.webp exists, otherwise a plain person icon; never an
 * AI badge. A 'label' entry only gets its Persian name. Any other label is shown as served.
 */
export interface RoomLabel {
  label: string;
  kind: 'person' | 'label';
  photo?: string;
  name: { fa: string; en: string };
}

export const ROOM_LABELS: RoomLabel[] = [
  { label: 'Amir Mortazavi', kind: 'person', photo: 'partner-amir', name: { fa: 'امیر مرتضوی', en: 'Amir Mortazavi' } },
  { label: 'Babak Ghiasi', kind: 'person', photo: 'partner-babak', name: { fa: 'بابک غیاثی', en: 'Babak Ghiasi' } },
  { label: 'Matin', kind: 'person', photo: 'partner-matin', name: { fa: 'متین', en: 'Matin' } },
  { label: 'Mahmoud Danesh', kind: 'person', photo: 'partner-mahmoud', name: { fa: 'محمود دانش', en: 'Mahmoud Danesh' } },
  { label: 'Bybit trading', kind: 'label', name: { fa: 'معاملات Bybit', en: 'Bybit trading' } },
];

const DIR = path.join(process.cwd(), 'public', 'avatars');
export const photoIfPublished = (slug: string | undefined) => (slug && existsSync(path.join(DIR, slug + '.webp')) ? slug : null);

export function roomLabel(label: string): (RoomLabel & { photoSlug: string | null }) | null {
  const r = ROOM_LABELS.find((x) => x.label === label.trim());
  return r ? { ...r, photoSlug: photoIfPublished(r.photo) } : null;
}
