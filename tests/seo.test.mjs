// SEO and indexability of the public site, against the production build.
// Run after `next build`:  node --test tests/seo.test.mjs
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://fleet.kss.ir';

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

let server;
let base;
before(async () => {
  assert.ok(existsSync(path.join(ROOT, '.next', 'BUILD_ID')), 'run `next build` first');
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
});
after(async () => {
  if (server) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
});

const meta = (html, attr, key) => {
  const m = html.match(new RegExp(`<meta[^>]*${attr}="${key.replace(/[.:]/g, '\\$&')}"[^>]*content="([^"]*)"`));
  return m ? m[1] : null;
};

for (const [lang, route, otherHref] of [
  ['fa', '/', '/en'],
  ['en', '/en', '/'],
]) {
  describe(`page ${route} (${lang}) is a public, indexable page`, () => {
    let res;
    let html;
    before(async () => {
      res = await fetch(`${base}${route}`);
      html = await res.text();
    });

    test('200, served over its own origin only', () => assert.equal(res.status, 200));
    test('indexable: no noindex in meta or header', () => {
      assert.doesNotMatch(html, /noindex/i);
      assert.equal(res.headers.get('x-robots-tag'), null);
      assert.equal(meta(html, 'name', 'robots'), 'index, follow');
    });
    test('lang and direction on <html>', () => {
      assert.match(html, new RegExp(`<html lang="${lang}" dir="${lang === 'fa' ? 'rtl' : 'ltr'}"`));
    });
    test('a unique title and a description', () => {
      assert.match(html, /<title>[^<]{5,}<\/title>/);
      assert.ok((meta(html, 'name', 'description') ?? '').length > 20);
    });
    test('canonical and hreflang alternates (fa, en, x-default)', () => {
      assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}${route === '/' ? '' : route}/?"`));
      for (const hl of ['fa', 'en', 'x-default']) assert.match(html, new RegExp(`<link rel="alternate" hrefLang="${hl}" href="${SITE}`));
      assert.ok(html.includes(`${SITE}${otherHref === '/' ? '' : otherHref}`));
    });
    test('Open Graph and Twitter card with this language\'s share image', () => {
      const img = `${SITE}/${lang === 'fa' ? 'og-fa.png' : 'og.png'}`;
      assert.equal(meta(html, 'property', 'og:image'), img);
      assert.equal(meta(html, 'property', 'og:image:width'), '1200');
      assert.equal(meta(html, 'property', 'og:image:height'), '630');
      assert.equal(meta(html, 'name', 'twitter:image'), img);
      assert.ok(meta(html, 'property', 'og:title'));
      assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image');
    });
    test('JSON-LD: Organization and WebSite, valid JSON', () => {
      const m = html.match(/<script type="application\/ld\+json">([^<]*)<\/script>/);
      assert.ok(m, 'JSON-LD present');
      const types = JSON.parse(m[1])['@graph'].map((n) => n['@type']);
      assert.deepEqual(types.sort(), ['Organization', 'WebSite']);
    });
    test('exactly one <h1>', () => assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1));
    test('the team chart section is there, and never shows a technical code', () => {
      // This suite runs with no snapshot service, so the section is the graceful notice.
      assert.match(html, /data-chart-state="(ok|empty|unavailable)"/);
      assert.ok(!html.includes('SNAPSHOT_') && !html.includes('FLEET_'), 'no error code reaches the page');
    });
    test('HTTPS only: Strict-Transport-Security is sent', () => {
      assert.match(res.headers.get('strict-transport-security') ?? '', /max-age=\d+/);
    });
    test('no cookie is set', () => assert.equal(res.headers.get('set-cookie'), null));
  });
}

describe('Persian pages use the company legal name; English pages are unchanged', () => {
  let LEGAL;
  let fa;
  let en;
  before(async () => {
    ({ LEGAL_NAME_FA: LEGAL } = await import('../components/copy.ts'));
    fa = await (await fetch(`${base}/`)).text();
    en = await (await fetch(`${base}/en`)).text();
  });
  const visibleText = (html) =>
    html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<head[\s\S]*?<\/head>/, ' ').replace(/<[^>]+>/g, ' ');

  test('the legal name uses Persian letters only (no Arabic kaf U+0643 or yeh U+064A)', () => {
    assert.ok(LEGAL.length > 4);
    assert.ok(![...LEGAL].some((c) => c === 'ك' || c === 'ي'));
    assert.ok([...LEGAL].includes('ک') && [...LEGAL].includes('ی'));
  });
  test('fa: title, description and Open Graph title carry the legal name', () => {
    assert.ok((fa.match(/<title>([^<]*)<\/title>/) ?? [])[1]?.includes(LEGAL));
    assert.ok(meta(fa, 'name', 'description')?.includes(LEGAL));
    assert.ok(meta(fa, 'property', 'og:title')?.includes(LEGAL));
    assert.ok(meta(fa, 'name', 'twitter:title')?.includes(LEGAL));
  });
  test('fa: JSON-LD Organization name is the legal name, with KSS as alternateName', () => {
    const org = JSON.parse(fa.match(/<script type="application\/ld\+json">([^<]*)<\/script>/)[1])['@graph'].find((n) => n['@type'] === 'Organization');
    assert.equal(org.name, LEGAL);
    assert.equal(org.alternateName, 'KSS');
  });
  test('fa: no "KSS" left in the visible Persian text', () => {
    assert.doesNotMatch(visibleText(fa), /KSS/);
    assert.ok(visibleText(fa).includes(LEGAL));
  });
  test('en: unchanged, still "The KSS AI team", and no Persian legal name anywhere', () => {
    assert.match(en, /<title>The KSS AI team<\/title>/);
    assert.ok(!en.includes(LEGAL));
  });
});

describe('crawl files and icons', () => {
  test('robots.txt allows crawling and names the sitemap', async () => {
    const t = await (await fetch(`${base}/robots.txt`)).text();
    assert.match(t, /User-Agent: \*/i);
    assert.match(t, /Allow: \//);
    assert.doesNotMatch(t, /Disallow: \/\s*$/m, 'must not disallow the whole site');
    assert.match(t, new RegExp(`Sitemap: ${SITE}/sitemap.xml`));
  });
  test('sitemap.xml lists both languages', async () => {
    const t = await (await fetch(`${base}/sitemap.xml`)).text();
    assert.ok(t.includes(`<loc>${SITE}/</loc>`));
    assert.ok(t.includes(`<loc>${SITE}/en</loc>`));
  });
  for (const p of ['/og.png', '/og-fa.png', '/favicon.ico', '/icon.svg', '/apple-touch-icon.png']) {
    test(`${p} is served`, async () => assert.equal((await fetch(`${base}${p}`)).status, 200));
  }
  for (const p of ['/og.png', '/og-fa.png']) {
    test(`${p} is a 1200x630 PNG`, async () => {
      const b = Buffer.from(await (await fetch(`${base}${p}`)).arrayBuffer());
      assert.equal(b.subarray(1, 4).toString('latin1'), 'PNG');
      assert.equal(b.readUInt32BE(16), 1200);
      assert.equal(b.readUInt32BE(20), 630);
    });
  }
});
