// A synthetic stand-in for the public snapshot service, for tests and local
// screenshots only. Shaped like the live team (department, role and team
// sizes); every first name is invented. Ordinals start at 870001 on purpose: a
// six-digit number that distinctive (outside the bundler's module-id range)
// lets a test prove no ordinal reaches the page.
//
// Each agent also carries a field the real snapshot does NOT have, `projectName`,
// holding a canary value. The parser must drop it, so a test can prove no
// project name ever reaches the page even if the service sent one. It also
// carries a `color` token, which the page must ignore: there is no per-person
// colour on the page.
//
// Mode 'full' adds the three OPTIONAL fields the service will send (public team titles, last-active times,
// 7-day message counts); every other mode leaves them out, as the service does today. The titles are the
// approved public catalogue wording; three teams carry none (unpublished), as live.
//
// Standalone: node tests/support/mock-snapshot.mjs --serve <port> [--mode ok|full|empty|error|invalid|limited|noreports]
import http from 'node:http';

export const ORDINAL_BASE = 870001;
export const PROJECT_CANARY = 'CanaryProjectZq';

const DEPARTMENTS = ['Executive', 'Engineering', 'Executive Office', 'Legal', 'Secretariat', 'Operations', 'Customer Support', 'Network', 'Unassigned'];
const ROLES = ['CEO', 'CTO', 'COO', 'CNO', 'Agent', 'Assistant', 'Contracts', 'Secretary', 'Scheduler', 'Support', 'Tech Lead', 'DBA', 'Backend', 'Frontend', 'Network Expert'];
const SQUADS = [5, ...Array(15).fill(4), 3];
// One public title per team, in squad order; null = unpublished.
export const TEAM_TITLES = [
  { en: 'Daily operations reporting', fa: 'گزارش روزانه عملیات' },
  { en: 'Fleet', fa: 'ناوگان' },
  { en: 'Platform', fa: 'پلتفرم' },
  { en: 'KSS Website', fa: 'وب‌سایت KSS' },
  { en: 'Persons registry', fa: 'پرونده جامع اشخاص' },
  { en: 'Roles & access', fa: 'مدیریت نقش‌ها و دسترسی‌ها' },
  { en: 'Capital-market reference data', fa: 'داده‌های مرجع بازار سرمایه' },
  { en: 'Projects & workshops', fa: 'پروژه‌ها و کارگاه‌ها' },
  { en: 'Association members information', fa: 'اطلاعات و گزارش‌گیری اعضای انجمن' },
  { en: 'Cash advance & settlement', fa: 'تنخواه و تسویه هزینه' },
  { en: 'Customer credit-risk rating', fa: 'رتبه‌بندی ریسک اعتباری مشتریان' },
  { en: 'Shared customer-risk registry', fa: 'سامانه مشترک ثبت و استعلام ریسک مشتریان' },
  { en: 'General meeting & board elections', fa: 'مجمع عمومی و انتخابات هیئت‌مدیره' },
  null,
  null,
  null,
  { en: 'Company profiles', fa: 'شناسنامه شرکت‌ها' },
];

const SYL_A = ['Al', 'Bri', 'Ca', 'Da', 'El', 'Fe', 'Ga', 'Ha', 'Is', 'Jo', 'Ka', 'Lo', 'Ma', 'Ne', 'Or', 'Pa', 'Ro', 'Sa', 'Ta', 'Vi', 'Wy', 'Ze', 'Ari', 'Mo'];
const SYL_B = ['na', 'ren', 'lo', 'vi', 'ra'];
const first = (i) => SYL_A[i % SYL_A.length] + SYL_B[Math.floor(i / SYL_A.length)];
// A retired field the page must ignore.
const COLOUR = { CEO: 'cyan', COO: 'blue', CTO: 'blue', CNO: 'blue', Assistant: 'purple', Support: 'red', 'Tech Lead': 'yellow' };

function people() {
  const rows = [];
  const add = (role, department, boss, team = null) => rows.push({ role, department, boss, team }) - 1;
  const ceo = add('CEO', 'Executive', null);
  const coo = add('COO', 'Executive', ceo);
  const cto = add('CTO', 'Engineering', ceo);
  const cno = add('CNO', 'Network', ceo);
  add('Assistant', 'Executive Office', ceo);
  add('Assistant', 'Executive Office', ceo);
  for (let i = 0; i < 16; i++) add('Support', 'Customer Support', coo);
  add('Contracts', 'Legal', coo);
  add('Secretary', 'Secretariat', coo);
  add('Scheduler', 'Operations', coo);
  for (let i = 0; i < 10; i++) add('Network Expert', 'Network', cno);
  SQUADS.forEach((size, t) => {
    const lead = add('Tech Lead', 'Engineering', cto, t);
    const members = size === 5 ? ['DBA', 'Backend', 'Frontend', 'Backend'] : size === 3 ? ['Backend', 'Frontend'] : ['DBA', 'Backend', 'Frontend'];
    for (const m of members) add(m, 'Engineering', lead, t);
  });
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
    // An internal project name the service must never send; the parser drops it either way.
    projectName: PROJECT_CANARY,
    ...(mode === 'full' ? { project: r.team === null ? null : TEAM_TITLES[r.team] } : {}),
    ...(mode === 'full'
      ? {
          // Spread over now (active), an hour ago, a day ago, three days ago; minute precision.
          lastActiveAt: new Date(Math.floor((Date.now() - [2, 70, 1500, 4400][i % 4] * 60_000) / 60_000) * 60_000).toISOString(),
          // As served: a SUPPRESSED day (fewer than 3) is null; a true zero would be 0.
          activity7d: Array.from({ length: 7 }, (_, d) => ((i * 3 + d * 5) % 9 < 3 ? null : (i * 3 + d * 5) % 9)),
        }
      : {}),
  }));
  const buckets = [];
  const weight = { Engineering: 9, 'Customer Support': 5, Executive: 2 };
  for (let d = 6; d >= 0; d--) {
    const day = utcDay(d);
    DEPARTMENTS.slice(0, 8).forEach((dept, i) => {
      const base = (weight[dept] ?? 1) * 4 + ((d * 7 + i * 3) % 9);
      buckets.push({ department: dept, day, direction: 'sent', count: base });
      buckets.push({ department: dept, day, direction: 'received', count: Math.max(0, base + ((i + d) % 5) - 2) });
    });
    buckets.push({ department: null, day, direction: 'sent', count: 3 + (d % 3) });
    buckets.push({ department: null, day, direction: 'received', count: 2 + (d % 4) });
  }
  const body = { generatedAt: new Date().toISOString(), agents, departments: DEPARTMENTS, roles: ROLES, activity: { ...activityRange, buckets } };
  // Today's hours (UTC): a quiet hour is suppressed (null), as the service will send it.
  if (mode === 'full') body.activeByHour = Array.from({ length: 24 }, (_, h) => ((h * 7) % 11 < 3 ? null : 3 + ((h * 7) % 11)));
  if (mode === 'invalid') body.activity = buckets; // the wrong shape: an array, not {from, to, buckets}
  return body;
}

/** Starts the mock. `state.mode` can be changed while it runs; `state.requests` records what arrived. */
export function startMock(port = 0) {
  // generatedAt: when set, every snapshot carries this fixed time (tests tell it from a render time).
  const state = { mode: 'ok', requests: [], generatedAt: null };
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
    const body = makeSnapshot(state.mode);
    if (state.generatedAt) body.generatedAt = state.generatedAt;
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
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
