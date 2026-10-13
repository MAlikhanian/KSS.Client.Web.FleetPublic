import { readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Server-only: which agents have a photo. The list is the files present in public/avatars, read once per server
 * process, so adding a photo is one file drop (scripts/avatar.mjs) and a re-deploy. The browser never probes for a
 * file: a page only links a photo that exists. A photo is keyed by its slug, the lower-case first name the page
 * already shows; nothing else about an agent reaches a file name.
 */
let present: Set<string> | null = null;

function manifest(): Set<string> {
  if (present) return present;
  try {
    present = new Set(
      readdirSync(path.join(process.cwd(), 'public', 'avatars'))
        .map((f) => /^([a-z][a-z0-9-]{0,39})\.webp$/.exec(f)?.[1])
        .filter((s): s is string => !!s),
    );
  } catch {
    present = new Set();
  }
  return present;
}

/** The slug for a first name, or null when it cannot be one (then the generic avatar is used). */
export function slugOf(firstName: string): string | null {
  const s = firstName.trim().toLowerCase();
  return /^[a-z][a-z0-9-]{0,39}$/.test(s) ? s : null;
}

/** The photo slug for a first name when its file is present, else null. */
export function photoFor(firstName: string): string | null {
  const s = slugOf(firstName);
  return s && manifest().has(s) ? s : null;
}
