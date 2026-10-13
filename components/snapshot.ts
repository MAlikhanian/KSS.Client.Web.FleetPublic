/**
 * The public team snapshot: its shape, a strict parser, and the view model the
 * page renders. Pure: no I/O, so the parser is tested directly.
 *
 * The snapshot is anonymous and already public-safe at the source: first names,
 * role and department names, a per-response ordinal (`n`) that only links an
 * agent to its manager, and activity counts per department and day. It carries
 * no presence field. A colour field, if the service still sends one, is ignored:
 * the page shows no per-agent colour.
 *
 * Three OPTIONAL fields per agent light the page up when the service sends them,
 * and the page renders in full without them:
 *  - project: the team's PUBLIC title in both languages, { en, fa } (a generic
 *    product description, never a customer or code name), or null;
 *  - lastActiveAt: when the agent was last active (UTC, minute precision), or null;
 *  - activity7d: messages per day over the last 7 days, oldest first, or null. A SUPPRESSED day (fewer than 3)
 *    arrives as null; a true zero is 0. (An older service sent suppressed days as 0: both parse.) The ordinal is never rendered; it exists
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
  project: PublicTitle | null;
  lastActiveAt: string | null;
  activity7d: Day[] | null;
  /** The agent's published support-room labels in order (a label may repeat), or null when none are published. */
  rooms: string[] | null;
}

/** One day's count; null = suppressed by the service (fewer than 3). */
export type Day = number | null;

/** A public title, served in both languages. */
export interface PublicTitle {
  en: string;
  fa: string;
}

export interface ActivityBucket {
  /** null = the service's grouped "other" row (small counts), shown as served. */
  department: string | null;
  day: string;
  direction: 'sent' | 'received';
  count: number;
}

/** One published AI account's latest reading: percentages 0-100 (null when unknown) and reset times (ISO UTC). */
export interface UsageAccount {
  label: string;
  weeklyPct: number | null;
  weeklyResetsAt: string | null;
  fiveHourPct: number | null;
  fiveHourResetsAt: string | null;
  readAt: string;
}

/** The published accounts' readings; asOf is the latest readAt among them. */
export interface Usage {
  asOf: string;
  accounts: UsageAccount[];
}

export interface Snapshot {
  /** When the service built this snapshot (ISO 8601, UTC), or null if it did not say. */
  generatedAt: string | null;
  agents: PublicAgent[];
  departments: string[];
  activity: ActivityBucket[];
  /**
   * Distinct active agents in each UTC hour of today, oldest first (24 values), or null when the service does not
   * send it. A value under 3 is suppressed at the source (null, or 0 from an older shape): both read "fewer than 3".
   */
  activeByHour: Day[] | null;
  /** AI account usage, or null when none is published (or the field is malformed: never fatal). */
  usage: Usage | null;
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
    if (n === null || firstName === null || role === null || department === null) return { ok: false, reason: 'AGENT_FIELD_INVALID' };
    if (a.reportsTo !== null && a.reportsTo !== undefined && reportsTo === null) return { ok: false, reason: 'AGENT_REPORTSTO_INVALID' };
    if (seen.has(n)) return { ok: false, reason: 'AGENT_ORDINAL_DUPLICATE' };
    seen.add(n);

    let project: PublicTitle | null = null;
    if (a.project !== undefined && a.project !== null) {
      const en = isObj(a.project) ? text(a.project.en) : null;
      const fa = isObj(a.project) ? text(a.project.fa) : null;
      if (en === null || fa === null) return { ok: false, reason: 'AGENT_PROJECT_INVALID' };
      project = { en, fa };
    }
    let lastActiveAt: string | null = null;
    if (a.lastActiveAt !== undefined && a.lastActiveAt !== null) {
      const t = typeof a.lastActiveAt === 'string' ? Date.parse(a.lastActiveAt) : NaN;
      if (Number.isNaN(t)) return { ok: false, reason: 'AGENT_LAST_ACTIVE_INVALID' };
      lastActiveAt = new Date(t).toISOString();
    }
    let activity7d: Day[] | null = null;
    if (a.activity7d !== undefined && a.activity7d !== null) {
      const v = a.activity7d;
      if (!Array.isArray(v) || v.length !== 7 || v.some((x) => x !== null && count(x) === null)) return { ok: false, reason: 'AGENT_ACTIVITY_INVALID' };
      activity7d = v as Day[];
    }
    // Optional and new: malformed rooms are dropped, never fatal.
    const rooms = Array.isArray(a.rooms) && a.rooms.length > 0 && a.rooms.length <= 50 && a.rooms.every((r) => text(r) !== null) ? (a.rooms as string[]).map((r) => r.trim()) : null;
    agents.push({ n, firstName, role, department, reportsTo, project, lastActiveAt, activity7d, rooms });
  }

  let generatedAt: string | null = null;
  if (body.generatedAt !== undefined && body.generatedAt !== null) {
    const t = typeof body.generatedAt === 'string' ? Date.parse(body.generatedAt) : NaN;
    if (Number.isNaN(t)) return { ok: false, reason: 'GENERATED_AT_INVALID' };
    generatedAt = new Date(t).toISOString();
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
  // Optional and new: a malformed value is IGNORED rather than refusing the snapshot, so a shape change in this one
  // field can never freeze the whole page on its last good copy.
  const hours = body.activeByHour;
  const activeByHour = Array.isArray(hours) && hours.length === 24 && hours.every((x) => x === null || count(x) !== null) ? (hours as Day[]) : null;
  return { ok: true, snapshot: { generatedAt, agents, departments, activity, activeByHour, usage: parseUsage(body.usage), days } };
}

const isoOrNull = (v: unknown): string | null | undefined => {
  if (v === null || v === undefined) return null;
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
};
const pctOrNull = (v: unknown): number | null | undefined => (v === null || v === undefined ? null : count(v) !== null && (v as number) <= 100 ? (v as number) : undefined);

/** The optional usage block. Anything malformed makes it null (the panel then says "no recent reading"). */
function parseUsage(v: unknown): Usage | null {
  if (!isObj(v) || !Array.isArray(v.accounts) || v.accounts.length === 0 || v.accounts.length > 10) return null;
  const asOf = isoOrNull(v.asOf);
  if (!asOf) return null;
  const accounts: UsageAccount[] = [];
  for (const a of v.accounts) {
    if (!isObj(a)) return null;
    const label = text(a.label);
    const readAt = isoOrNull(a.readAt);
    const weeklyPct = pctOrNull(a.weeklyPct);
    const fiveHourPct = pctOrNull(a.fiveHourPct);
    const weeklyResetsAt = isoOrNull(a.weeklyResetsAt);
    const fiveHourResetsAt = isoOrNull(a.fiveHourResetsAt);
    if (label === null || !readAt || weeklyPct === undefined || fiveHourPct === undefined || weeklyResetsAt === undefined || fiveHourResetsAt === undefined) return null;
    accounts.push({ label, weeklyPct, weeklyResetsAt, fiveHourPct, fiveHourResetsAt, readAt });
  }
  return { asOf, accounts };
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

// ── View model ─────────────────────────────────────────────────────────────
//
// The same dense layout as the signed-in Fleet chart, public variant:
//  - A LEADERSHIP STRIP: everyone in a leadership department, and everyone
//    whose role is a C-level role, whatever their department.
//  - Every person shows first name, role, department and the first name of
//    the person they report to. No per-person colour.
//  - ENGINEERING: one box PER TEAM LEAD. A lead is an engineer whose manager
//    sits in the strip; her box holds her and everyone reporting to her. The
//    title is her first name, her role and the count, and nothing else: the
//    snapshot carries no project, and no project or customer name is ever
//    derived. Engineers under no lead share one "Engineering" box, which also
//    covers a snapshot that carries no reporting lines at all.
//  - Every other department is ONE box.
// Names are compared trimmed and case-insensitively, as the service serves them.

const LEADERSHIP_DEPARTMENTS = new Set(['executive', 'executive office']);
const LEADERSHIP_ROLES = new Set(['ceo', 'coo', 'cto', 'cno']);
const BY_LEAD_DEPARTMENTS = new Set(['engineering']);
/** "Active now" means active in the last 15 minutes. */
export const ACTIVE_WINDOW_MS = 15 * 60_000;
const norm = (s: string) => s.trim().toLowerCase().replace(/’/g, "'");

export interface ChartPerson {
  firstName: string;
  role: string;
  department: string;
  /** The first name of the person this one reports to, or null. */
  reportsTo: string | null;
  lastActiveAt: string | null;
  activity7d: Day[] | null;
  /** Nesting under the box's first person: 0 for the lead, 1 for her reports, ... */
  depth: number;
  rooms: string[] | null;
}

export type ChartBox =
  | { kind: 'lead'; lead: ChartPerson; project: PublicTitle | null; people: ChartPerson[]; size: number; activity7d: TeamDay[] | null }
  | { kind: 'department'; department: string; people: ChartPerson[]; size: number; activity7d: TeamDay[] | null };

/**
 * A team's day: the sum of its members' known counts, and whether any member's count was suppressed that day (so
 * the sum is a lower bound). `total: null` when every reporting member was suppressed: the day reads "fewer than 3".
 */
export interface TeamDay {
  total: number | null;
  partial: boolean;
}

/** Day-by-day totals over the people who report one; null when nobody does. */
export function sumActivity(people: { activity7d: Day[] | null }[]): TeamDay[] | null {
  const known = people.map((p) => p.activity7d).filter((v): v is Day[] => v !== null);
  if (!known.length) return null;
  return Array.from({ length: 7 }, (_, i) => {
    const values = known.map((v) => v[i]);
    const shown = values.filter((x): x is number => x !== null);
    const partial = shown.length < values.length;
    return { total: shown.length ? shown.reduce((a, b) => a + b, 0) : null, partial };
  });
}

export interface ChartDepartmentActivity {
  department: string | null;
  sent: number;
  received: number;
  /** Sent plus received, per day. */
  daily: number[];
  /** Sent only, per day: what the messages chart stacks, so a message between two agents is counted once. */
  dailySent: number[];
}

export interface ChartModel {
  generatedAt: string | null;
  strip: ChartPerson[];
  /** How many agents were active in the 15 minutes before generatedAt; null when no agent reports a time. */
  activeNow: number | null;
  boxes: ChartBox[];
  total: number;
  days: string[];
  activity: ChartDepartmentActivity[];
  other: ChartDepartmentActivity | null;
  totalSent: number;
  totalReceived: number;
  activeByHour: Day[] | null;
  usage: Usage | null;
  /** Head count per served department, in the service's order (departments with nobody left out). */
  headcount: { department: string; count: number }[];
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
    reportsTo: manager(a)?.firstName ?? null,
    lastActiveAt: a.lastActiveAt,
    activity7d: a.activity7d,
    depth,
    rooms: a.rooms,
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
        boxes.push({ kind: 'lead', lead: people[0], project: lead.project, people, size: people.length, activity7d: sumActivity(people) });
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
        boxes.push({ kind: 'department', department, people, size: rest.length, activity7d: sumActivity(people) });
      }
      continue;
    }

    const heads = members.filter((a) => {
      const m = manager(a);
      return !m || !within.has(m.n);
    });
    const people = heads.flatMap((h) => [person(h, 0), ...walk(h, within, 1)]);
    boxes.push({ kind: 'department', department, people, size: members.length, activity7d: sumActivity(people) });
  }

  const days = s.days;
  const sum = (dept: string | null, pick: (b: ActivityBucket) => boolean) =>
    s.activity.filter((b) => b.department === dept && pick(b)).reduce((acc, b) => acc + b.count, 0);
  const deptActivity = (dept: string | null): ChartDepartmentActivity => ({
    department: dept,
    sent: sum(dept, (b) => b.direction === 'sent'),
    received: sum(dept, (b) => b.direction === 'received'),
    daily: days.map((d) => sum(dept, (b) => b.day === d)),
    dailySent: days.map((d) => sum(dept, (b) => b.day === d && b.direction === 'sent')),
  });
  const activity = s.departments
    .map(deptActivity)
    .filter((d) => d.sent + d.received > 0)
    .sort((a, b) => b.sent + b.received - (a.sent + a.received));
  const otherRow = deptActivity(null);

  const withTime = s.agents.filter((a) => a.lastActiveAt !== null);
  const at = s.generatedAt ? Date.parse(s.generatedAt) : Date.now();
  const activeNow = withTime.length ? withTime.filter((a) => at - Date.parse(a.lastActiveAt as string) <= ACTIVE_WINDOW_MS).length : null;

  return {
    generatedAt: s.generatedAt,
    strip: stripAgents.map((a) => person(a, 0)),
    activeNow,
    boxes,
    total: s.agents.length,
    days,
    activity,
    other: otherRow.sent + otherRow.received > 0 ? otherRow : null,
    totalSent: s.activity.filter((b) => b.direction === 'sent').reduce((acc, b) => acc + b.count, 0),
    totalReceived: s.activity.filter((b) => b.direction === 'received').reduce((acc, b) => acc + b.count, 0),
    activeByHour: s.activeByHour,
    usage: s.usage,
    headcount: s.departments.map((department) => ({ department, count: s.agents.filter((a) => a.department === department).length })).filter((d) => d.count > 0),
  };
}
