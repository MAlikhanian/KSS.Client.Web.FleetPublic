// A synthetic stand-in for the public snapshot service, for tests and local
// screenshots only. Shaped like the live team (department, role and team
// sizes); every first name is invented. Ordinals start at 7001 on purpose: a
// number that distinctive lets a test prove no ordinal reaches the page.
//
// Each agent also carries a field the real snapshot does NOT have, `project`,
// holding a canary value. The parser must drop it, so a test can prove no
// project name ever reaches the page even if the service sent one.
//
// Standalone: node tests/support/mock-snapshot.mjs --serve <port> [--mode ok|empty|error|invalid|limited|noreports]
import http from 'node:http';

export const ORDINAL_BASE = 7001;
export const PROJECT_CANARY = 'CanaryProjectZq';

const DEPARTMENTS = ['Executive', 'Advisory', 'Engineering', 'Board Office', "Founder's Office", 'Executive Office', 'Legal', 'Secretariat', 'Operations', 'Customer Support', 'Unassigned'];
const ROLES = ['CEO', 'CEO Advisor', 'CTO', 'COO', 'Agent', 'Assistant', 'Contracts', 'Secretary', 'Scheduler', 'Support', 'Tech Lead', 'DBA', 'Backend', 'Frontend'];
const SQUADS = [5, ...Array(15).fill(4), 3];

const SYL_A = ['Al', 'Bri', 'Ca', 'Da', 'El', 'Fe', 'Ga', 'Ha', 'Is', 'Jo', 'Ka', 'Lo', 'Ma', 'Ne', 'Or', 'Pa', 'Ro', 'Sa', 'Ta', 'Vi', 'Wy', 'Ze', 'Ari', 'Mo'];
const SYL_B = ['na', 'ren', 'lo', 'vi'];
const first = (i) => SYL_A[i % SYL_A.length] + SYL_B[Math.floor(i / SYL_A.length)];
const COLOUR = { CEO: 'cyan', COO: 'blue', CTO: 'blue', 'CEO Advisor': 'pink', Assistant: 'purple', Support: 'red', Contracts: 'green', Secretary: 'green', Scheduler: 'orange', 'Tech Lead': 'yellow', DBA: 'yellow', Backend: 'yellow', Frontend: 'yellow' };

function people() {
  const rows = [];
  const add = (role, department, boss) => rows.push({ role, department, boss }) - 1;
  const ceo = add('CEO', 'Executive', null);
  add('Assistant', 'Board Office', null);
  add('Assistant', "Founder's Office", null);
  add('Assistant', "Founder's Office", null);
  const coo = add('COO', 'Executive', ceo);
  add('CEO Advisor', 'Advisory', ceo);
  add('Assistant', 'Executive Office', ceo);
  const cto = add('CTO', 'Engineering', ceo);
  for (let i = 0; i < 13; i++) add('Support', 'Customer Support', coo);
  add('Contracts', 'Legal', coo);
  add('Secretary', 'Secretariat', coo);
  add('Scheduler', 'Operations', coo);
  for (const size of SQUADS) {
    const lead = add('Tech Lead', 'Engineering', cto);
    const members = size === 5 ? ['DBA', 'Backend', 'Frontend', 'Backend'] : size === 3 ? ['Backend', 'Frontend'] : ['DBA', 'Backend', 'Frontend'];
    for (const m of members) add(m, 'Engineering', lead);
  }
  return rows;
}

function utcDay(offset) {
  return new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
}

export function makeSnapshot(mode = 'ok') {
  const activityRange = { from: utcDay(6), to: utcDay(0) };
  if (mode === 'empty') {
    return { generatedAt: new Date().toISOString(), agents: [], departments: DEPARTMENTS, roles: ROLES, activity: { ...activityRange, buckets: [] } };
  }
  const rows = people();
  const agents = rows.map((r, i) => ({
    n: ORDINAL_BASE + i,
    firstName: first(i),
    role: r.role,
    department: r.department,
    // 'noreports': the engineers carry no reporting line at all.
    reportsTo: r.boss === null || (mode === 'noreports' && r.department === 'Engineering') ? null : ORDINAL_BASE + r.boss,
    color: COLOUR[r.role] ?? 'default',
    project: PROJECT_CANARY,
  }));
  const buckets = [];
  const weight = { Engineering: 9, 'Customer Support': 5, Executive: 2 };
  for (let d = 6; d >= 0; d--) {
    const day = utcDay(d);
    DEPARTMENTS.slice(0, 10).forEach((dept, i) => {
      const base = (weight[dept] ?? 1) * 4 + ((d * 7 + i * 3) % 9);
      buckets.push({ department: dept, day, direction: 'sent', count: base });
      buckets.push({ department: dept, day, direction: 'received', count: Math.max(0, base + ((i + d) % 5) - 2) });
    });
    buckets.push({ department: null, day, direction: 'sent', count: 3 + (d % 3) });
    buckets.push({ department: null, day, direction: 'received', count: 2 + (d % 4) });
  }
  const body = { generatedAt: new Date().toISOString(), agents, departments: DEPARTMENTS, roles: ROLES, activity: { ...activityRange, buckets } };
  if (mode === 'invalid') body.activity = buckets; // the wrong shape: an array, not {from, to, buckets}
  return body;
}

/** Starts the mock. `state.mode` can be changed while it runs; `state.requests` records what arrived. */
export function startMock(port = 0) {
  const state = { mode: 'ok', requests: [] };
  const server = http.createServer((req, res) => {
    state.requests.push({ method: req.method, url: req.url, headers: { ...req.headers } });
    if (req.url !== '/api/public/snapshot') {
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"code":"FLEET_NOT_FOUND"}');
      return;
    }
    if (state.mode === 'error') {
      res.writeHead(500, { 'content-type': 'application/json' }).end('{"code":"FLEET_INTERNAL_ERROR"}');
      return;
    }
    if (state.mode === 'limited') {
      res.writeHead(429, { 'content-type': 'application/json' }).end('{"code":"FLEET_RATE_LIMITED"}');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(makeSnapshot(state.mode)));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, state, port: server.address().port })));
}

if (process.argv.includes('--serve')) {
  const port = Number(process.argv[process.argv.indexOf('--serve') + 1]);
  const modeAt = process.argv.indexOf('--mode');
  const { state } = await startMock(port);
  if (modeAt > 0) state.mode = process.argv[modeAt + 1];
  console.log(`mock snapshot on ${port}, mode ${state.mode}`);
  setTimeout(() => process.exit(0), 60 * 60 * 1000); // never outlives an hour
}
