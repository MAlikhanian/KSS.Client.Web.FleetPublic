// The team chart: the snapshot parser, and the served pages against a synthetic
// snapshot service in every state (ok, service error, rate limit, wrong shape,
// empty team). Runs against the production build (`next build` first); starts
// `next start` and the mock on free local ports and stops both. Nothing is left
// running.
//
// The pages are cached (ISR, 30 s), so a change of the mock's state shows only after
// a regeneration: the tests wait for it. Each app starts from the BUILD's pages (the
// notice), restored and marked stale, and the build's pages are put back at the end.
//
// Run: node --test tests/snapshot.test.mjs
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ORDINAL_BASE, PROJECT_CANARY, TEAM_TITLES, makeSnapshot, startMock } from './support/mock-snapshot.mjs';

// public-titles imports its siblings without an extension; resolve those to .ts for Node.
register('./support/resolve-ts.mjs', import.meta.url);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { parseSnapshot, buildChart } = await import('../components/snapshot.ts');
const { roleTitle, departmentTitle } = await import('../components/public-titles.ts');
const { STORY_CLAIMS } = await import('../components/copy.ts');

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
// Any of the mock's ordinals as a standalone number (870001..870103).
const ORDINAL = /(?<![0-9])870(?:0(?:0[1-9]|[1-9][0-9])|10[0-3])(?![0-9])/;
const SAMPLE = makeSnapshot('ok');
const FIRST_NAMES = new Set(SAMPLE.agents.map((a) => a.firstName));
// The plain public titles a page may show, in both languages.
const ROLE_LABELS = new Set(SAMPLE.roles.flatMap((r) => [roleTitle(r, 'en'), roleTitle(r, 'fa')]));
const stripTags = (html) => html.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'").trim();
/** Every lead-box title on a page, split into its parts. */
// A Persian title puts its count in parentheses ("… (۴)"); read it the same way as "… · 4".
const leadTitles = (html) =>
  [...html.matchAll(/<h3[^>]*data-box-title="lead"[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => stripTags(m[1]).replace(/ \(([0-9۰-۹]+)\)$/, ' · $1').split(' · '));

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

// The build's cached pages, kept so each app starts from them and the build is left as it was found.
const PAGE_FILES = ['index.html', 'index.rsc', 'index.meta', 'en.html', 'en.rsc', 'en.meta'].map((f) => path.join(ROOT, '.next', 'server', 'app', f));
const BUILD_PAGES = existsSync(PAGE_FILES[0]) ? PAGE_FILES.map((f) => [f, readFileSync(f)]) : [];
function restoreBuildPages() {
  const old = new Date(Date.now() - 60 * 60_000); // an hour old: stale, so the first request regenerates
  for (const [f, bytes] of BUILD_PAGES) {
    writeFileSync(f, bytes);
    utimesSync(f, old, old);
  }
}
after(() => restoreBuildPages());

async function startApp(env) {
  assert.ok(existsSync(path.join(ROOT, '.next', 'BUILD_ID')), 'run `next build` first');
  restoreBuildPages();
  const port = await freePort();
  const logs = [];
  const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production', ...env },
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
  const stop = async () => {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
  };
  return { base, logs, stop };
}

const chartState = (html) => (html.match(/data-chart-state="([a-z]+)"/) ?? [])[1] ?? null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Requests a page until `ok(html)` holds (a regeneration takes one stale hit plus a moment). */
async function settle(base, route, ok, ms = 80_000) {
  const end = Date.now() + ms;
  let html = '';
  while (Date.now() < end) {
    html = await (await fetch(base + route)).text();
    if (ok(html)) return html;
    await sleep(1500);
  }
  throw new Error(`${route} did not settle within ${ms} ms (state ${chartState(html)})`);
}
const logged = async (logs, needle) => {
  for (let i = 0; i < 20; i++) {
    if (logs.join('').includes(needle)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
};

describe('snapshot parser', () => {
  test('the service shape parses, with the 7-day range filled in', () => {
    const r = parseSnapshot(makeSnapshot('ok'));
    assert.equal(r.ok, true);
    assert.equal(r.snapshot.agents.length, 103);
    assert.ok(!JSON.stringify(r.snapshot).includes('"color"'), 'the retired colour field is dropped');
    assert.match(r.snapshot.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'generatedAt is kept, as ISO UTC');
    assert.ok(!JSON.stringify(r.snapshot).includes(PROJECT_CANARY), 'a field the contract does not have is dropped');
    assert.equal(r.snapshot.days.length, 7);
    assert.ok(r.snapshot.activity.some((b) => b.department === null), 'the grouped "other" rows are kept as served');
  });
  test('a wrong shape is rejected whole, with a reason', () => {
    for (const [mutate, reason] of [
      [(b) => (b.activity = b.activity.buckets), 'ACTIVITY_SHAPE_INVALID'],
      [(b) => delete b.agents, 'SNAPSHOT_NO_AGENTS_ARRAY'],
      [(b) => (b.agents[3].reportsTo = 'boss'), 'AGENT_REPORTSTO_INVALID'],
      [(b) => (b.agents[4].n = b.agents[5].n), 'AGENT_ORDINAL_DUPLICATE'],
      [(b) => (b.agents[0].firstName = ''), 'AGENT_FIELD_INVALID'],
      [(b) => (b.activity.buckets[0].direction = 'up'), 'ACTIVITY_DIRECTION_INVALID'],
      [(b) => (b.activity.from = 'yesterday'), 'ACTIVITY_RANGE_INVALID'],
      [(b) => (b.generatedAt = 'soon'), 'GENERATED_AT_INVALID'],
      [(b) => (b.agents[0].project = { en: 'x', fa: '' }), 'AGENT_PROJECT_INVALID'],
      [(b) => (b.agents[0].project = 'a plain string'), 'AGENT_PROJECT_INVALID'],
      [(b) => (b.agents[0].lastActiveAt = 'recently'), 'AGENT_LAST_ACTIVE_INVALID'],
      [(b) => (b.agents[0].activity7d = [1, 2, 3]), 'AGENT_ACTIVITY_INVALID'],
      [(b) => (b.agents[0].activity7d = [1, 2, 3, 4, 5, 6, -1]), 'AGENT_ACTIVITY_INVALID'],
    ]) {
      const body = makeSnapshot('ok');
      mutate(body);
      const r = parseSnapshot(body);
      assert.equal(r.ok, false);
      assert.equal(r.reason, reason);
    }
    assert.equal(parseSnapshot(null).ok, false);
    assert.equal(parseSnapshot([]).ok, false);
  });
  test('the three optional fields: absent today (null), parsed when the service sends them', () => {
    const today = parseSnapshot(makeSnapshot('ok')).snapshot;
    assert.ok(today.agents.every((a) => a.project === null && a.lastActiveAt === null && a.activity7d === null), 'absent means null');
    const full = parseSnapshot(makeSnapshot('full')).snapshot;
    assert.equal(full.agents.length, 103);
    assert.ok(full.agents.every((a) => typeof a.lastActiveAt === 'string' && a.activity7d.length === 7), 'every agent carries a time and 7 counts');
    const titled = full.agents.filter((a) => a.project !== null);
    assert.ok(titled.length > 0 && titled.every((a) => a.project.en && a.project.fa), 'a title carries both languages');
    assert.ok(!JSON.stringify(full).includes(PROJECT_CANARY), 'an internal project name is never kept');
  });
  test('activity7d: a suppressed day is null, a true zero is 0; both parse, and a team day sums what is known', async () => {
    const { sumActivity } = await import('../components/snapshot.ts');
    const body = makeSnapshot('ok');
    body.agents[0].activity7d = [null, 0, 5, null, 3, 0, 9];
    body.agents[1].activity7d = [4, 0, null, null, 3, 1, 0];
    const r = parseSnapshot(body);
    assert.equal(r.ok, true);
    assert.deepEqual(r.snapshot.agents[0].activity7d, [null, 0, 5, null, 3, 0, 9]);
    const days = sumActivity([r.snapshot.agents[0], r.snapshot.agents[1]]);
    assert.deepEqual(days[0], { total: 4, partial: true }, 'one member suppressed: a lower bound');
    assert.deepEqual(days[1], { total: 0, partial: false }, 'a true zero stays zero');
    assert.deepEqual(days[3], { total: null, partial: true }, 'everyone suppressed: fewer than 3');
    // An older service sent suppressed days as 0: still valid.
    const old = makeSnapshot('ok');
    old.agents[0].activity7d = [0, 0, 5, 0, 3, 0, 9];
    assert.equal(parseSnapshot(old).ok, true);
  });
  test('generatedAt: optional; missing means null, a valid time is kept as ISO UTC', () => {
    const body = makeSnapshot('ok');
    delete body.generatedAt;
    assert.equal(parseSnapshot(body).snapshot.generatedAt, null);
    body.generatedAt = '2026-10-12T23:10:05.123Z';
    assert.equal(parseSnapshot(body).snapshot.generatedAt, '2026-10-12T23:10:05.123Z');
  });
  test('the chart model: strip of 6 (CEO, COO, CTO, CNO, Executive Office), boxes per team lead, every agent placed, no ordinal, no colour', () => {
    const m = buildChart(parseSnapshot(makeSnapshot('ok')).snapshot);
    assert.equal(m.strip.length, 6, 'the C-level roles plus the Executive Office');
    for (const role of ['CEO', 'COO', 'CTO', 'CNO']) assert.ok(m.strip.some((p) => p.role === role), 'the ' + role + ' is in the strip');
    assert.ok(!m.boxes.some((b) => b.people.some((p) => p.role === 'CNO')), 'the CNO is not inside the Network box');
    assert.ok(m.boxes.some((b) => b.kind === 'department' && b.department === 'Network' && b.size === 10), 'the Network box holds the 10 experts');
    assert.ok(!JSON.stringify(m).includes('color'), 'no colour in the view model');
    const people = [...m.strip, ...m.boxes.flatMap((b) => b.people)];
    assert.equal(people.filter((p) => p.reportsTo === null).length, 1, 'only the CEO reports to nobody');
    assert.ok(people.every((p) => p.reportsTo === null || FIRST_NAMES.has(p.reportsTo)), 'reports-to is a first name');
    assert.ok(people.every((p) => p.department.length > 0), 'every person carries a department');
    const lead = m.boxes.filter((b) => b.kind === 'lead');
    assert.equal(lead.length, 17, 'one box per Tech Lead');
    assert.ok(lead.every((b) => b.lead.role === 'Tech Lead'));
    assert.ok(!m.boxes.some((b) => b.kind === 'department' && b.department === 'Engineering'), 'no leftover Engineering box when every engineer has a lead');
    assert.equal(m.strip.length + m.boxes.reduce((acc, b) => acc + b.size, 0), 103, 'every agent placed exactly once');
    assert.doesNotMatch(JSON.stringify(m), ORDINAL);
    assert.ok(m.other, 'the "other" row is present');
  });
  test('full fields in the model: titled teams, untitled ones keep the lead title, team activity sums, active-now count', () => {
    const m = buildChart(parseSnapshot(makeSnapshot('full')).snapshot);
    const lead = m.boxes.filter((b) => b.kind === 'lead');
    assert.equal(lead.length, 17);
    const published = TEAM_TITLES.filter(Boolean).length;
    assert.equal(lead.filter((b) => b.project !== null).length, published, 'one title per published team');
    assert.equal(lead.filter((b) => b.project === null).length, 17 - published, 'unpublished teams carry no title');
    assert.ok(m.boxes.every((b) => Array.isArray(b.activity7d) && b.activity7d.length === 7), 'every card sums its members');
    assert.equal(typeof m.activeNow, 'number');
    assert.ok(m.activeNow > 0 && m.activeNow < 103);
    const today = buildChart(parseSnapshot(makeSnapshot('ok')).snapshot);
    assert.equal(today.activeNow, null, 'no times served: no active-now figure');
    assert.ok(today.boxes.every((b) => b.activity7d === null), 'no counts served: no team activity');
  });
  test('safe fallback: with no reporting lines for engineers, they share ONE Engineering box', () => {
    const m = buildChart(parseSnapshot(makeSnapshot('noreports')).snapshot);
    assert.equal(m.boxes.filter((b) => b.kind === 'lead').length, 0);
    const eng = m.boxes.filter((b) => b.kind === 'department' && b.department === 'Engineering');
    assert.equal(eng.length, 1);
    assert.equal(eng[0].size, 68, 'every engineer except the CTO, who stays in the strip by role');
  });
});

describe('served pages against the snapshot service, every state', { timeout: 600_000 }, () => {
  let mock;
  let app;
  let firstState = {};
  before(async () => {
    mock = await startMock();
    // No memo and no stale fallback in the data path, so each REGENERATION sees the mock's current mode.
    app = await startApp({
      FLEET_PUBLIC_API_URL: `http://127.0.0.1:${mock.port}`,
      FLEET_PUBLIC_CACHE_SECONDS: '0',
      FLEET_PUBLIC_STALE_SECONDS: '0',
    });
    for (const route of ['/', '/en']) {
      firstState[route] = chartState(await (await fetch(app.base + route)).text());
      await settle(app.base, route, (h) => chartState(h) === 'ok');
    }
  });
  /** Switches the mock and waits until both pages show it (at most one cache period plus a regeneration). */
  const switchTo = async (mode, ok) => {
    mock.state.mode = mode;
    for (const route of ['/', '/en']) await settle(app.base, route, ok);
  };

  test('ISR: the first request gets the build page (the notice), and the first good regeneration replaces it', () => {
    assert.deepEqual(firstState, { '/': 'unavailable', '/en': 'unavailable' });
  });

  test('the page is served from the cache, not rendered per request', async () => {
    const res = await fetch(app.base + '/');
    assert.match(res.headers.get('x-nextjs-cache') ?? '', /^(HIT|STALE)$/);
    assert.doesNotMatch(res.headers.get('cache-control') ?? '', /no-store/);
  });
  after(async () => {
    await app?.stop();
    mock?.server.close();
  });

  const page = async (route) => {
    const res = await fetch(`${app.base}${route}`);
    return { status: res.status, html: await res.text() };
  };

  test('ok: both pages render the real chart and the activity figures', async () => {
    mock.state.mode = 'ok';
    for (const route of ['/', '/en']) {
      const { status, html } = await page(route);
      assert.equal(status, 200);
      assert.equal(chartState(html), 'ok');
      for (const a of [SAMPLE.agents[0], SAMPLE.agents[20], SAMPLE.agents[102]]) assert.ok(html.includes(a.firstName), `${route} shows ${a.firstName}`);
      assert.ok(html.includes(route === '/' ? 'پشتیبانی مشتریان' : 'Customer support'), `${route} names departments in its language`);
      assert.ok(html.includes('class="activity-card'), `${route} shows the activity cards`);
    }
  });

  test('rows: role and department, a reports-to line, the update time; no per-person colour; fa translates every name', async () => {
    mock.state.mode = 'ok';
    for (const route of ['/', '/en']) {
      const { html } = await page(route);
      const fa = route === '/';
      const rows = [...html.matchAll(/class="line-role[^"]*">([\s\S]*?)<\/span>/g)].map((m) => stripTags(m[1]));
      assert.equal(rows.length, 103, route + ': every person has a role line');
      assert.ok(rows.every((r) => r.includes(' · ')), route + ': each role line carries the department');
      assert.equal((html.match(/class="line-reports[ "]/g) ?? []).length, 102, route + ': everyone but the CEO has a reports-to line');
      assert.ok(html.includes(fa ? 'گزارش به ' : 'Reports to '), route + ': reports-to wording');
      assert.match(html, /data-testid="chart-updated">(?:<span[^>]*><\/span>)?<time dateTime="\d{4}-\d{2}-\d{2}T/, route + ': the update time is shown');
      assert.ok(html.includes(fa ? 'به وقت تهران' : 'UTC'), route + ': the update time names its zone');
      assert.doesNotMatch(html, /style="--/, route + ': no inline colour variable');
      assert.ok(!html.includes('role-'), route + ': no role colour class or variable');
      if (fa) {
        for (const [en, faName] of [['CNO', roleTitle('CNO', 'fa')], ['Network Expert', roleTitle('Network Expert', 'fa')], ['Network', departmentTitle('Network', 'fa')]]) {
          assert.ok(faName, 'a Persian name exists for ' + en);
          assert.ok(html.includes(faName), 'fa shows ' + faName);
        }
        assert.deepEqual(rows.filter((r) => /[A-Za-z]/.test(r)), [], 'fa: no role or department left in English');
      }
    }
  });

  test('dashboard chrome: a section menu whose every link lands on a section, a theme switch, the theme set before paint', async () => {
    mock.state.mode = 'ok';
    for (const route of ['/', '/en']) {
      const { html } = await page(route);
      const menu = html.slice(html.indexOf('data-testid="section-menu"'), html.indexOf('</nav>'));
      const links = [...menu.matchAll(/href="#([a-z]+)"/g)].map((m) => m[1]);
      assert.deepEqual(links, ['what', 'how', 'team'], route + ': the top bar lists the three story sections');
      for (const id of links) assert.match(html, new RegExp('id="' + id + '"'), route + ': #' + id + ' exists');
      assert.ok(!html.includes('data-testid="sidebar"'), route + ': no sidebar any more');
      assert.ok(html.includes('data-testid="theme-toggle"'), route + ': the theme switch is there');
      assert.ok(html.includes("localStorage.getItem('fleet-theme')"), route + ': a stored theme is applied before paint');
      assert.equal((html.match(/data-testid="stat"/g) ?? []).length, 3, route + ': three stat tiles without the active-now figure');
      assert.ok(!html.includes('data-testid="last-active"'), route + ': no last-active text when the service sends none');
      assert.ok(!html.includes('data-testid="team-activity"'), route + ': no team graph when the service sends none');
    }
  });

  test('full fields on the page: public titles in the page language, last active, team graphs, the active-now tile', async () => {
    await switchTo('full', (h) => h.includes('data-testid="team-lead"'));
    for (const route of ['/', '/en']) {
      const { html } = await page(route);
      const lang = route === '/' ? 'fa' : 'en';
      for (const t of TEAM_TITLES.filter(Boolean)) assert.ok(html.includes(t[lang].replace(/&/g, '&amp;')), route + ': shows "' + t[lang] + '"');
      const titles = leadTitles(html);
      assert.equal(titles.length, 17);
      const published = TEAM_TITLES.filter(Boolean).length;
      assert.equal(titles.filter((p) => p.length === 2).length, published, route + ': a titled team is "title · count"');
      assert.equal(titles.filter((p) => p.length === 3).length, 17 - published, route + ': an untitled team keeps "lead · role · count"');
      assert.equal((html.match(/data-testid="team-lead"/g) ?? []).length, published, route + ': a titled card still names its lead');
      assert.equal((html.match(/data-testid="last-active"/g) ?? []).length, 103, route + ': every person shows the time of her last activity');
      const lines = [...html.matchAll(/data-testid="last-active">([^<]*)</g)].map((m) => m[1]);
      assert.equal(lines.length, 103, route + ': each last-activity entry is one plain line, no badge inside');
      // Minutes only within the hour; then a band. The mock spreads times over 2 min, 70 min, 25 h and 73 h.
      const bands = lang === 'fa' ? ['آخرین فعالیت: ', 'فعالیت امروز', 'این هفته', 'آماده به کار'] : ['Last activity: ', 'Active today', 'This week', 'Standby'];
      assert.ok(lines.every((t) => bands.some((b) => t.startsWith(b))), route + ': every line is "last activity" or a quiet band');
      assert.ok(lines.some((t) => t.startsWith(bands[0])), route + ': minutes within the last hour');
      assert.ok(lines.some((t) => t === bands[2]), route + ': "this week" for a quiet agent');
      assert.ok(!lines.some((t) => /[0-9۰-۹]+ (hours?|days?|ساعت|روز)/.test(t)), route + ': no hours or days spelled out past the first hour');
      assert.ok(html.includes(lang === 'fa' ? 'آخرین فعالیت در ۱۵ دقیقهٔ گذشته' : 'Last activity in the past 15 minutes'), route + ': the tile title says last activity');
      assert.doesNotMatch(html, lang === 'fa' ? />فعال</ : />(Active|Online|online)</, route + ': no online or active pill');
      assert.ok((html.match(/data-testid="team-activity"/g) ?? []).length >= 17, route + ': team graphs');
      assert.equal((html.match(/data-testid="stat"/g) ?? []).length, 4, route + ': the active-now tile');
      assert.ok(!html.includes(PROJECT_CANARY), route + ': no internal project name');
      assert.ok(html.includes(lang === 'fa' ? 'کمتر از ۳' : 'fewer than 3'), route + ': a suppressed day reads as fewer than 3, never as none');
      assert.ok(html.includes(lang === 'fa' ? 'دست‌کم ' : 'at least '), route + ': a total over suppressed days is a lower bound');
    }
    await switchTo('ok', (h) => chartState(h) === 'ok' && !h.includes('data-testid="team-lead"'));
  });

  test('the story: a headline with the LIVE count, the approved claims, four cards with live numbers, five steps', async () => {
    mock.state.mode = 'ok';
    for (const route of ['/', '/en']) {
      const { html } = await page(route);
      const lang = route === '/' ? 'fa' : 'en';
      const h1 = stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1] ?? '');
      assert.ok(h1.includes(lang === 'fa' ? '۱۰۳' : '103'), route + ': the headline carries the live count');
      assert.ok(html.includes(STORY_CLAIMS[lang].changes), route + ': the approved changes clause');
      if (lang === 'en') assert.ok(html.includes('Fast, honest answers in Persian or English, by text or voice. Changes to your systems follow a written plan or an approved standing procedure, and deleting data always needs a person’s approval.'), '/en: the approved hero sentence, verbatim');
      for (const k of ['support', 'engineering', 'network', 'leadership']) assert.ok(html.includes(`data-testid="what-${k}"`), route + ': card ' + k);
      assert.ok(html.includes(STORY_CLAIMS[lang].network.replace(/&/g, '&amp;')), route + ': the approved network sentence');
      assert.ok(html.includes(STORY_CLAIMS[lang].support), route + ': the approved support sentence');
      if (lang === 'en') assert.ok(html.includes('Customers are served in their own support rooms. Agents answer in the customer’s language.'), '/en: the support card, verbatim');
      assert.ok(!/track every request|پیگیری می‌کنند/.test(html), route + ': no tracking claim');
      const numbers = (html.match(/data-testid="what-number"/g) ?? []).length;
      // Today's shape: support messages and teams have data; one generic network role and no times have none.
      assert.equal(numbers, 2, route + ': only the numbers this snapshot can back');
      assert.equal((html.match(/<li[^>]*class="grid content-start/g) ?? []).length, 5, route + ': five steps');
      assert.ok(!html.includes('data-testid="contact"'), route + ': no contact line without the deployment\'s values');
      assert.match(html, /href="https:\/\/kss\.ir"[^>]*>[^<]*(Contact us|تماس با ما)/, route + ': "Contact us" falls back to kss.ir');
    }
  });

  test('box titles: a lead box is first name · role · count and NOTHING else; no project ever reaches a page', async () => {
    assert.ok(JSON.stringify(makeSnapshot('ok')).includes(PROJECT_CANARY), 'control: the service response carries the canary');
    mock.state.mode = 'ok';
    for (const route of ['/', '/en']) {
      const { html } = await page(route);
      const titles = leadTitles(html);
      assert.equal(titles.length, 17, `${route}: 17 lead boxes`);
      for (const parts of titles) {
        assert.equal(parts.length, 3, `${route}: exactly three parts in "${parts.join(' · ')}"`);
        assert.ok(FIRST_NAMES.has(parts[0]), `${route}: "${parts[0]}" is an agent's first name`);
        assert.ok(ROLE_LABELS.has(parts[1]), `${route}: "${parts[1]}" is a role`);
        assert.match(parts[2], /^[0-9۰-۹]+$/, `${route}: "${parts[2]}" is a count`);
      }
      assert.ok(!html.includes(PROJECT_CANARY), `${route}: no project name`);
    }
  });

  test('safe fallback on the page: no reporting lines for engineers means one Engineering box and no lead box', async () => {
    await switchTo('noreports', (h) => chartState(h) === 'ok' && leadTitles(h).length === 0);
    for (const route of ['/', '/en']) {
      const { status, html } = await page(route);
      assert.equal(status, 200);
      assert.equal(chartState(html), 'ok');
      assert.equal(leadTitles(html).length, 0);
      const eng = departmentTitle('Engineering', route === '/' ? 'fa' : 'en');
      assert.ok(
        [...html.matchAll(/<h3[^>]*data-box-title="department"[^>]*>([\s\S]*?)<\/h3>/g)].some((m) => stripTags(m[1]).startsWith(eng + (route === '/' ? ' (' : ' · '))),
        `${route}: one "${eng}" box`,
      );
    }
  });

  test('the server calls the service anonymously, at the snapshot path', () => {
    const calls = mock.state.requests.filter((r) => r.url === '/api/public/snapshot');
    assert.ok(calls.length > 0, 'the service was called');
    for (const c of calls) {
      assert.equal(c.method, 'GET');
      assert.equal(c.headers.authorization, undefined);
      assert.equal(c.headers.cookie, undefined);
      assert.ok(!Object.keys(c.headers).some((h) => h.startsWith('x-fleet')), 'no X-Fleet-* header');
    }
  });

  test('markers: no id-shaped value and no ordinal in the served HTML or its JavaScript', async () => {
    // Controls first: both needles must be able to fire.
    assert.match('aa3f06c2-19b7-4c55-8e0e-4f1b2c3d4e5f', UUID);
    assert.match(JSON.stringify(makeSnapshot('ok')), ORDINAL, 'the service response itself carries the ordinals');

    mock.state.mode = 'ok';
    const served = [];
    for (const route of ['/', '/en']) {
      const { html } = await page(route);
      served.push([route, html]);
      for (const src of new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))) {
        served.push([src, await (await fetch(`${app.base}${src}`)).text()]);
      }
    }
    assert.ok(served.length > 2, 'scanned the pages and at least one script');
    for (const [where, body] of served) {
      assert.doesNotMatch(body, UUID, `no uuid in ${where}`);
      assert.doesNotMatch(body, ORDINAL, `no ordinal in ${where}`);
      assert.ok(!body.includes('/api/public/snapshot'), `the service path never reaches the browser (${where})`);
      assert.ok(!body.includes('kss-fleet-public-service'), `the service host never reaches the browser (${where})`);
      assert.ok(!body.includes(`127.0.0.1:${mock.port}`), `the service URL never reaches the browser (${where})`);
    }
  });

  for (const [mode, logNeedle, hidden] of [
    ['error', 'SNAPSHOT_HTTP_ERROR (status 500)', 'FLEET_INTERNAL_ERROR'],
    ['limited', 'SNAPSHOT_HTTP_ERROR (status 429)', 'FLEET_RATE_LIMITED'],
    ['invalid', 'SNAPSHOT_INVALID (ACTIVITY_SHAPE_INVALID)', 'ACTIVITY_SHAPE_INVALID'],
  ]) {
    test(`${mode}: a failed regeneration is never cached; the last good page stays, the reason is logged`, async () => {
      await switchTo('ok', (h) => chartState(h) === 'ok');
      mock.state.mode = mode;
      await sleep(31_000); // past the cache period, so the next request regenerates (and fails)
      for (const route of ['/', '/en']) {
        await page(route); // the stale hit that starts the regeneration
        await sleep(2000);
        const { status, html } = await page(route);
        assert.equal(status, 200);
        assert.equal(chartState(html), 'ok', `${route}: the last good page is still served`);
        assert.ok(!html.includes(hidden), `${route} does not show the service's code`);
        assert.ok(!html.includes('SNAPSHOT_'), `${route} does not show our code`);
      }
      assert.ok(await logged(app.logs, logNeedle), `server log carries: ${logNeedle}`);
      assert.ok(await logged(app.logs, 'SNAPSHOT_UNAVAILABLE'), 'the regeneration was refused, not cached');
    });
  }

  test('empty team: its own calm notice, nothing logged as a failure', async () => {
    await switchTo('ok', (h) => chartState(h) === 'ok');
    const before = app.logs.join('').split('snapshot unavailable').length;
    await switchTo('empty', (h) => chartState(h) === 'empty');
    for (const route of ['/', '/en']) {
      const { status, html } = await page(route);
      assert.equal(status, 200);
      assert.equal(chartState(html), 'empty');
    }
    assert.equal(app.logs.join('').split('snapshot unavailable').length, before, 'an empty team is not a failure');
  });
});

describe('the one-day stale copy under ISR, and the update time', { timeout: 300_000 }, () => {
  let mock;
  let app;
  const G = '2026-10-01T08:30:00.000Z'; // a fixed snapshot time, far from any render time
  before(async () => {
    mock = await startMock();
    mock.state.generatedAt = G;
    // The DEFAULT stale window (one day): a failed fetch falls back to the in-process copy.
    app = await startApp({ FLEET_PUBLIC_API_URL: `http://127.0.0.1:${mock.port}`, FLEET_PUBLIC_CACHE_SECONDS: '0' });
    await settle(app.base, '/en', (h) => chartState(h) === 'ok');
  });
  after(async () => {
    await app?.stop();
    mock?.server.close();
  });
  const shownTime = (html) => (html.match(/data-testid="chart-updated">(?:<span[^>]*><\/span>)?<time dateTime="([^"]+)"/) ?? [])[1];

  test('the "updated" line carries the SNAPSHOT\'s time, not the render time', async () => {
    assert.equal(shownTime(await (await fetch(app.base + '/en')).text()), G);
  });

  test('the service fails: the regeneration renders from the one-day copy, the chart and its time stay', async () => {
    mock.state.mode = 'error';
    await sleep(31_000);
    await fetch(app.base + '/en'); // stale hit: regenerates from the in-process copy
    await sleep(2500);
    const html = await (await fetch(app.base + '/en')).text();
    assert.equal(chartState(html), 'ok');
    assert.equal(shownTime(html), G, 'still the snapshot\'s own time');
    assert.ok(await logged(app.logs, 'SNAPSHOT_HTTP_ERROR (status 500)'), 'the failed fetch was logged');
    assert.ok(!app.logs.join('').includes('SNAPSHOT_UNAVAILABLE'), 'nothing refused: the copy was good');
  });
});

// Invented values only: the real ones live in the deployment's ConfigMap, never in the source.
const FAKE_CONTACT = { FLEET_PUBLIC_CONTACT_EMAIL: 'desk@example.test', FLEET_PUBLIC_CONTACT_PHONE: '000 000 0000', FLEET_PUBLIC_CONTACT_TEL: '+10000000000' };

describe('contact details, read from the deployment at render time', () => {
  let read;
  const withEnv = (env, fn) => {
    const keys = Object.keys(FAKE_CONTACT);
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, env);
    try {
      return fn();
    } finally {
      for (const k of keys) if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };
  before(async () => {
    read = (await import('../components/contact.ts')).readContact;
  });

  test('unset: nothing; set: all three; a malformed value or a phone without its tel: form is dropped', () => {
    assert.deepEqual(withEnv({}, read), { email: null, phone: null, tel: null });
    assert.deepEqual(withEnv(FAKE_CONTACT, read), { email: 'desk@example.test', phone: '000 000 0000', tel: '+10000000000' });
    assert.equal(withEnv({ FLEET_PUBLIC_CONTACT_EMAIL: '"><script>@x.io' }, read).email, null);
    assert.deepEqual(withEnv({ FLEET_PUBLIC_CONTACT_PHONE: '000 000 0000' }, read), { email: null, phone: null, tel: null });
  });

  test('the served page carries them as mailto: and tel: links when the deployment sets them', async () => {
    const m = await startMock();
    const app = await startApp({ FLEET_PUBLIC_API_URL: `http://127.0.0.1:${m.port}`, ...FAKE_CONTACT });
    try {
      for (const route of ['/', '/en']) {
        const html = await settle(app.base, route, (h) => chartState(h) === 'ok');
        const line = (html.match(/data-testid="contact">([\s\S]*?)<\/p>/) ?? [])[1] ?? '';
        assert.ok(line.includes('href="mailto:desk@example.test"'), route + ': the email link');
        assert.ok(line.includes('href="tel:+10000000000"') && line.includes('000 000 0000'), route + ': the phone, with its tel: link');
        assert.match(html, /href="mailto:desk@example\.test"[^>]*>[^<]*(Contact us|تماس با ما)/, route + ': "Contact us" writes to the address');
      }
    } finally {
      await app.stop();
      m.server.close();
    }
  });
});

describe('not configured (a build or a local run with no service URL)', () => {
  let app;
  before(async () => {
    app = await startApp({ FLEET_PUBLIC_API_URL: '' });
  });
  after(async () => {
    await app?.stop();
  });

  test('the build page (the notice) is served, every regeneration is refused, the next request tries again', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${app.base}/`);
      const html = await res.text();
      assert.equal(res.status, 200);
      assert.equal(chartState(html), 'unavailable');
      await sleep(1500);
    }
    assert.ok(await logged(app.logs, 'SNAPSHOT_NOT_CONFIGURED'));
    assert.ok(await logged(app.logs, 'SNAPSHOT_UNAVAILABLE'), 'the regeneration threw: the notice was not cached as a good page');
    assert.equal(readFileSync(PAGE_FILES[0], 'utf8'), BUILD_PAGES[0][1].toString('utf8'), 'the cached page on disk is still the build page');
  });
});

// Keep the base ordinal in view: the ORDINAL needle is written for 870001..870103.
assert.equal(ORDINAL_BASE, 870001);
