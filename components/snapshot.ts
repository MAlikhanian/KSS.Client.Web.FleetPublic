/**
 * The public team snapshot: its shape, a strict parser, and the view model the
 * page renders. Pure: no I/O, so the parser is tested directly.
 *
 * The snapshot is anonymous and already public-safe at the source: first names,
 * role and department names, a per-response ordinal (`n`) that only links an
 * agent to its manager, a role colour, and activity counts per department and
 * day. It carries no presence field. The ordinal is never rendered; it exists
 * only to build the reporting lines.
 *
 * Anything that does not match is REJECTED as a whole, never partly rendered:
 * the page then shows its graceful "back shortly" state and the server logs the
 * reason.
 */

export interface PublicAgent {
  n: number;
  firstName: string;
  role: string;
  department: string;
  reportsTo: number | null;
  color: string;
}

export interface ActivityBucket {
  /** null = the service's grouped "other" row (small counts), shown as served. */
  department: string | null;
  day: string;
  direction: 'sent' | 'received';
  count: number;
}

export interface Snapshot {
  agents: PublicAgent[];
  departments: string[];
  activity: ActivityBucket[];
  /** The activity period's days, oldest first. */
  days: string[];
}

export type ParseResult = { ok: true; snapshot: Snapshot } | { ok: false; reason: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 80;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_TEXT ? v.trim() : null;
const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
/** A lookup list may be plain names or objects carrying a name. */
const names = (v: unknown): string[] | null => {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    const name = text(isObj(item) ? item.name : item);
    if (name === null) return null;
    out.push(name);
  }
  return out;
};

export function parseSnapshot(body: unknown): ParseResult {
  if (!isObj(body)) return { ok: false, reason: 'SNAPSHOT_NOT_OBJECT' };
  if (!Array.isArray(body.agents)) return { ok: false, reason: 'SNAPSHOT_NO_AGENTS_ARRAY' };

  const agents: PublicAgent[] = [];
  const seen = new Set<number>();
  for (const a of body.agents) {
    if (!isObj(a)) return { ok: false, reason: 'AGENT_NOT_OBJECT' };
    const n = count(a.n);
    const firstName = text(a.firstName);
    const role = text(a.role);
    const department = text(a.department);
    const reportsTo = a.reportsTo === null || a.reportsTo === undefined ? null : count(a.reportsTo);
    const color = typeof a.color === 'string' ? a.color.trim() : '';
    if (n === null || firstName === null || role === null || department === null) return { ok: false, reason: 'AGENT_FIELD_INVALID' };
    if (a.reportsTo !== null && a.reportsTo !== undefined && reportsTo === null) return { ok: false, reason: 'AGENT_REPORTSTO_INVALID' };
    if (seen.has(n)) return { ok: false, reason: 'AGENT_ORDINAL_DUPLICATE' };
    seen.add(n);
    agents.push({ n, firstName, role, department, reportsTo, color });
  }

  const departmentList = body.departments === undefined ? [] : names(body.departments);
  if (departmentList === null) return { ok: false, reason: 'DEPARTMENTS_INVALID' };

  // activity: { from, to, buckets: [...] }, the last 7 UTC days, today included.
  const activity: ActivityBucket[] = [];
  let range: { from: string; to: string } | null = null;
  let rawBuckets: unknown[] = [];
  if (body.activity !== undefined && body.activity !== null) {
    if (!isObj(body.activity) || !Array.isArray(body.activity.buckets)) return { ok: false, reason: 'ACTIVITY_SHAPE_INVALID' };
    const { from, to } = body.activity;
    if (typeof from !== 'string' || typeof to !== 'string' || !DAY.test(from) || !DAY.test(to) || from > to) {
      return { ok: false, reason: 'ACTIVITY_RANGE_INVALID' };
    }
    range = { from, to };
    rawBuckets = body.activity.buckets;
  }
  for (const b of rawBuckets) {
    if (!isObj(b)) return { ok: false, reason: 'ACTIVITY_NOT_OBJECT' };
    const department = b.department === null ? null : text(b.department);
    const c = count(b.count);
    if ((b.department !== null && department === null) || c === null) return { ok: false, reason: 'ACTIVITY_FIELD_INVALID' };
    if (typeof b.day !== 'string' || !DAY.test(b.day)) return { ok: false, reason: 'ACTIVITY_DAY_INVALID' };
    if (b.direction !== 'sent' && b.direction !== 'received') return { ok: false, reason: 'ACTIVITY_DIRECTION_INVALID' };
    // Only buckets inside the stated range are counted, so totals and the day strip agree.
    if (range && (b.day < range.from || b.day > range.to)) continue;
    activity.push({ department, day: b.day, direction: b.direction, count: c });
  }
  const days = range ? daysBetween(range.from, range.to) : Array.from(new Set(activity.map((b) => b.day))).sort();
  if (days.length > 31) return { ok: false, reason: 'ACTIVITY_RANGE_TOO_LONG' };

  // Departments in the service's order, then any named only by an agent or a bucket.
  const departments = [...departmentList];
  for (const d of [...agents.map((a) => a.department), ...activity.map((b) => b.department)]) {
    if (d !== null && !departments.includes(d)) departments.push(d);
  }
  return { ok: true, snapshot: { agents, departments, activity, days } };
}

/** Every UTC day from `from` to `to`, inclusive. */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end && out.length <= 31; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Colours the page may use. The service sends a NAMED token (the agent's colour
 * on the team's own scheme: "red", "yellow", "cyan", ...). A known token maps to
 * the site's palette, a hex value is allowed as is, and anything else ("default"
 * included) falls back to a neutral colour, so a value from the service can never
 * inject arbitrary CSS.
 */
const ROLE_TOKENS = new Set(['cyan', 'blue', 'violet', 'purple', 'pink', 'amber', 'yellow', 'red', 'green', 'orange']);
const TOKEN_ALIAS: Record<string, string> = { purple: 'violet', yellow: 'amber' };
export function safeColor(value: string): string {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(v)) return v;
  if (ROLE_TOKENS.has(v)) return `var(--role-${TOKEN_ALIAS[v] ?? v})`;
  return 'var(--muted)';
}

// ── View model ─────────────────────────────────────────────────────────────
//
// The same dense layout as the signed-in Fleet chart, public variant:
//  - A LEADERSHIP STRIP: everyone in a leadership department, and everyone
//    whose role is a C-level role, whatever their department.
//  - ENGINEERING: one box PER TEAM LEAD. A lead is an engineer whose manager
//    sits in the strip; her box holds her and everyone reporting to her. The
//    title is her first name, her role and the count, and nothing else: the
//    snapshot carries no project, and no project or customer name is ever
//    derived. Engineers under no lead share one "Engineering" box, which also
//    covers a snapshot that carries no reporting lines at all.
//  - Every other department is ONE box.
// Names are compared trimmed and case-insensitively, as the service serves them.

const LEADERSHIP_DEPARTMENTS = new Set(['executive', 'advisory', 'board office', "founder's office", 'executive office']);
const LEADERSHIP_ROLES = new Set(['ceo', 'coo', 'cto', 'ceo advisor']);
const BY_LEAD_DEPARTMENTS = new Set(['engineering']);
const norm = (s: string) => s.trim().toLowerCase().replace(/’/g, "'");

export interface ChartPerson {
  firstName: string;
  role: string;
  department: string;
  color: string;
  /** Nesting under the box's first person: 0 for the lead, 1 for her reports, ... */
  depth: number;
}

export interface StripPerson extends ChartPerson {
  /** Label by department instead of role (e.g. an office's assistant). */
  byDepartment: boolean;
}

export type ChartBox =
  | { kind: 'lead'; lead: ChartPerson; people: ChartPerson[]; size: number }
  | { kind: 'department'; department: string; people: ChartPerson[]; size: number };

export interface ChartDepartmentActivity {
  department: string | null;
  sent: number;
  received: number;
  daily: number[];
}

export interface ChartModel {
  strip: StripPerson[];
  boxes: ChartBox[];
  total: number;
  days: string[];
  activity: ChartDepartmentActivity[];
  other: ChartDepartmentActivity | null;
  totalSent: number;
  totalReceived: number;
}

export function buildChart(s: Snapshot): ChartModel {
  const byN = new Map(s.agents.map((a) => [a.n, a]));
  const manager = (a: PublicAgent) => (a.reportsTo !== null && a.reportsTo !== a.n ? byN.get(a.reportsTo) : undefined);
  const children = new Map<number, PublicAgent[]>();
  for (const a of s.agents) {
    const m = manager(a);
    if (m) children.set(m.n, [...(children.get(m.n) ?? []), a]);
  }
  const person = (a: PublicAgent, depth: number): ChartPerson => ({
    firstName: a.firstName,
    role: a.role,
    department: a.department,
    color: safeColor(a.color),
    depth,
  });
  const isLeadRole = (a: PublicAgent) => LEADERSHIP_ROLES.has(norm(a.role));

  // Strip, ordered down the hierarchy.
  let stripAgents = s.agents.filter((a) => LEADERSHIP_DEPARTMENTS.has(norm(a.department)) || isLeadRole(a));
  if (stripAgents.length === 0) stripAgents = s.agents.filter((a) => !manager(a));
  const depthOf = (a: PublicAgent) => {
    let d = 0;
    for (let m = manager(a); m && d < 20; m = manager(m)) d++;
    return d;
  };
  stripAgents = [...stripAgents].sort((x, y) => depthOf(x) - depthOf(y));
  const inStrip = new Set(stripAgents.map((a) => a.n));

  // A subtree inside one set of people, in reporting order.
  const walk = (parent: PublicAgent, within: Set<number>, depth: number): ChartPerson[] =>
    (children.get(parent.n) ?? []).filter((k) => within.has(k.n)).flatMap((k) => [person(k, depth), ...walk(k, within, depth + 1)]);

  const boxes: ChartBox[] = [];
  for (const department of s.departments) {
    const members = s.agents.filter((a) => a.department === department && !inStrip.has(a.n));
    if (!members.length) continue;
    const within = new Set(members.map((a) => a.n));

    if (BY_LEAD_DEPARTMENTS.has(norm(department))) {
      const leads = members.filter((a) => {
        const m = manager(a);
        return m !== undefined && inStrip.has(m.n);
      });
      const placed = new Set<number>();
      for (const lead of leads) {
        const people = [person(lead, 0), ...walk(lead, within, 1)];
        placed.add(lead.n);
        const mark = (p: PublicAgent) => (children.get(p.n) ?? []).filter((k) => within.has(k.n)).forEach((k) => (placed.add(k.n), mark(k)));
        mark(lead);
        boxes.push({ kind: 'lead', lead: people[0], people, size: people.length });
      }
      const rest = members.filter((a) => !placed.has(a.n));
      if (rest.length) {
        // The safe fallback: engineers under no lead (or no reporting lines at all) share one box.
        const restSet = new Set(rest.map((a) => a.n));
        const heads = rest.filter((a) => {
          const m = manager(a);
          return !m || !restSet.has(m.n);
        });
        const people = heads.flatMap((h) => [person(h, 0), ...walk(h, restSet, 1)]);
        boxes.push({ kind: 'department', department, people, size: rest.length });
      }
      continue;
    }

    const heads = members.filter((a) => {
      const m = manager(a);
      return !m || !within.has(m.n);
    });
    const people = heads.flatMap((h) => [person(h, 0), ...walk(h, within, 1)]);
    boxes.push({ kind: 'department', department, people, size: members.length });
  }

  const days = s.days;
  const sum = (dept: string | null, pick: (b: ActivityBucket) => boolean) =>
    s.activity.filter((b) => b.department === dept && pick(b)).reduce((acc, b) => acc + b.count, 0);
  const deptActivity = (dept: string | null): ChartDepartmentActivity => ({
    department: dept,
    sent: sum(dept, (b) => b.direction === 'sent'),
    received: sum(dept, (b) => b.direction === 'received'),
    daily: days.map((d) => sum(dept, (b) => b.day === d)),
  });
  const activity = s.departments
    .map(deptActivity)
    .filter((d) => d.sent + d.received > 0)
    .sort((a, b) => b.sent + b.received - (a.sent + a.received));
  const otherRow = deptActivity(null);

  return {
    strip: stripAgents.map((a) => ({ ...person(a, 0), byDepartment: !isLeadRole(a) })),
    boxes,
    total: s.agents.length,
    days,
    activity,
    other: otherRow.sent + otherRow.received > 0 ? otherRow : null,
    totalSent: s.activity.filter((b) => b.direction === 'sent').reduce((acc, b) => acc + b.count, 0),
    totalReceived: s.activity.filter((b) => b.direction === 'received').reduce((acc, b) => acc + b.count, 0),
  };
}
