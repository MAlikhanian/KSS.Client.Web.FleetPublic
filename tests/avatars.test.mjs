// The shipped avatar files: every one is a WebP with ONLY image data in it (no EXIF, XMP or ICC chunk, so no GPS,
// camera or editing trail), at the two sizes the page uses, and each 1x file has its 2x partner.
// Run: node --test tests/avatars.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'avatars');
const IMAGE_CHUNKS = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF']);

/** The RIFF chunk ids of a WebP file, in order. */
function chunks(buf) {
  assert.equal(buf.toString('latin1', 0, 4), 'RIFF');
  assert.equal(buf.toString('latin1', 8, 12), 'WEBP');
  const ids = [];
  for (let at = 12; at + 8 <= buf.length; ) {
    const id = buf.toString('latin1', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    ids.push(id);
    at += 8 + size + (size % 2);
  }
  return ids;
}

test('control: the checker finds metadata when a file carries it (an invented image, written WITH EXIF)', async () => {
  const withMeta = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#808080' } })
    .withExif({ IFD0: { ImageDescription: 'synthetic control' } })
    .webp()
    .toBuffer();
  assert.ok(chunks(withMeta).includes('EXIF'), 'an EXIF chunk is detected');
});

test('every avatar is a clean WebP: image chunks only, 160 px and 320 px, in pairs', async () => {
  const files = readdirSync(DIR);
  assert.ok(files.length > 0, 'there are avatars to check');
  for (const f of files) {
    assert.match(f, /^[a-z][a-z0-9-]*(@2x)?\.webp$/, `${f}: a slug name, nothing else`);
    const buf = readFileSync(path.join(DIR, f));
    const extra = chunks(buf).filter((id) => !IMAGE_CHUNKS.has(id));
    assert.deepEqual(extra, [], `${f}: no metadata chunk (found ${extra.join(', ')})`);
    const { width, height } = await sharp(buf).metadata();
    const want = f.includes('@2x') ? 320 : 160;
    assert.equal(width, want, `${f}: ${want} px wide`);
    assert.equal(height, want, `${f}: square`);
  }
  for (const f of files.filter((x) => !x.includes('@2x'))) assert.ok(files.includes(f.replace('.webp', '@2x.webp')), `${f}: has its 2x file`);
});
