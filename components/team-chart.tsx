import type { Copy } from './copy';
import { departmentTitle, roleTitle } from './public-titles';
import { type ChartBox, type ChartModel, type ChartPerson, type TeamDay } from './snapshot';
import { Avatar, AvatarGroup } from './ui/avatar';
import { Badge } from './ui/badge';
import { Card, CardBody, CardHeader } from './ui/card';
import { Sparkline } from './ui/sparkline';

/**
 * The live team: the leadership card, one card per engineering team, one per other department. Per person: an initial, first name, role and department, who she
 * reports to, and (when the service sends it) the time of her last activity. No identifier of any kind, no
 * per-person colour, no customer: a team is titled by its PUBLIC title from the service, or by its lead.
 */

const norm = (s: string) => s.trim().toLowerCase();
const isNetwork = (b: ChartBox) => b.kind === 'department' && norm(b.department) === 'network';

/** Plain public titles (see public-titles.ts): the served names stay as they are. */
export function names(c: Copy) {
  return {
    role: (served: string) => roleTitle(served, c.lang),
    department: (served: string) => departmentTitle(served, c.lang),
  };
}

/** The count after a title: "· 4" in English; "(۴)" in Persian, where a middle dot beside a Persian digit can read as
 * a zero (۰ is a dot), so "· ۴" could be read as ۴۰. */
const countSuffix = (n: number, c: Copy) => (c.lang === 'fa' ? ` (${n.toLocaleString(c.locale)})` : ` · ${n.toLocaleString(c.locale)}`);

function relative(iso: string, nowIso: string | null, c: Copy): string {
  const diff = Math.max(0, (nowIso ? Date.parse(nowIso) : Date.now()) - Date.parse(iso));
  const rtf = new Intl.RelativeTimeFormat(c.locale, { numeric: 'auto' });
  const min = Math.round(diff / 60_000);
  if (min < 60) return rtf.format(-min, 'minute');
  const h = Math.round(min / 60);
  if (h < 48) return rtf.format(-h, 'hour');
  return rtf.format(-Math.round(h / 24), 'day');
}

const DAY_MS = 24 * 60 * 60_000;
/** The calendar day of an instant in the page's own time zone, for "today". */
const dayIn = (ms: number, c: Copy) => new Date(ms).toLocaleDateString('en-CA', { timeZone: c.timeZone });

/**
 * The last activity, the same muted line for everyone (a time, never an online state). Minutes only within the
 * last hour; after that a band: "Active today" (the same calendar day in the page's zone), "This week", then
 * "Standby" (older, or no time at all). `quiet` is false when the service sends no times: then nothing shows.
 */
function LastActive({ p, now, c, quiet }: { p: ChartPerson; now: string | null; c: Copy; quiet: boolean }) {
  if (!quiet) return null;
  const at = now ? Date.parse(now) : Date.now();
  let text: string;
  if (!p.lastActiveAt) text = c.story.standby;
  else {
    const t = Date.parse(p.lastActiveAt);
    const ago = at - t;
    if (ago < 60 * 60_000) text = c.lastActive(relative(p.lastActiveAt, now, c));
    else if (dayIn(t, c) === dayIn(at, c)) text = c.story.activeToday;
    else if (ago < 7 * DAY_MS) text = c.story.thisWeek;
    else text = c.story.standby;
  }
  return (
    <span className="basis-full text-xs text-muted-foreground" data-testid="last-active">
      {text}
    </span>
  );
}

function PersonRow({ p, c, now, strong, quiet }: { p: ChartPerson; c: Copy; now: string | null; strong?: boolean; quiet: boolean }) {
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
        <LastActive p={p} now={now} c={c} quiet={quiet} />
      </span>
    </li>
  );
}

function ActivityFooter({ values, c }: { values: TeamDay[] | null; c: Copy }) {
  if (!values) return null;
  const num = (v: number) => v.toLocaleString(c.locale);
  // A suppressed member-day (null from the service) makes that day, and so the week, a lower bound. A day where
  // every member was suppressed reads "fewer than 3". A true zero is shown as 0.
  const total = num(values.reduce((acc, d) => acc + (d.total ?? 0), 0));
  const shown = values.some((d) => d.partial) ? c.atLeast(total) : total;
  const dayLabel = (d: TeamDay) => (d.total === null ? c.underThree : d.partial ? c.atLeast(num(d.total)) : num(d.total));
  return (
    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border px-4 py-3 lg:px-5" data-testid="team-activity">
      <span className="text-xs text-muted-foreground">
        {c.statMessages}: <span className="font-semibold text-foreground tabular-nums">{shown}</span>
      </span>
      <Sparkline values={values.map((d) => d.total)} label={c.sparkLabel(values.map(dayLabel).join('، '))} />
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

function BoxCard({ box, c, now, quiet }: { box: ChartBox; c: Copy; now: string | null; quiet: boolean }) {
  const n = names(c);
  const title =
    box.kind === 'lead'
      ? box.project
        ? [box.project[c.lang]]
        : [box.lead.firstName, n.role(box.lead.role)]
      : [n.department(box.department)];
  return (
    <Card data-box-kind={box.kind} className="flex flex-col">
      <CardHeader
        title={
          <>
            {title.map((part, i) => (
              <span key={i}>
                {i ? ' · ' : ''}
                <bdi>{part}</bdi>
              </span>
            ))}
            <span>{countSuffix(box.size, c)}</span>
          </>
        }
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
            <PersonRow key={i} p={p} c={c} now={now} quiet={quiet} strong={p.depth === 0 && box.people.length > 1} />
          ))}
        </ul>
      </CardBody>
      <ActivityFooter values={box.activity7d} c={c} />
    </Card>
  );
}

function Leadership({ model, c, now, quiet }: { model: ChartModel; c: Copy; now: string | null; quiet: boolean }) {
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
            <PersonRow key={i} p={p} c={c} now={now} quiet={quiet} strong />
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
          {group(c.story.headsOfDepartment, clevel, 'lead-clevel')}
          {group(c.story.executiveAssistants, office, 'lead-office')}
        </CardBody>
      </Card>
    </section>
  );
}

export function TeamChart({ model, c }: { model: ChartModel; c: Copy }) {
  const now = model.generatedAt;
  const eng = model.boxes.filter((b) => !isNetwork(b) && (b.kind === 'lead' || norm(b.department) === 'engineering'));
  const network = model.boxes.filter(isNetwork);
  const other = model.boxes.filter((b) => !eng.includes(b) && !network.includes(b));
  const n = names(c);
  // Quiet bands only when the service sends last-activity times at all (an older service sends none).
  const quiet = model.activeNow !== null;
  return (
    <div className="grid gap-8" data-chart-state="ok">
      {model.strip.length ? <Leadership model={model} c={c} now={now} quiet={quiet} /> : null}

      {eng.length ? (
        <section aria-labelledby="engineering">
          <SectionHead id="engineering" title={n.department('Engineering')} body={c.engineeringBody} count={eng.reduce((a, b) => a + b.size, 0)} c={c} />
          <div className={GRID}>
            {eng.map((b, i) => (
              <BoxCard key={i} box={b} c={c} now={now} quiet={quiet} />
            ))}
          </div>
        </section>
      ) : null}

      {network.length ? (
        <section aria-labelledby="network">
          <SectionHead id="network" title={n.department('Network')} count={network.reduce((a, b) => a + b.size, 0)} c={c} />
          <div className={GRID}>
            {network.map((b, i) => (
              <BoxCard key={i} box={b} c={c} now={now} quiet={quiet} />
            ))}
          </div>
        </section>
      ) : null}

      {other.length ? (
        <section aria-labelledby="departments">
          <SectionHead id="departments" title={c.nav.departments} body={c.departmentsBody} c={c} />
          <div className={GRID}>
            {other.map((b, i) => (
              <BoxCard key={i} box={b} c={c} now={now} quiet={quiet} />
            ))}
          </div>
        </section>
      ) : null}

    </div>
  );
}

/**
 * The build-time page reloads itself so a visitor who reaches a freshly started server gets the regenerated page
 * (with data) a moment later. At most three tries per tab session; after that it says the chart is coming back.
 */
const PENDING_RELOAD = `try{var k='fleet-wait',n=+(sessionStorage.getItem(k)||0);if(n<3){sessionStorage.setItem(k,String(n+1));setTimeout(function(){location.reload()},2500)}else{sessionStorage.removeItem(k);document.getElementById('wait-loading').hidden=true;document.getElementById('wait-later').hidden=false}}catch(e){}`;

/** Shown when there is no chart to show. Never an error code, never a technical reason. */
export function ChartNotice({ c, state }: { c: Copy; state: 'empty' | 'unavailable' | 'pending' }) {
  if (state === 'pending') {
    return (
      <Card className="p-5" data-chart-state="pending">
        <div id="wait-loading">
          <h2 className="m-0 flex items-center gap-2 text-xl font-extrabold">
            <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden />
            {c.pendingTitle}
          </h2>
          <p className="m-0 mt-2 text-muted-foreground">{c.pendingBody}</p>
        </div>
        <div id="wait-later" hidden>
          <h2 className="m-0 text-xl font-extrabold">{c.unavailableTitle}</h2>
          <p className="m-0 mt-2 text-muted-foreground">{c.unavailableBody}</p>
        </div>
        <script dangerouslySetInnerHTML={{ __html: PENDING_RELOAD }} />
      </Card>
    );
  }
  return (
    <Card className="p-5" data-chart-state={state}>
      <h2 className="m-0 text-xl font-extrabold">{state === 'empty' ? c.emptyTitle : c.unavailableTitle}</h2>
      <p className="m-0 mt-2 text-muted-foreground">{state === 'empty' ? c.emptyBody : c.unavailableBody}</p>
    </Card>
  );
}
