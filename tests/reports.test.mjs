// Report pages (/reports/[slug]): the Markdown subset, the data checks, the Tehran/Jalali/Persian-digit formatting,
// and the served pages against report files in a temporary directory. Neutral placeholder content only.
// Runs against the production build (`next build` first); starts `next start` on free local ports and stops it.
// Run: node --test tests/reports.test.mjs
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

register('./support/resolve-ts.mjs', import.meta.url);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { parseReportMarkdown, parseInline, splitRow } = await import('../components/reports/markdown.ts');
const { statusOf } = await import('../components/reports/status.ts');
const { parseReportData } = await import('../components/reports/schema.ts');
const { faDigits, faNumber, tehranDay, tehranDayLong, tehranTime } = await import('../components/reports/format.ts');

// ---------------------------------------------------------------------------------------------------------------
// Neutral fixtures.

const MD = `:::opening
## Opening statement
A neutral opening paragraph.
:::

# Example report title

A paragraph with item 42 and \`code 7\` and **bold text**.

> A callout line.

## 1. Section one

| Column A | Column B |
|---|---|
| value 1 | \`a|b\` |
| value 2 | **strong** |
| value 3 | تأییدشده |

A neutral sentence (باز، note) and another (مشکوک) and a **رفع‌نشده** word.

A long note (تأییدشده، a deliberately long neutral note that runs well past the width of a phone screen and must wrap onto further lines) ends here.

:::callout-warn
A neutral warning box.
:::

:::callout-info
A neutral information box.
:::

:::callout-ok
A neutral good-news box.
:::

- first item
  - nested item
- second item

1. step one
2. step two

<script>alert(1)</script>

{{chart:sample-line}}

{{chart:sample-bar}}

{{chart:sample-pie}}

:::closing
## Closing statement
A neutral closing paragraph.
:::
`;

const DATA = (slug, extra = {}) => ({
  slug,
  timeline: [
    { at: '2026-01-15T20:30:00Z', title_fa: 'رویداد نمونه', detail_fa: 'شرح نمونه', kind: 'action' },
    { at: '2026-01-15T10:00:00Z', title_fa: 'رویداد زودتر', kind: 'detect' },
    { at: 'not-a-time', title_fa: 'bad item' },
  ],
  charts: [
    { id: 'sample-line', title_fa: 'نمودار خطی', type: 'line', unit_fa: 'عدد', series: [{ label_fa: 'سری', points: [['2026-01-15T10:00:00Z', 1], ['2026-01-15T20:30:00Z', 3]] }] },
    { id: 'sample-bar', title_fa: 'نمودار میله‌ای', type: 'bar', unit_fa: 'ساعت', series: [{ label_fa: 'سری', points: [['دسته یک', 5], ['دسته دو', 8]] }] },
    { id: 'sample-pie', title_fa: 'نمودار دایره‌ای', type: 'pie', unit_fa: 'مورد', series: [{ label_fa: 'سری', points: [['بخش یک', 3], ['بخش دو', 1]] }] },
    { id: 'Bad Id', title_fa: 'x', type: 'line', series: [] },
  ],
  figures: [
    { label_fa: 'شاخص نمونه', value: 1234.5, unit_fa: 'واحد' },
    { label_fa: 'بدون مقدار', value: 'x' },
  ],
  ...extra,
});

// ---------------------------------------------------------------------------------------------------------------

describe('the Markdown subset', () => {
  test('blocks, title and both container blocks', () => {
    const r = parseReportMarkdown(MD);
    assert.equal(r.containerProblem, null);
    assert.equal(r.title, 'Example report title');
    assert.deepEqual(r.blocks[0].t === 'container' && r.blocks[0].kind, 'opening', 'opening is the first block');
    const last = r.blocks[r.blocks.length - 1];
    assert.equal(last.t === 'container' && last.kind, 'closing', 'closing is the last block');
    const types = r.blocks.map((b) => b.t);
    for (const t of ['h', 'p', 'quote', 'table', 'list', 'chart']) assert.ok(types.includes(t), 'has ' + t);
    assert.deepEqual(r.blocks.filter((b) => b.t === 'chart').map((b) => b.id), ['sample-line', 'sample-bar', 'sample-pie']);
  });

  test('tables, nested lists and inline spans', () => {
    const r = parseReportMarkdown(MD);
    const table = r.blocks.find((b) => b.t === 'table');
    assert.deepEqual(table.head, ['Column A', 'Column B']);
    assert.deepEqual(table.rows[0], ['value 1', '`a|b`'], 'a pipe inside code does not split a cell');
    const list = r.blocks.find((b) => b.t === 'list' && !b.list.ordered).list;
    assert.equal(list.items.length, 2);
    assert.equal(list.items[0].children[0].items[0].text, 'nested item');
    assert.ok(r.blocks.some((b) => b.t === 'list' && b.list.ordered && b.list.items.length === 2));
    assert.deepEqual(parseInline('a `c` **b `d`**'), [
      { t: 'text', v: 'a ' },
      { t: 'code', v: 'c' },
      { t: 'text', v: ' ' },
      { t: 'bold', v: [{ t: 'text', v: 'b ' }, { t: 'code', v: 'd' }] },
    ]);
    assert.deepEqual(splitRow('| a \\| b | c |'), ['a | b', 'c']);
  });

  test('raw HTML is never markup: it is a text paragraph', () => {
    const r = parseReportMarkdown(MD);
    assert.ok(r.blocks.some((b) => b.t === 'p' && b.text === '<script>alert(1)</script>'));
  });

  test('container rules: each violation is reported, its markers dropped, never shown raw', () => {
    const cases = {
      NESTED: ':::opening\n:::closing\n:::\n:::',
      UNKNOWN_KIND: ':::callout-danger\nkept text\n:::',
      UNTERMINATED: ':::opening\ntext',
      REPEATED: ':::opening\na\n:::\n:::opening\nb\n:::',
      OPENING_NOT_FIRST: 'text first\n\n:::opening\na\n:::',
      CLOSING_NOT_LAST: ':::closing\na\n:::\n\ntext after',
      CHART_INSIDE: ':::opening\n{{chart:x}}\n:::',
      MALFORMED_MARKER: '  :::opening\na\n:::',
      UNOPENED_END: 'a\n:::',
    };
    const text = (bs) => JSON.stringify(bs);
    for (const [problem, md] of Object.entries(cases)) {
      const r = parseReportMarkdown(md);
      assert.equal(r.containerProblem, problem, problem);
      assert.ok(!text(r.blocks).includes(':::'), problem + ': no marker line reaches the page');
      const containers = r.blocks.filter((b) => b.t === 'container').length;
      assert.equal(containers, problem === 'REPEATED' ? 1 : 0, problem + ': only valid blocks stay containers');
    }
    assert.ok(text(parseReportMarkdown(cases.UNKNOWN_KIND).blocks).includes('kept text'), 'an unknown kind keeps its content as ordinary text');
    assert.equal(parseReportMarkdown(':::opening\na\n:::\n\nbody\n\n:::closing\nb\n:::\n').containerProblem, null, 'control: a valid pair passes');
  });
});

describe('callouts and status colours', () => {
  test('the three callout kinds anywhere, alongside the statements', () => {
    const r = parseReportMarkdown(MD);
    assert.deepEqual(
      r.blocks.filter((b) => b.t === 'container').map((b) => b.kind),
      ['opening', 'callout-warn', 'callout-info', 'callout-ok', 'closing'],
    );
    assert.deepEqual(r.containerProblems, []);
  });

  test('a status word is coloured only where it is unmistakably a status', () => {
    const parts = parseInline('a (تأییدشده) b (باز، note) c (other) **مشکوک** **plain** d');
    const statuses = parts.filter((p) => p.t === 'status').map((p) => [p.tone, p.bold]);
    assert.deepEqual(statuses, [['ok', false], ['bad', false], ['progress', true]]);
    assert.ok(parts.some((p) => p.t === 'bold'), 'an ordinary bold span stays bold');
    // Inside an ordinary sentence, or not opening the note, nothing is guessed.
    assert.equal(parseInline('the door is باز now').filter((p) => p.t === 'status').length, 0);
    assert.equal(parseInline('(time: مشکوک)').filter((p) => p.t === 'status').length, 0);
    assert.equal(parseInline('(تأییدشده در جای دیگر)').filter((p) => p.t === 'status').length, 0);
    assert.equal(statusOf(' در حال تکمیل '), 'progress');
    assert.equal(statusOf('something else'), null);
  });
});

describe('long status notes wrap', () => {
  // A status note may be a full sentence. It must be allowed to wrap, or one long note widens the whole page on a
  // phone. The layout rule lives in the built stylesheet, so the check reads it there: no rule for .rpt-status may
  // forbid wrapping, and the tint must continue on each wrapped line.
  test('the stylesheet lets a status note wrap and keeps its tint per line', () => {
    const dir = path.join(ROOT, '.next', 'static', 'css');
    assert.ok(existsSync(dir), 'run `next build` first');
    const css = readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => readFileSync(path.join(dir, f), 'utf8')).join('');
    const rules = [...css.matchAll(/([^{}]*\.rpt-status(?![-\w])[^{}]*)\{([^{}]*)\}/g)].map((m) => m[2]);
    assert.ok(rules.length > 0, 'control: the .rpt-status rule is found');
    assert.ok(rules.every((body) => !/white-space:\s*nowrap/.test(body)), 'no .rpt-status rule forbids wrapping');
    assert.ok(rules.some((body) => /(?:^|;)\s*box-decoration-break:\s*clone/.test(body)), 'box-decoration-break: clone');
    assert.ok(rules.some((body) => /-webkit-box-decoration-break:\s*clone/.test(body)), 'the -webkit- form for Safari');
  });

  test('the long note in the fixture is a status note', () => {
    const notes = parseInline('A long note (تأییدشده، a deliberately long neutral note that runs well past the width of a phone screen and must wrap onto further lines) ends here.').filter((p) => p.t === 'status');
    assert.equal(notes.length, 1);
    assert.ok(notes[0].v.length > 100, 'longer than a phone screen holds on one line');
  });
});

describe('the data file checks', () => {
  test('a valid file: malformed items dropped and counted, timeline sorted, axis kinds', () => {
    const r = parseReportData(DATA('example-report'));
    assert.ok(r.ok);
    assert.equal(r.data.timeline.length, 2);
    assert.equal(r.data.timeline[0].title, 'رویداد زودتر', 'sorted by time');
    assert.equal(r.data.charts.length, 3);
    assert.equal(r.data.charts.find((c) => c.id === 'sample-line').xKind, 'time');
    assert.equal(r.data.charts.find((c) => c.id === 'sample-bar').xKind, 'category');
    assert.equal(r.data.figures.length, 1);
    assert.equal(r.data.dropped, 3);
  });

  test('the slug decides: missing, malformed or uppercase rejects the whole report', () => {
    for (const slug of [undefined, '', 'Bad_Slug', 'a b', '../x', 'UPPER']) assert.equal(parseReportData({ ...DATA('x'), slug }).ok, false, String(slug));
    assert.equal(parseReportData(null).ok, false);
    assert.equal(parseReportData([]).ok, false);
    assert.equal(parseReportData({ slug: 'ok-1' }).ok, true, 'control: a bare valid slug is enough');
  });
});

describe('data formatting: Tehran time, Jalali dates, Persian digits', () => {
  test('known values', () => {
    // 20:30 UTC on 15 Jan 2026 is midnight in Tehran (UTC+3:30) on Friday 26 Dey 1404.
    assert.equal(tehranTime('2026-01-15T20:30:00Z'), '۰۰:۰۰');
    assert.equal(tehranDay('2026-01-15T20:30:00Z'), '۲۶ دی');
    assert.equal(tehranDayLong('2026-01-15T20:30:00Z'), '۱۴۰۴ دی ۲۶، جمعه');
    assert.equal(faNumber(1234.5), '۱٬۲۳۴٫۵');
    assert.equal(faDigits('a1b2'), 'a۱b۲');
  });
});

// ---------------------------------------------------------------------------------------------------------------

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

async function startApp(reportsDir) {
  assert.ok(existsSync(path.join(ROOT, '.next', 'BUILD_ID')), 'run `next build` first');
  const port = await freePort();
  const logs = [];
  const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production', FLEET_PUBLIC_REPORTS_DIR: reportsDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return {
    base,
    logs,
    stop: async () => {
      child.kill();
      await new Promise((r) => child.once('exit', r));
    },
  };
}

const writeReport = (dir, name, md, data) => {
  mkdirSync(path.join(dir, name), { recursive: true });
  writeFileSync(path.join(dir, name, 'report.fa.md'), md);
  writeFileSync(path.join(dir, name, 'report.data.json'), typeof data === 'string' ? data : JSON.stringify(data));
};
const meta = (html, name) => (html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`)) ?? [])[1] ?? null;

describe('served report pages', { timeout: 180_000 }, () => {
  let dir;
  let app;
  before(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'fleet-reports-'));
    // Directory names are arbitrary: the slug inside the data file decides.
    writeReport(dir, 'r1', MD, DATA('example-report'));
    writeReport(dir, 'r2', MD, DATA('Bad_Slug'));
    writeReport(dir, 'r3', ':::opening\n:::closing\n:::\n:::\n\n# Broken containers\n\nText.', DATA('example-broken'));
    writeReport(dir, 'r4', MD, DATA('dup-report'));
    writeReport(dir, 'r5', MD, DATA('dup-report'));
    writeReport(dir, 'r6', MD, '{ not json');
    writeReport(dir, '..data', MD, DATA('hidden-report'));
    app = await startApp(dir);
  });
  after(async () => {
    await app?.stop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('a report renders, unlisted by header and meta, with every part', async () => {
    const res = await fetch(`${app.base}/reports/example-report`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
    const html = await res.text();
    assert.equal(meta(html, 'robots'), 'noindex, nofollow');
    assert.match(html, /<html lang="fa" dir="rtl"/);
    assert.match(html, /<title>Example report title \| /);
    assert.ok(html.includes('data-testid="report-opening"') && html.includes('data-testid="report-closing"'), 'both statements');
    assert.ok(html.includes('class="rpt-opening"') && html.includes('class="rpt-closing"') && html.includes('class="rpt-callout"'), 'three distinct styles');
    for (const t of ['line', 'bar', 'pie']) assert.ok(html.includes(`data-chart-type="${t}"`), 'chart ' + t);
    assert.ok(html.includes('data-testid="report-figures"') && html.includes('۱٬۲۳۴٫۵'), 'figures in Persian digits');
    assert.ok(html.includes('data-testid="report-timeline"'), 'timeline');
    assert.ok(html.includes('۰۰:۰۰') && html.includes('۱۴۰۴ دی ۲۶، جمعه'), 'timeline in Tehran time and the Jalali calendar');
    assert.ok(html.includes('dateTime="2026-01-15T20:30:00Z"'), 'the machine-readable time stays UTC');
    assert.ok(html.includes('A paragraph with item 42') && !html.includes('item ۴۲'), 'prose digits are verbatim');
    assert.ok(html.includes('<code dir="ltr" class="rpt-code">code 7</code>'), 'inline code keeps its direction and its digits');
    assert.ok(!html.includes('<script>alert(1)</script>') && html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'raw HTML is escaped text');
    // Colour: the background, a numbered heading badge, KPI accents, status pill and notes, the callout boxes.
    assert.ok(html.includes('class="rpt-page rpt-bg"'), 'the tech background');
    assert.match(html, /class="rpt-h2 rpt-h2-numbered" data-accent="1"><span class="rpt-h-num" aria-hidden="true">1<\/span>/, 'a numbered heading badge');
    assert.match(html, /class="rpt-figure" data-accent="0"/, 'KPI accents');
    assert.match(html, /<span class="rpt-pill" data-tone="ok">تأییدشده<\/span>/, 'a status cell as a pill');
    assert.match(html, /<span class="rpt-status" data-tone="bad">\(باز، note\)<\/span>/, 'a status note');
    assert.match(html, /<strong class="rpt-status-word" data-tone="bad">رفع‌نشده<\/strong>/, 'a bold status word');
    for (const k of ['warn', 'info', 'ok']) assert.ok(html.includes(`class="rpt-callout-${k}"`), 'callout ' + k);
  });

  test('404 for an unknown slug, a malformed slug, a malformed data file, a dot directory and a duplicate slug', async () => {
    for (const slug of ['nope', 'Bad_Slug', 'UPPER', 'hidden-report', 'dup-report', 'a%2F..%2Fb']) {
      const res = await fetch(`${app.base}/reports/${slug}`);
      assert.equal(res.status, 404, slug);
      assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow', slug + ': also unlisted');
    }
    assert.ok(app.logs.join('').includes('report refused: DUPLICATE_SLUG'), 'the duplicate is logged');
    assert.ok(app.logs.join('').includes('SLUG_INVALID'), 'the bad slug is logged');
  });

  test('broken container markers: the page still renders, without the statement styles', async () => {
    const res = await fetch(`${app.base}/reports/example-broken`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(!html.includes('data-testid="report-opening"') && !html.includes('data-testid="report-closing"'));
    assert.ok(!html.includes(':::'), 'no marker line reaches the page');
    assert.ok(app.logs.join('').includes('container markers ignored (NESTED, UNOPENED_END)'));
  });

  test('the rest of the site keeps its indexing; the sitemap lists no report', async () => {
    for (const route of ['/', '/en']) {
      const res = await fetch(app.base + route);
      assert.equal(res.headers.get('x-robots-tag'), null, route + ': no X-Robots-Tag');
      const html = await res.text();
      assert.equal(meta(html, 'robots'), 'index, follow', route);
    }
    const sitemap = await (await fetch(`${app.base}/sitemap.xml`)).text();
    assert.ok(sitemap.includes('<loc>https://fleet.kss.ir/</loc>'), 'control: the sitemap has its entries');
    assert.ok(!sitemap.includes('/reports'), 'no report in the sitemap');
  });

  test('new content is picked up without a restart', async () => {
    const later = new Date(Date.now() + 5_000);
    writeFileSync(path.join(dir, 'r1', 'report.fa.md'), MD.replace('# Example report title', '# Updated report title'));
    utimesSync(path.join(dir, 'r1', 'report.fa.md'), later, later);
    const html = await (await fetch(`${app.base}/reports/example-report`)).text();
    assert.match(html, /<title>Updated report title \| /);
  });
});

describe('no reports mounted', { timeout: 60_000 }, () => {
  test('a missing directory: every report is a 404, and the site stays up', async () => {
    const app = await startApp(path.join(tmpdir(), 'fleet-reports-absent-' + process.pid));
    try {
      assert.equal((await fetch(`${app.base}/api/health`)).status, 200);
      assert.equal((await fetch(`${app.base}/reports/example-report`)).status, 404);
    } finally {
      await app.stop();
    }
  });
});
