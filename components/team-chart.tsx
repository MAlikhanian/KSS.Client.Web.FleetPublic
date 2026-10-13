import type { ReactNode } from 'react';
import { photoFor } from './avatars';
import { photoIfPublished, roomLabel } from './partners';
import type { Copy } from './copy';
import { departmentTitle, roleTitle } from './public-titles';
import { type ChartBox, type ChartModel, type ChartPerson, type TeamDay } from './snapshot';
import { Avatar } from './ui/avatar';
import { Badge } from './ui/badge';
import { Card, CardBody, CardHeader } from './ui/card';
import { cn } from './ui/cn';
import { Sparkline } from './ui/sparkline';

/**
 * The live team as one organisation chart, top to bottom: the human management (static page rows), the chief
 * executive, the heads of department and the executive office, then each head's branch with its departments and
 * teams. Lines show who reports to whom. Per agent: avatar, first name, role, (when the service sends it) the time of
 * her last activity, and a support agent's rooms. No identifier of any kind, no per-person colour, no customer: a team
 * is titled by its PUBLIC title from the service, or by its lead.
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
 * The last activity as one short muted phrase (a time, never an online state). Minutes only within the last hour;
 * after that a band: "Active today" (the same calendar day in the page's zone), "This week", then "Standby" (older,
 * or no time at all). Null when the service sends no times at all (`quiet` false).
 */
function lastActive(p: ChartPerson, now: string | null, c: Copy, quiet: boolean): string | null {
  if (!quiet) return null;
  const at = now ? Date.parse(now) : Date.now();
  if (!p.lastActiveAt) return c.story.standby;
  const t = Date.parse(p.lastActiveAt);
  const ago = at - t;
  if (ago < 60 * 60_000) return c.lastActive(relative(p.lastActiveAt, now, c));
  if (dayIn(t, c) === dayIn(at, c)) return c.story.activeToday;
  if (ago < 7 * DAY_MS) return c.story.thisWeek;
  return c.story.standby;
}

/** A repeated room label is shown once with its count ("Private client ×2"), in the order first served. */
function Rooms({ rooms, c }: { rooms: string[] | null; c: Copy }) {
  if (!rooms || rooms.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of rooms) counts.set(r, (counts.get(r) ?? 0) + 1);
  return (
    <ul aria-label={c.roomsLabel} className="rooms" data-testid="rooms">
      {[...counts].map(([label, n]) => {
        const known = roomLabel(label);
        const shown = known ? known.name[c.lang] : label;
        const text = <bdi>{n > 1 ? c.roomTimes(shown, n) : shown}</bdi>;
        return known?.kind === 'person' ? (
          <li key={label} className="room partner" data-testid="room-partner">
            <PersonFace photo={known.photoSlug} size="xs" />
            {text}
          </li>
        ) : (
          <li key={label} className="room" data-testid="room">
            {text}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One person: avatar, name and role on one line, the last activity at the end. `stacked` (wide department cards):
 * name and role, then rooms and the last activity on a second short line. Styled by the `pl` classes (globals.css).
 */
function PersonLine({ p, c, now, quiet, lead, stacked }: { p: ChartPerson; c: Copy; now: string | null; quiet: boolean; lead?: boolean; stacked?: boolean }) {
  const n = names(c);
  const when = lastActive(p, now, c, quiet);
  const name = <bdi>{p.firstName}</bdi>;
  const role = <span className="line-role">{n.role(p.role)}</span>;
  const time = when ? (
    <span className="la">
      {when}
    </span>
  ) : null;
  return (
    <li className={cn('pl', stacked && 'pl-s', lead && 'lead')}>
      <Avatar photo={photoFor(p.firstName)} label={c.avatarLabel(p.firstName)} size="sm" />
      {stacked ? (
        <span className="pl-t">
          <span>
            {name}
            {role}
          </span>
          <span>
            <Rooms rooms={p.rooms} c={c} />
            {time}
          </span>
        </span>
      ) : (
        <>
          <span className="pl-t">
            {name}
            {role}
            <Rooms rooms={p.rooms} c={c} />
          </span>
          {time}
        </>
      )}
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
    <span className="flex items-center gap-2" title={c.statMessages} data-testid="team-activity">
      <span className="text-xs text-muted-foreground">
        <span className="sr-only">{c.statMessages}: </span>
        <span className="font-semibold text-foreground tabular-nums">{shown}</span>
      </span>
      <Sparkline values={values.map((d) => d.total)} label={c.sparkLabel(values.map(dayLabel).join('، '))} className="h-5 w-14" />
    </span>
  );
}

function SectionHead({ id, title, body, count, c }: { id: string; title: string; body?: string; count?: number; c: Copy }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 id={id} className="m-0 text-xl font-extrabold">
        {title}
      </h2>
      {count !== undefined ? <Badge>{count.toLocaleString(c.locale)}</Badge> : null}
      {body ? <p className="m-0 basis-full text-sm text-muted-foreground">{body}</p> : null}
    </div>
  );
}

/** A team or department card: the lead first (when there is one), then the members, one line each. */
function BoxCard({ box, c, now, quiet, className, wide, col = '14rem' }: { box: ChartBox; c: Copy; now: string | null; quiet: boolean; className?: string; wide?: boolean; col?: string }) {
  const n = names(c);
  const title =
    box.kind === 'lead'
      ? box.project
        ? [box.project[c.lang]]
        : [box.lead.firstName, n.role(box.lead.role)]
      : [n.department(box.department)];
  const lead = box.kind === 'lead' ? box.people[0] : null;
  const members = lead ? box.people.slice(1) : box.people;
  // A wide card (a full last row, a big department) lays its members out in columns.
  const list = wide ? 'grid gap-x-6' : 'grid';
  return (
    <Card data-box-kind={box.kind} className={cn('flex flex-col', className)}>
      <CardHeader
        className="tight"
        title={
          <>
            {title.map((part, i) => (
              <span key={i}>
                {i ? ' · ' : ''}
                <bdi>{part}</bdi>
              </span>
            ))}
            <span className="font-semibold text-muted-foreground">{countSuffix(box.size, c)}</span>
          </>
        }
        titleProps={{ 'data-box-title': box.kind }}
        aside={<ActivityFooter values={box.activity7d} c={c} />}
      />
      {lead ? (
        <ul className="lead-row" data-testid="team-lead">
          <PersonLine p={lead} c={c} now={now} quiet={quiet} lead />
        </ul>
      ) : null}
      <CardBody className="py-1">
        <ul className={cn('people', list)} style={wide ? { gridTemplateColumns: `repeat(auto-fill,minmax(min(100%,${col}),1fr))` } : undefined}>
          {members.map((p, i) => (
            <PersonLine key={i} p={p} c={c} now={now} quiet={quiet} stacked={wide && box.kind === 'department'} />
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

/** A person as a chart node: avatar, name, role and last activity, centred. */
function Node({ p, c, now, quiet, accent, className, children, pair }: { p: ChartPerson; c: Copy; now: string | null; quiet: boolean; accent: string; className?: string; children?: ReactNode; pair?: string | null }) {
  const n = names(c);
  const when = lastActive(p, now, c, quiet);
  return (
    <Card className={cn('flex flex-col items-center gap-1 border-t-4 px-4 py-3 text-center', className)} style={{ borderTopColor: accent }} data-testid="org-node">
      <Avatar photo={photoFor(p.firstName)} label={c.avatarLabel(p.firstName)} />
      <bdi className="line-name text-base font-extrabold">{p.firstName}</bdi>
      <span className="line-role text-sm leading-snug text-muted-foreground">{n.role(p.role)}</span>
      {when ? (
        <span className="la">
          {when}
        </span>
      ) : null}
      {pair ? <PairChip text={pair} /> : null}
      {children}
    </Card>
  );
}

/**
 * The human management at the top of the chart: people, not agents. Static rows of the page (never from the
 * snapshot): a photo when one is published, otherwise a plain person icon unlike the agents' silhouette; no AI badge,
 * no activity, no rooms. The human CTO and CNO are each paired with an AI head of department (a dotted line).
 */
type Human = { name: string; role: string; photo?: string; pair?: 'cto' | 'cno' };
const HUMANS: Record<'fa' | 'en', { top: Human[]; second: Human[]; paired: string; sep: string }> = {
  fa: {
    sep: '، ',
    top: [
      { name: 'محمد', role: 'بنیان‌گذار' },
      { name: 'محمود دانش', role: 'رئیس هیئت‌مدیره', photo: 'partner-mahmoud' },
    ],
    second: [
      { name: 'امیر مرتضوی', role: 'مدیر ارشد فناوری', photo: 'partner-amir', pair: 'cto' },
      { name: 'بابک غیاثی', role: 'مدیر ارشد شبکه', photo: 'partner-babak', pair: 'cno' },
    ],
    paired: 'همراه با',
  },
  en: {
    sep: ', ',
    top: [
      { name: 'Mohammad', role: 'Founder' },
      { name: 'Mahmoud Danesh', role: 'Chairman', photo: 'partner-mahmoud' },
    ],
    second: [
      { name: 'Amir Mortazavi', role: 'CTO', photo: 'partner-amir', pair: 'cto' },
      { name: 'Babak Ghiasi', role: 'CNO', photo: 'partner-babak', pair: 'cno' },
    ],
    paired: 'Paired with',
  },
};

/** A person's face: the photo when published, otherwise a plain person icon. Never an AI badge. */
function PersonFace({ photo, size }: { photo: string | null; size: 'xs' | 'md' }) {
  const box = size === 'xs' ? 'size-[18px]' : 'size-9';
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- our own static files
    <img
      src={`/avatars/${photo}.webp`}
      srcSet={size === 'md' ? `/avatars/${photo}.webp 1x, /avatars/${photo}@2x.webp 2x` : undefined}
      alt=""
      width={size === 'xs' ? 18 : 36}
      height={size === 'xs' ? 18 : 36}
      loading="lazy"
      decoding="async"
      className={cn(box, 'shrink-0 rounded-full object-cover')}
      data-testid="person-photo"
    />
  ) : (
    <span aria-hidden className={cn(box, 'grid shrink-0 place-items-center rounded-full border border-foreground/60 bg-card text-foreground')} data-testid="person-icon">
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
      </svg>
    </span>
  );
}

/** "Paired with <name>": the pairing in words, on both boxes, at every width (the dotted line is decoration). */
function PairChip({ text }: { text: string }) {
  return (
    <span className="mt-1 inline-flex rounded-full border border-dashed border-foreground/40 px-2 text-xs leading-5 text-muted-foreground" data-testid="pair-chip">
      <bdi>{text}</bdi>
    </span>
  );
}

function HumanNode({ h, pairName, paired, sep, className }: { h: Human; pairName?: string | null; paired: string; sep: string; className?: string }) {
  return (
    <Card className={cn('flex flex-col items-center gap-0.5 border-2 border-foreground/70 px-4 py-3 text-center', className)} data-testid="human-node">
      <span role="img" aria-label={`${h.name}${sep}${h.role}`}>
        <PersonFace photo={photoIfPublished(h.photo)} size="md" />
      </span>
      <bdi className="text-base font-extrabold">{h.name}</bdi>
      <span className="text-sm text-muted-foreground">{h.role}</span>
      {pairName ? <PairChip text={`${paired} ${pairName}`} /> : null}
    </Card>
  );
}

/** A card's span in the 12-column grid on a wide screen: 3 (four per row), or a short last row's share of the width. */
const FILL_XL: Record<number, string> = { 3: 'xl:col-span-3', 4: 'xl:col-span-4', 6: 'xl:col-span-6', 12: 'xl:col-span-12' };

/**
 * Cards in a 12-column grid, 4 per row on a wide screen, 2 on a tablet, 1 on a phone. A short last row is
 * stretched to the full width, so no row is ragged. Only the first row hangs from the bus line.
 */
function TeamGrid({ boxes, c, now, quiet }: { boxes: ChartBox[]; c: Copy; now: string | null; quiet: boolean }) {
  const count = boxes.length;
  const restXl = count % 4;
  const restMd = count % 2;
  return (
    <div className="org-bus grid grid-cols-12 gap-x-4 gap-y-4 [--n:1] md:[--n:2] xl:[--n:4]">
      {boxes.map((b, i) => {
        const lastXl = restXl && i >= count - restXl;
        const lastMd = restMd && i === count - 1;
        const spanXl = lastXl ? 12 / restXl : 3;
        return (
          <BoxCard
            key={i}
            box={b}
            c={c}
            now={now}
            quiet={quiet}
            wide={spanXl > 6}
            col="20rem"
            className={cn('col-span-12', lastMd ? 'md:col-span-12' : 'md:col-span-6', FILL_XL[spanXl], i < 1 && 'org-tick', i < 2 && 'md:org-tick', i < 4 && 'xl:org-tick')}
          />
        );
      })}
    </div>
  );
}

/** A branch's heading on the start side and its root node in the middle, on one line from xl up. */
function BranchHead({ root, children }: { root: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-end gap-x-4 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="min-w-0 [&>div]:mb-0">{children}</div>
      {root ? <div className="mt-3 xl:mt-0">{root}</div> : null}
    </div>
  );
}

/** A C-level at the root of her branch: a small node the branch's line hangs from. */
function BranchRoot({ p, c, accent }: { p: ChartPerson; c: Copy; accent: string }) {
  const n = names(c);
  return (
    <div className="flex justify-center">
      <span className="inline-flex items-center gap-2.5 rounded-full border border-border border-s-4 bg-card py-1.5 ps-2 pe-4" style={{ borderInlineStartColor: accent }} data-testid="branch-root">
        <Avatar photo={photoFor(p.firstName)} label={c.avatarLabel(p.firstName)} size="sm" />
        <bdi className="text-sm font-extrabold">{p.firstName}</bdi>
        <span className="text-sm text-muted-foreground">{n.role(p.role)}</span>
      </span>
    </div>
  );
}

const ACCENT = { executive: 'var(--dept-executive)', engineering: 'var(--dept-engineering)', network: 'var(--dept-network)', support: 'var(--dept-support)', other: 'var(--dept-other)' };

/**
 * The live team as one organisation chart, top to bottom: the chief executive, with the executive office beside her;
 * the heads of department under her; then each head's branch, with its departments and teams.
 */
export function TeamChart({ model, c }: { model: ChartModel; c: Copy }) {
  const now = model.generatedAt;
  const n = names(c);
  const quiet = model.activeNow !== null;
  const eng = model.boxes.filter((b) => !isNetwork(b) && (b.kind === 'lead' || norm(b.department) === 'engineering'));
  const network = model.boxes.filter(isNetwork);
  const other = model.boxes.filter((b) => !eng.includes(b) && !network.includes(b));
  const support = other.filter((b) => b.kind === 'department' && norm(b.department) === 'customer support');
  const offices = other.filter((b) => !support.includes(b));
  const role = (r: string) => model.strip.find((p) => norm(p.role) === r) ?? null;
  const ceo = role('ceo');
  const coo = role('coo');
  const cto = role('cto');
  const cno = role('cno');
  const office = model.strip.filter((p) => ![ceo, coo, cto, cno].includes(p));
  const heads = [coo && { p: coo, accent: ACCENT.support }, cto && { p: cto, accent: ACCENT.engineering }, cno && { p: cno, accent: ACCENT.network }].filter(Boolean) as { p: ChartPerson; accent: string }[];
  const sum = (bs: ChartBox[]) => bs.reduce((a, b) => a + b.size, 0);
  const H = HUMANS[c.lang];
  const pairText = (k: 'cto' | 'cno') => {
    const h = H.second.find((x) => x.pair === k);
    return h ? `${H.paired} ${h.name}` : null;
  };

  return (
    <div className="grid gap-8" data-chart-state="ok">
      {model.strip.length ? (
        <section aria-labelledby="leadership" data-testid="team-strip">
          <h2 id="leadership" className="sr-only">{c.leadership}</h2>
          <div className="grid xl:grid-cols-4 xl:gap-x-4">
            <div className="org-join grid gap-4 [--n:1] sm:grid-cols-2 sm:[--n:2] xl:col-span-2 xl:col-start-2 xl:row-start-1" data-testid="org-humans">
              {H.top.map((h, i) => (
                <HumanNode key={i} h={h} paired={H.paired} sep={H.sep} className="sm:org-tick-down" />
              ))}
            </div>
            <span className="org-stem xl:col-span-4 xl:row-start-2" aria-hidden />
            <div className="org-bus relative grid gap-4 [--n:1] sm:grid-cols-2 sm:[--n:2] xl:col-span-2 xl:col-start-2 xl:row-start-3" data-testid="org-humans-second">
              <span className="absolute inset-y-0 start-1/2 -ms-px hidden w-0.5 bg-[var(--org-line)] sm:block" aria-hidden />
              {H.second.map((h, i) => (
                <HumanNode key={i} h={h} paired={H.paired} sep={H.sep} pairName={h.pair === 'cto' ? cto?.firstName : h.pair === 'cno' ? cno?.firstName : null} className={cn(i < 1 && 'org-tick', 'sm:org-tick')} />
              ))}
            </div>
            {ceo ? (
              <div className="grid xl:col-span-4 xl:col-start-1 xl:row-start-4">
                <span className="org-stem" aria-hidden />
                <Node p={ceo} c={c} now={now} quiet={quiet} accent={ACCENT.executive} className="mx-auto w-full max-w-[17rem]" />
                <span className="org-stem" aria-hidden />
              </div>
            ) : null}
            {/* The human-AI pairing, drawn from xl up: a dotted line from each human head down to her AI counterpart. */}
            <span className="relative hidden xl:col-start-2 xl:row-start-4 xl:block" aria-hidden>
              <span className="absolute start-[22%] top-0 -bottom-6 border-s-2 border-dashed border-foreground/45" />
            </span>
            <span className="relative hidden xl:col-start-3 xl:row-start-4 xl:block" aria-hidden>
              <span className="absolute end-[22%] top-0 -bottom-6 border-s-2 border-dashed border-foreground/45" />
            </span>
            {heads.length || office.length ? (
              <div className="xl:col-span-4 xl:row-start-5">
                <h3 className="sr-only">{c.story.headsOfDepartment}</h3>
                <div className="org-bus grid gap-4 [--n:1] sm:grid-cols-2 sm:[--n:2] xl:grid-cols-4 xl:[--n:4]" data-testid="lead-clevel">
                  {heads.map((h, i) => (
                    <Node
                      key={i}
                      p={h.p}
                      c={c}
                      now={now}
                      quiet={quiet}
                      accent={h.accent}
                      pair={h.p === cto ? pairText('cto') : h.p === cno ? pairText('cno') : null}
                      className={cn(i < 1 && 'org-tick', i < 2 && 'sm:org-tick', 'xl:org-tick')}
                    />
                  ))}
                  {office.length ? (
                    <Card className="xl:org-tick flex flex-col border-t-4 px-4 py-3" style={{ borderTopColor: ACCENT.executive }} data-testid="lead-office">
                      <h4 className="m-0 mb-1 text-center text-base font-extrabold">{c.story.executiveAssistants}</h4>
                      <ul className="m-0 grid list-none p-0">
                        {office.map((p, i) => (
                          <PersonLine key={i} p={p} c={c} now={now} quiet={quiet} />
                        ))}
                      </ul>
                    </Card>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {support.length || offices.length ? (
        <section aria-labelledby="departments">
          <BranchHead root={coo && <BranchRoot p={coo} c={c} accent={ACCENT.support} />}>
            <SectionHead id="departments" title={c.nav.departments} body={c.departmentsBody} count={sum(other)} c={c} />
          </BranchHead>
          <span className="org-stem" aria-hidden />
          <div className="org-bus grid grid-cols-1 gap-4 [--n:1] xl:grid-cols-4 xl:[--bs:calc(37.5%_-_0.125rem)] xl:[--be:calc(12.5%_-_0.375rem)]">
            {support.map((b, i) => (
              <BoxCard key={i} box={b} c={c} now={now} quiet={quiet} wide col="19rem" className="org-tick xl:col-span-3" />
            ))}
            {offices.length ? (
              <div className={cn('grid content-start gap-4 md:grid-cols-3 xl:grid-cols-1', support.length ? 'xl:org-tick' : 'org-tick')}>
                {offices.map((b, i) => (
                  <BoxCard key={i} box={b} c={c} now={now} quiet={quiet} />
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {eng.length ? (
        <section aria-labelledby="engineering">
          <BranchHead root={cto && <BranchRoot p={cto} c={c} accent={ACCENT.engineering} />}>
            <SectionHead id="engineering" title={n.department('Engineering')} body={c.engineeringBody} count={sum(eng)} c={c} />
          </BranchHead>
          <span className="org-stem" aria-hidden />
          <TeamGrid boxes={eng} c={c} now={now} quiet={quiet} />
        </section>
      ) : null}

      {network.length ? (
        <section aria-labelledby="network">
          <BranchHead root={cno && <BranchRoot p={cno} c={c} accent={ACCENT.network} />}>
            <SectionHead id="network" title={n.department('Network')} count={sum(network)} c={c} />
          </BranchHead>
          <span className="org-stem" aria-hidden />
          <div className="org-bus grid gap-4">
            {network.map((b, i) => (
              <BoxCard key={i} box={b} c={c} now={now} quiet={quiet} wide col="17rem" className="org-tick" />
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
