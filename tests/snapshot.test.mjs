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
import { ORDINAL_BASE, PROJECT_CANARY, makeSnapshot, startMock } from './support/mock-snapshot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { parseSnapshot, safeColor, buildChart } = await import('../components/snapshot.ts');
const { ROLE_NAMES_FA } = await import('../components/names.ts');

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
// Any of the mock's ordinals as a standalone number (7001..7092).
const ORDINAL = /(?<![0-9])70(?:0[1-9]|[1-8][0-9]|9[0-2])(?![0-9])/;
const SAMPLE = makeSnapshot('ok');
const FIRST_NAMES = new Set(SAMPLE.agents.map((a) => a.firstName));
const ROLE_LABELS = new Set([...SAMPLE.roles, ...Object.values(ROLE_NAMES_FA)]);
const stripTags = (html) => html.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'").trim();
/** Every lead-box title on a page, split into its parts. */
const leadTitles = (html) => [...html.matchAll(/<h3 data-box-title="lead">([\s\S]*?)<\/h3>/g)].map((m) => stripTags(m[1]).split(' · '));

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
    assert.equal(r.snapshot.agents.length, 92);
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
  test('colour tokens map to the palette; anything else is neutral and can never inject CSS', () => {
    assert.equal(safeColor('yellow'), 'var(--role-amber)');
    assert.equal(safeColor('purple'), 'var(--role-violet)');
    assert.equal(safeColor('CYAN'), 'var(--role-cyan)');
    assert.equal(safeColor('default'), 'var(--muted)');
    assert.equal(safeColor('red;background:url(//x)'), 'var(--muted)');
    assert.equal(safeColor('#2f5bd3'), '#2f5bd3');
  });
  test('the chart model: strip of 8, one box per team lead, every agent placed, no ordinal', () => {
    const m = buildChart(parseSnapshot(makeSnapshot('ok')).snapshot);
    assert.equal(m.strip.length, 8, 'leadership departments plus the C-level roles');
    assert.ok(m.strip.some((p) => p.role === 'CTO'), 'the CTO is in the strip');
    const lead = m.boxes.filter((b) => b.kind === 'lead');
    assert.equal(lead.length, 17, 'one box per Tech Lead');
    assert.ok(lead.every((b) => b.lead.role === 'Tech Lead'));
    assert.ok(!m.boxes.some((b) => b.kind === 'department' && b.department === 'Engineering'), 'no leftover Engineering box when every engineer has a lead');
    assert.equal(m.strip.length + m.boxes.reduce((acc, b) => acc + b.size, 0), 92, 'every agent placed exactly once');
    assert.doesNotMatch(JSON.stringify(m), ORDINAL);
    assert.ok(m.other, 'the "other" row is present');
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
      for (const a of [SAMPLE.agents[0], SAMPLE.agents[20], SAMPLE.agents[91]]) assert.ok(html.includes(a.firstName), `${route} shows ${a.firstName}`);
      assert.ok(html.includes(route === '/' ? 'پشتیبانی مشتریان' : 'Customer Support'), `${route} names departments in its language`);
      assert.ok(html.includes('class="activity-card'), `${route} shows the activity cards`);
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
    mock.state.mode = 'noreports';
    for (const route of ['/', '/en']) {
      const { status, html } = await page(route);
      assert.equal(status, 200);
      assert.equal(chartState(html), 'ok');
      assert.equal(leadTitles(html).length, 0);
      const eng = route === '/' ? 'مهندسی' : 'Engineering';
      assert.ok(
        [...html.matchAll(/<h3 data-box-title="department">([\s\S]*?)<\/h3>/g)].some((m) => stripTags(m[1]).startsWith(eng + ' · ')),
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

// Keep the base ordinal in view: the ORDINAL needle is written for 7001..7036.
assert.equal(ORDINAL_BASE, 7001);
