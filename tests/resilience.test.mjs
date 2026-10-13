// The snapshot fetch under failure: one retry, the long stale window, and when the graceful notice appears.
// Runs the server module directly against a local scripted service (no build, no browser). Each case loads a
// fresh copy of the module, so no case sees another's cached snapshot.
//
// Run: node --test tests/resilience.test.mjs
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { register } from 'node:module';
import { makeSnapshot } from './support/mock-snapshot.mjs';

// The server module imports its siblings without an extension; resolve those to .ts for Node.
register('./support/resolve-ts.mjs', import.meta.url);

let fresh = 0;
const load = async () => import(`../components/snapshot-server.ts?case=${++fresh}`);

/** A local service that answers from a script: each entry is 'ok', a status number, 'hang' or 'drop'. */
function scripted() {
  const state = { script: [], calls: 0 };
  const server = http.createServer((req, res) => {
    const step = state.script[Math.min(state.calls, state.script.length - 1)] ?? 'ok';
    state.calls++;
    if (step === 'hang') return; // never answers: the client's timeout must fire
    if (step === 'drop') return req.socket.destroy(); // a connection error
    if (typeof step === 'number') return res.writeHead(step, { 'content-type': 'application/json' }).end('{"code":"X"}');
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(makeSnapshot('ok')));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, state, url: `http://127.0.0.1:${server.address().port}` })));
}

describe('snapshot fetch resilience', () => {
  let svc;
  const realNow = Date.now;
  const quiet = console.error;
  before(async () => {
    svc = await scripted();
    process.env.FLEET_PUBLIC_API_URL = svc.url;
    process.env.FLEET_PUBLIC_CACHE_SECONDS = '0';
    delete process.env.FLEET_PUBLIC_STALE_SECONDS; // the code default is under test
    console.error = () => {};
  });
  after(() => {
    Date.now = realNow;
    console.error = quiet;
    svc.server.close();
  });
  const run = (script) => {
    svc.state.script = script;
    svc.state.calls = 0;
  };

  test('the constants: timeout 6 s, one retry after 1.5 s, worst case under 15 s', async () => {
    const m = await load();
    assert.equal(m.TIMEOUT_MS, 6000);
    assert.equal(m.RETRY_DELAY_MS, 1500);
    assert.ok(2 * m.TIMEOUT_MS + m.RETRY_DELAY_MS < 15_000);
  });

  test('a 5xx, then success: one retry, and the chart shows', async () => {
    const m = await load();
    run([503, 'ok']);
    const t = realNow();
    const r = await m.loadSnapshot();
    assert.equal(r.state, 'ok');
    assert.equal(svc.state.calls, 2, 'exactly one retry');
    assert.ok(realNow() - t >= 1400, 'the retry waits about 1.5 s');
  });

  test('a dropped connection, then success: retried', async () => {
    const m = await load();
    run(['drop', 'ok']);
    assert.equal((await m.loadSnapshot()).state, 'ok');
    assert.equal(svc.state.calls, 2);
  });

  test('a 4xx is NOT retried (it will not change on a second try)', async () => {
    const m = await load();
    run([429, 'ok']);
    assert.equal((await m.loadSnapshot()).state, 'unavailable');
    assert.equal(svc.state.calls, 1);
  });

  test('a retry that also fails, with no good copy at all: the graceful notice', async () => {
    const m = await load();
    run([500, 500]);
    assert.equal((await m.loadSnapshot()).state, 'unavailable');
    assert.equal(svc.state.calls, 2, 'one retry, no more');
  });

  test('a good copy is served past 10 minutes when the service fails (the one-day default)', async () => {
    const m = await load();
    run(['ok']);
    assert.equal((await m.loadSnapshot()).state, 'ok');
    const t0 = realNow();
    Date.now = () => t0 + 3 * 60 * 60_000; // three hours later
    try {
      run([500, 500]);
      const r = await m.loadSnapshot();
      assert.equal(r.state, 'ok', 'the three-hour-old copy is still shown');
      assert.equal(svc.state.calls, 2, 'the service was still asked, and retried');
    } finally {
      Date.now = realNow;
    }
  });

  test('a copy older than the stale window is not served: the graceful notice', async () => {
    const m = await load();
    run(['ok']);
    assert.equal((await m.loadSnapshot()).state, 'ok');
    const t0 = realNow();
    Date.now = () => t0 + 25 * 60 * 60_000; // past one day
    try {
      run([500, 500]);
      assert.equal((await m.loadSnapshot()).state, 'unavailable');
    } finally {
      Date.now = realNow;
    }
  });

  test('a failure is not cached: the next request asks the service again', async () => {
    const m = await load();
    run([500, 500, 'ok']);
    assert.equal((await m.loadSnapshot()).state, 'unavailable');
    assert.equal((await m.loadSnapshot()).state, 'ok');
    assert.equal(svc.state.calls, 3);
  });

  test('worst case: two timeouts plus the pause, under 15 s, then the notice', { timeout: 20_000 }, async () => {
    const m = await load();
    run(['hang', 'hang']);
    const t = realNow();
    const r = await m.loadSnapshot();
    const took = realNow() - t;
    assert.equal(r.state, 'unavailable');
    assert.equal(svc.state.calls, 2);
    assert.ok(took >= 12_000 && took < 15_000, `took ${took} ms`);
  });
});
