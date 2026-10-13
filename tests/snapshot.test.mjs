// The team chart: the snapshot parser, and the served pages against a synthetic
// snapshot service in every state (ok, service error, rate limit, wrong shape,
// empty team). Runs against the production build (`next build` first); starts
// `next start` and the mock on free local ports and stops both. Nothing is left
// running.
//
// Run: node --test tests/snapshot.test.mjs
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORDINAL_BASE, PROJECT_CANARY, TEAM_TITLES, makeSnapshot, startMock } from './support/mock-snapshot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { parseSnapshot, buildChart } = await import('../components/snapshot.ts');
const { ROLE_NAMES_FA, DEPARTMENT_NAMES_FA } = await import('../components/names.ts');

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
// Any of the mock's ordinals as a standalone number (870001..870103).
const ORDINAL = /(?<![0-9])870(?:0(?:0[1-9]|[1-9][0-9])|10[0-3])(?![0-9])/;
const SAMPLE = makeSnapshot('ok');
const FIRST_NAMES = new Set(SAMPLE.agents.map((a) => a.firstName));
const ROLE_LABELS = new Set([...SAMPLE.roles, ...Object.values(ROLE_NAMES_FA)]);
const stripTags = (html) => html.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'").trim();
/** Every lead-box title on a page, split into its parts. */
const leadTitles = (html) => [...html.matchAll(/<h3[^>]*data-box-title="lead"[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => stripTags(m[1]).split(' · '));

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

async function startApp(env) {
  assert.ok(existsSync(path.join(ROOT, '.next', 'BUILD_ID')), 'run `next build` first');
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

describe('served pages against the snapshot service, every state', () => {
  let mock;
  let app;
  before(async () => {
    mock = await startMock();
    // No caching and no stale fallback, so each request shows the mock's current mode.
    app = await startApp({
      FLEET_PUBLIC_API_URL: `http://127.0.0.1:${mock.port}`,
      FLEET_PUBLIC_CACHE_SECONDS: '0',
      FLEET_PUBLIC_STALE_SECONDS: '0',
    });
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
      assert.ok(html.includes(route === '/' ? 'پشتیبانی مشتریان' : 'Customer Support'), `${route} names departments in its language`);
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
      assert.match(html, /data-testid="chart-updated"><time dateTime="\d{4}-\d{2}-\d{2}T/, route + ': the update time is shown');
      assert.ok(html.includes(fa ? 'به وقت تهران' : 'UTC'), route + ': the update time names its zone');
      assert.doesNotMatch(html, /style="--/, route + ': no inline colour variable');
      assert.ok(!html.includes('role-'), route + ': no role colour class or variable');
      if (fa) {
        for (const [en, faName] of [['CNO', ROLE_NAMES_FA.CNO], ['Network Expert', ROLE_NAMES_FA['Network Expert']], ['Network', DEPARTMENT_NAMES_FA.Network]]) {
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
      const side = html.slice(html.indexOf('data-testid="sidebar"'), html.indexOf('</aside>'));
      const links = [...side.matchAll(/href="#([a-z]+)"/g)].map((m) => m[1]);
      assert.deepEqual(links, ['overview', 'leadership', 'engineering', 'network', 'departments', 'activity'], route + ': the menu lists the sections');
      for (const id of links) assert.match(html, new RegExp('id="' + id + '"'), route + ': #' + id + ' exists');
      assert.ok(html.includes('data-testid="section-menu"'), route + ': the phone section menu is there');
      assert.ok(html.includes('data-testid="theme-toggle"'), route + ': the theme switch is there');
      assert.ok(html.includes("localStorage.getItem('fleet-theme')"), route + ': a stored theme is applied before paint');
      assert.equal((html.match(/data-testid="stat"/g) ?? []).length, 3, route + ': three stat tiles without the active-now figure');
      assert.ok(!html.includes('data-testid="last-active"'), route + ': no last-active text when the service sends none');
      assert.ok(!html.includes('data-testid="team-activity"'), route + ': no team graph when the service sends none');
    }
  });

  test('full fields on the page: public titles in the page language, last active, team graphs, the active-now tile', async () => {
    mock.state.mode = 'full';
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
      assert.equal((html.match(/data-testid="last-active"/g) ?? []).length, 103, route + ': every person shows when she was last active');
      assert.ok((html.match(/data-testid="team-activity"/g) ?? []).length >= 17, route + ': team graphs');
      assert.equal((html.match(/data-testid="stat"/g) ?? []).length, 4, route + ': the active-now tile');
      assert.ok(!html.includes(PROJECT_CANARY), route + ': no internal project name');
      assert.ok(html.includes(lang === 'fa' ? 'کمتر از ۳' : 'fewer than 3'), route + ': a suppressed day reads as fewer than 3, never as none');
      assert.ok(html.includes(lang === 'fa' ? 'دست‌کم ' : 'at least '), route + ': a total over suppressed days is a lower bound');
    }
    mock.state.mode = 'ok';
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
    mock.state.mode = 'noreports';
    for (const route of ['/', '/en']) {
      const { status, html } = await page(route);
      assert.equal(status, 200);
      assert.equal(chartState(html), 'ok');
      assert.equal(leadTitles(html).length, 0);
      const eng = route === '/' ? 'مهندسی' : 'Engineering';
      assert.ok(
        [...html.matchAll(/<h3[^>]*data-box-title="department"[^>]*>([\s\S]*?)<\/h3>/g)].some((m) => stripTags(m[1]).startsWith(eng + ' · ')),
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
    test(`${mode}: a graceful notice, never an error page or code; the reason is logged on the server`, async () => {
      mock.state.mode = mode;
      for (const route of ['/', '/en']) {
        const { status, html } = await page(route);
        assert.equal(status, 200);
        assert.equal(chartState(html), 'unavailable');
        assert.ok(!html.includes(hidden), `${route} does not show the service's code`);
        assert.ok(!html.includes('SNAPSHOT_'), `${route} does not show our code`);
        assert.ok(!html.includes('class="person'), `${route} renders no partial chart`);
      }
      assert.ok(await logged(app.logs, logNeedle), `server log carries: ${logNeedle}`);
    });
  }

  test('empty team: its own calm notice, nothing logged as a failure', async () => {
    mock.state.mode = 'empty';
    const before = app.logs.join('').split('snapshot unavailable').length;
    for (const route of ['/', '/en']) {
      const { status, html } = await page(route);
      assert.equal(status, 200);
      assert.equal(chartState(html), 'empty');
    }
    assert.equal(app.logs.join('').split('snapshot unavailable').length, before, 'an empty team is not a failure');
  });
});

describe('a failure after a good snapshot keeps showing the last good chart', () => {
  let mock;
  let app;
  before(async () => {
    mock = await startMock();
    app = await startApp({ FLEET_PUBLIC_API_URL: `http://127.0.0.1:${mock.port}`, FLEET_PUBLIC_CACHE_SECONDS: '0' });
  });
  after(async () => {
    await app?.stop();
    mock?.server.close();
  });

  test('ok, then the service fails: the chart stays, the failure is logged', async () => {
    mock.state.mode = 'ok';
    assert.equal(chartState(await (await fetch(`${app.base}/`)).text()), 'ok');
    mock.state.mode = 'error';
    assert.equal(chartState(await (await fetch(`${app.base}/`)).text()), 'ok');
    assert.ok(await logged(app.logs, 'SNAPSHOT_HTTP_ERROR (status 500)'));
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

  test('the page still renders in full, with the graceful notice', async () => {
    const res = await fetch(`${app.base}/`);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.equal(chartState(html), 'unavailable');
    assert.ok(await logged(app.logs, 'SNAPSHOT_NOT_CONFIGURED'));
  });
});

// Keep the base ordinal in view: the ORDINAL needle is written for 870001..870103.
assert.equal(ORDINAL_BASE, 870001);
