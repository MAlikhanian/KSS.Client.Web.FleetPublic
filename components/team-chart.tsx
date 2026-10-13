import type { Copy } from './copy';
import { DEPARTMENT_NAMES_FA, ROLE_NAMES_FA } from './names';
import { ACTIVE_WINDOW_MS, type ChartBox, type ChartModel, type ChartPerson } from './snapshot';
import { Avatar, AvatarGroup } from './ui/avatar';
import { Badge } from './ui/badge';
import { Card, CardBody, CardHeader } from './ui/card';
import { Sparkline } from './ui/sparkline';
import { Stat } from './ui/stat';

/**
 * The public team dashboard: stat tiles, the leadership card, one card per engineering team, one per other
 * department, and the activity cards. Per person: an initial, first name, role and department, who she
 * reports to, and (when the service sends it) when she was last active. No identifier of any kind, no
 * per-person colour, no customer: a team is titled by its PUBLIC title from the service, or by its lead.
 */

export type SectionKey = 'overview' | 'leadership' | 'engineering' | 'network' | 'departments' | 'activity';

const norm = (s: string) => s.trim().toLowerCase();
const isNetwork = (b: ChartBox) => b.kind === 'department' && norm(b.department) === 'network';

export function names(c: Copy) {
  const fa = c.lang === 'fa';
  return {
    role: (served: string) => (fa && ROLE_NAMES_FA[served]) || served,
    department: (served: string) => (fa && DEPARTMENT_NAMES_FA[served]) || served,
  };
}

/** The sections this model fills, in page order: the menu shows exactly these. */
export function sectionsOf(model: ChartModel | null): SectionKey[] {
  if (!model) return ['overview'];
  const out: SectionKey[] = ['overview'];
  if (model.strip.length) out.push('leadership');
  if (model.boxes.some((b) => !isNetwork(b) && (b.kind === 'lead' || norm(b.department) === 'engineering'))) out.push('engineering');
  if (model.boxes.some(isNetwork)) out.push('network');
  if (model.boxes.some((b) => b.kind === 'department' && !isNetwork(b) && norm(b.department) !== 'engineering')) out.push('departments');
  if (model.activity.length || model.other) out.push('activity');
  return out;
}

function relative(iso: string, nowIso: string | null, c: Copy): string {
  const diff = Math.max(0, (nowIso ? Date.parse(nowIso) : Date.now()) - Date.parse(iso));
  const rtf = new Intl.RelativeTimeFormat(c.locale, { numeric: 'auto' });
  const min = Math.round(diff / 60_000);
  if (min < 60) return rtf.format(-min, 'minute');
  const h = Math.round(min / 60);
  if (h < 48) return rtf.format(-h, 'hour');
  return rtf.format(-Math.round(h / 24), 'day');
}

function LastActive({ p, now, c }: { p: ChartPerson; now: string | null; c: Copy }) {
  if (!p.lastActiveAt) return null;
  const recent = (now ? Date.parse(now) : Date.now()) - Date.parse(p.lastActiveAt) <= ACTIVE_WINDOW_MS;
  return (
    <span className="basis-full" data-testid="last-active">
      {recent ? (
        <Badge tone="success" dot>
          {c.activeNow}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">{c.lastActive(relative(p.lastActiveAt, now, c))}</span>
      )}
    </span>
  );
}

function PersonRow({ p, c, now, strong }: { p: ChartPerson; c: Copy; now: string | null; strong?: boolean }) {
  const n = names(c);
  return (
    <li className="flex min-w-0 items-start gap-2.5 py-1.5" style={p.depth > 1 ? { paddingInlineStart: `${(p.depth - 1) * 0.75}rem` } : undefined}>
      <Avatar name={p.firstName} />
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm leading-6">
        <bdi className={strong ? 'line-name font-extrabold' : 'line-name font-semibold'}>{p.firstName}</bdi>
        <span className="line-role text-muted-foreground [overflow-wrap:anywhere]">
          {n.role(p.role)} · {n.department(p.department)}
        </span>
        {p.reportsTo ? (
          <span className="line-reports basis-full text-xs leading-5 text-muted-foreground">
            {c.reportsTo('')}
            <bdi>{p.reportsTo}</bdi>
          </span>
        ) : null}
        <LastActive p={p} now={now} c={c} />
      </span>
    </li>
  );
}

function ActivityFooter({ values, c }: { values: number[] | null; c: Copy }) {
  if (!values) return null;
  const num = (v: number) => v.toLocaleString(c.locale);
  // A 0 from the service means "fewer than 3" (suppressed), so a total over such days is a lower bound.
  const total = num(values.reduce((a, b) => a + b, 0));
  const shown = values.some((v) => v === 0) ? c.atLeast(total) : total;
  return (
    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border px-4 py-3 lg:px-5" data-testid="team-activity">
      <span className="text-xs text-muted-foreground">
        {c.statMessages}: <span className="font-semibold text-foreground tabular-nums">{shown}</span>
      </span>
      <Sparkline values={values} label={c.sparkLabel(values.map((v) => (v === 0 ? c.underThree : num(v))).join('، '))} />
    </div>
  );
}

function SectionHead({ id, title, body, count, c }: { id: string; title: string; body?: string; count?: number; c: Copy }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="m-0 text-xl font-extrabold">
        {title}
      </h2>
      {count !== undefined ? <Badge>{count.toLocaleString(c.locale)}</Badge> : null}
      {body ? <p className="m-0 basis-full text-sm text-muted-foreground">{body}</p> : null}
    </div>
  );
}

const GRID = 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))]';

function BoxCard({ box, c, now }: { box: ChartBox; c: Copy; now: string | null }) {
  const n = names(c);
  const num = (v: number) => v.toLocaleString(c.locale);
  const title =
    box.kind === 'lead'
      ? box.project
        ? [box.project[c.lang], num(box.size)]
        : [box.lead.firstName, n.role(box.lead.role), num(box.size)]
      : [n.department(box.department), num(box.size)];
  return (
    <Card data-box-kind={box.kind} className="flex flex-col">
      <CardHeader
        title={title.map((part, i) => (
          <span key={i}>
            {i ? ' · ' : ''}
            <bdi>{part}</bdi>
          </span>
        ))}
        titleProps={{ 'data-box-title': box.kind }}
        aside={<AvatarGroup names={box.people.map((p) => p.firstName)} moreLabel={c.more} />}
      />
      {box.kind === 'lead' && box.project ? (
        <p className="m-0 border-b border-border px-4 py-2 text-xs text-muted-foreground lg:px-5" data-testid="team-lead">
          {c.teamLead}: <bdi>{box.lead.firstName}</bdi>
        </p>
      ) : null}
      <CardBody className="py-1.5">
        <ul className="m-0 list-none divide-y divide-border p-0">
          {box.people.map((p, i) => (
            <PersonRow key={i} p={p} c={c} now={now} strong={p.depth === 0 && box.people.length > 1} />
          ))}
        </ul>
      </CardBody>
      <ActivityFooter values={box.activity7d} c={c} />
    </Card>
  );
}

function Leadership({ model, c, now }: { model: ChartModel; c: Copy; now: string | null }) {
  const n = names(c);
  const ceo = model.strip.filter((p) => norm(p.role) === 'ceo');
  const clevel = model.strip.filter((p) => ['coo', 'cto', 'cno'].includes(norm(p.role)));
  const office = model.strip.filter((p) => !ceo.includes(p) && !clevel.includes(p));
  const group = (label: string, people: ChartPerson[], testid: string) =>
    people.length ? (
      <div className="min-w-0" data-testid={testid}>
        <h3 className="m-0 mb-1 text-sm font-extrabold text-muted-foreground">{label}</h3>
        <ul className="m-0 grid list-none gap-x-6 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr))]">
          {people.map((p, i) => (
            <PersonRow key={i} p={p} c={c} now={now} strong />
          ))}
        </ul>
      </div>
    ) : null;
  return (
    <section aria-labelledby="leadership">
      <SectionHead id="leadership" title={c.leadership} count={model.strip.length} c={c} />
      <Card data-testid="team-strip">
        <CardBody className="grid gap-4 py-4">
          {group(ceo.length ? n.role(ceo[0].role) : c.leadership, ceo, 'lead-ceo')}
          {group(c.cLevel, clevel, 'lead-clevel')}
          {group(c.executiveOffice, office, 'lead-office')}
        </CardBody>
      </Card>
    </section>
  );
}

function Activity({ model, c }: { model: ChartModel; c: Copy }) {
  const n = names(c);
  const num = (v: number) => v.toLocaleString(c.locale);
  const card = (key: string, title: string, d: { sent: number; received: number; daily: number[] }, other: boolean) => (
    <li key={key} className={other ? 'activity-card activity-other min-w-0 rounded-card border border-dashed border-border p-4' : 'activity-card min-w-0 rounded-card border border-border bg-card p-4'}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h3 className="m-0 min-w-0 text-base font-extrabold [overflow-wrap:anywhere]">{title}</h3>
        {other ? <span className="text-xs text-muted-foreground">{c.otherBody}</span> : <Sparkline values={d.daily} label={c.sparkLabel(d.daily.map(num).join('، '))} />}
      </div>
      <dl className="m-0 mt-3 grid grid-cols-2 gap-3">
        {[
          [c.sent, d.sent],
          [c.received, d.received],
        ].map(([label, v]) => (
          <div key={String(label)} className="rounded-control bg-muted px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="m-0 text-xl leading-tight font-extrabold tabular-nums">{num(v as number)}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
  return (
    <section aria-labelledby="activity">
      <SectionHead id="activity" title={c.activityTitle} body={c.activityBody} c={c} />
      <ul className={`m-0 list-none p-0 ${GRID.replace('19rem', '15rem')}`}>
        {model.activity.map((d) => card(d.department ?? '', d.department ? n.department(d.department) : '', d, false))}
        {model.other ? card('other', c.other, model.other, true) : null}
      </ul>
    </section>
  );
}

export function TeamChart({ model, c }: { model: ChartModel; c: Copy }) {
  const num = (v: number) => v.toLocaleString(c.locale);
  const now = model.generatedAt;
  const eng = model.boxes.filter((b) => !isNetwork(b) && (b.kind === 'lead' || norm(b.department) === 'engineering'));
  const network = model.boxes.filter(isNetwork);
  const other = model.boxes.filter((b) => !eng.includes(b) && !network.includes(b));
  const teams = model.boxes.filter((b) => b.kind === 'lead').length;
  return (
    <div className="grid gap-8" data-chart-state="ok">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label={c.statAgents} value={num(model.total)} />
        <Stat label={c.statTeams} value={num(teams)} />
        <Stat label={c.statMessages} value={num(model.totalSent)} />
        {model.activeNow !== null ? <Stat label={c.statActive} value={num(model.activeNow)} /> : null}
      </div>

      {model.strip.length ? <Leadership model={model} c={c} now={now} /> : null}

      {eng.length ? (
        <section aria-labelledby="engineering">
          <SectionHead id="engineering" title={c.nav.engineering} body={c.engineeringBody} count={eng.reduce((a, b) => a + b.size, 0)} c={c} />
          <div className={GRID}>
            {eng.map((b, i) => (
              <BoxCard key={i} box={b} c={c} now={now} />
            ))}
          </div>
        </section>
      ) : null}

      {network.length ? (
        <section aria-labelledby="network">
          <SectionHead id="network" title={c.nav.network} count={network.reduce((a, b) => a + b.size, 0)} c={c} />
          <div className={GRID}>
            {network.map((b, i) => (
              <BoxCard key={i} box={b} c={c} now={now} />
            ))}
          </div>
        </section>
      ) : null}

      {other.length ? (
        <section aria-labelledby="departments">
          <SectionHead id="departments" title={c.nav.departments} body={c.departmentsBody} c={c} />
          <div className={GRID}>
            {other.map((b, i) => (
              <BoxCard key={i} box={b} c={c} now={now} />
            ))}
          </div>
        </section>
      ) : null}

      {model.activity.length || model.other ? <Activity model={model} c={c} /> : null}
    </div>
  );
}

/** Shown when there is no chart to show. Never an error code, never a technical reason. */
export function ChartNotice({ c, state }: { c: Copy; state: 'empty' | 'unavailable' }) {
  return (
    <Card className="p-5" data-chart-state={state}>
      <h2 className="m-0 text-xl font-extrabold">{state === 'empty' ? c.emptyTitle : c.unavailableTitle}</h2>
      <p className="m-0 mt-2 text-muted-foreground">{state === 'empty' ? c.emptyBody : c.unavailableBody}</p>
    </Card>
  );
}
