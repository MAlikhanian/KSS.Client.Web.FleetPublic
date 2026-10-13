// Turns one photo into the site's avatar files: public/avatars/<slug>.webp (160 px) and <slug>@2x.webp (320 px),
// square, centre-cropped, with ALL metadata dropped (EXIF, GPS, XMP, ICC). The orientation is applied to the pixels
// first, so nothing depends on a tag that is then removed.
// The slug is the agent's first name in lower case, the same name the page already shows. Adding an avatar later is
// this one command plus a re-deploy: the page lists public/avatars at run time.
// Usage: node scripts/avatar.mjs <photo> <slug>
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const [input, slug] = process.argv.slice(2);
if (!input || !/^[a-z][a-z0-9-]{0,39}$/.test(slug ?? '')) {
  console.error('usage: node scripts/avatar.mjs <photo> <slug>   (slug: lower-case first name, a-z 0-9 -)');
  process.exit(2);
}
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'avatars');
for (const [size, suffix] of [
  [160, ''],
  [320, '@2x'],
]) {
  // sharp writes no metadata unless asked to (withMetadata / keepExif / keepIccProfile), so none is kept here.
  await sharp(input).rotate().resize(size, size, { fit: 'cover', position: 'attention' }).webp({ quality: 80, effort: 6 }).toFile(path.join(out, `${slug}${suffix}.webp`));
}
console.log(`avatar written: ${slug}`);
