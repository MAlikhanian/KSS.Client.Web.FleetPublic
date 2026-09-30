// Fails the build if anything from the signed-in world reaches this public app.
//
// Scans the built output (.next, excluding the build cache and bundled
// node_modules) and the dependency manifest for sign-in and private-API
// markers. The public site holds no session and calls no private API, so a
// single hit means something was wired in that must not be.
//
// It proves it can fire before it is trusted: a planted marker in a temporary
// directory must be caught, and the real scan must cover a non-zero number of
// files. Either failure exits non-zero, so a broken check cannot read as a pass.
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const NEEDLES = ['next-auth', 'NEXTAUTH', '/api/web', '/api/auth', 'getServerSession'];
const SKIP_DIRS = new Set(['cache', 'node_modules']);
const TEXT = /\.(js|mjs|cjs|json|html|rsc|txt|map|css|body|meta)$/i;

function scan(dir) {
  const hits = [];
  let files = 0;
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(p);
        continue;
      }
      if (!TEXT.test(entry.name)) continue;
      files++;
      const text = readFileSync(p, 'utf8');
      for (const n of NEEDLES) if (text.includes(n)) hits.push(`${path.relative(ROOT, p)}: ${n}`);
    }
  };
  walk(dir);
  return { hits, files };
}

// 1. Self-test: the scanner must catch a planted marker.
const probe = mkdtempSync(path.join(tmpdir(), 'fleet-public-check-'));
try {
  writeFileSync(path.join(probe, 'planted.js'), 'import x from "next-auth/react";');
  if (scan(probe).hits.length !== 1) {
    console.error('[check-build-output] SELF-TEST FAILED: the scanner did not catch a planted marker.');
    process.exit(2);
  }
} finally {
  rmSync(probe, { recursive: true, force: true });
}

// 2. The dependency manifest must not name any sign-in package.
const failures = [];
for (const f of ['package.json', 'package-lock.json']) {
  try {
    const text = readFileSync(path.join(ROOT, f), 'utf8');
    if (text.includes('"next-auth') || text.includes('node_modules/next-auth')) failures.push(`${f}: next-auth`);
  } catch {
    /* package-lock.json may be absent in a local, lockfile-free check */
  }
}

// 3. The built output.
const out = path.join(ROOT, '.next');
try {
  statSync(out);
} catch {
  console.error('[check-build-output] no .next directory: run `next build` first.');
  process.exit(2);
}
const { hits, files } = scan(out);
if (files === 0) {
  console.error('[check-build-output] scanned 0 files: the check did not run.');
  process.exit(2);
}
failures.push(...hits);

if (failures.length) {
  console.error(`[check-build-output] FAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`[check-build-output] OK: ${files} built files scanned, self-test fired, no sign-in or private-API marker.`);
