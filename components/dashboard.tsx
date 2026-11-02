import type { ReactNode } from 'react';
import type { Copy } from './copy';
import { departmentTitle } from './public-titles';
import type { ChartModel } from './snapshot';
import { Badge } from './ui/badge';
import { Card, CardBody, CardHeader } from './ui/card';
import { HourBars } from './ui/hour-bars';
import { Sparkline } from './ui/sparkline';
import { type BarSeries, StackedBars } from './ui/stacked-bars';
import { UsagePanel } from './usage-panel';

/**
 * The dashboard band of the public page: stat cards with small charts, the usage graphs and the departments table.
 * Privacy: every figure is a value the snapshot already shows, or a sum of shown values. Departments are grouped
 * into four named groups plus "other departments"; the service's own "other" bucket joins that last group.
 */

type GroupKey = 'support' | 'engineering' | 'network' | 'executive' | 'other';
const GROUPS: GroupKey[] = ['support', 'engineering', 'network', 'executive', 'other'];
const COLOR: Record<GroupKey, string> = {
  support: 'var(--dept-support)',
  engineering: 'var(--dept-engineering)',
  network: 'var(--dept-network)',
  executive: 'var(--dept-executive)',
  other: 'var(--dept-other)',
};

function groupOf(department: string | null): GroupKey {
  switch (department?.trim().toLowerCase()) {
    case 'customer support':
      return 'support';
    case 'engineering':
      return 'engineering';
    case 'network':
      return 'network';
    case 'executive':
    case 'executive office':
      return 'executive';
    default:
      return 'other';
  }
}

function groupLabel(key: GroupKey, c: Copy): string {
  const served: Record<Exclude<GroupKey, 'other'>, string> = { support: 'Customer Support', engineering: 'Engineering', network: 'Network', executive: 'Executive' };
  return key === 'other' ? c.dash.otherDepartments : departmentTitle(served[key], c.lang);
}

/** Messages SENT per day, per group: what the chart stacks. Groups with nothing to show are left out. */
export function messageSeries(model: ChartModel, c: Copy): BarSeries[] {
  const rows = [...model.activity, ...(model.other ? [model.other] : [])];
  return GROUPS.map((key) => ({
    key,
    label: groupLabel(key, c),
    color: COLOR[key],
    values: model.days.map((_, i) => rows.filter((r) => groupOf(r.department) === key).reduce((acc, r) => acc + r.dailySent[i], 0)),
  })).filter((s) => s.values.some((v) => v > 0));
}

/** Head count per group, from the served agents. */
function mix(model: ChartModel, c: Copy) {
  return GROUPS.map((key) => ({
    key,
    label: groupLabel(key, c),
    color: COLOR[key],
    count: model.headcount.filter((d) => groupOf(d.department) === key).reduce((acc, d) => acc + d.count, 0),
  })).filter((g) => g.count > 0);
}

function MixBar({ parts, label }: { parts: { key: string; color: string; count: number }[]; label: string }) {
  const total = parts.reduce((a, p) => a + p.count, 0) || 1;
  return (
    <span role="img" aria-label={label} className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" data-testid="mix-bar">
      {parts.map((p) => (
        <span key={p.key} className="block h-full" style={{ width: `${(p.count / total) * 100}%`, background: p.color }} />
      ))}
    </span>
  );
}

function StatCard({ label, value, hint, children, testid, className }: { label: string; value: string; hint?: string; children?: ReactNode; testid: string; className?: string }) {
  return (
    <Card className={`flex min-w-0 flex-col gap-2 p-4 lg:p-5 ${className ?? ''}`} data-testid="stat" data-stat={testid}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-end justify-between gap-3">
        <span className="text-2xl leading-tight font-extrabold tabular-nums lg:text-[2rem]">{value}</span>
        {children}
      </span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </Card>
  );
}

export function StatCards({ model, c }: { model: ChartModel; c: Copy }) {
  const num = (v: number) => v.toLocaleString(c.locale);
  const series = messageSeries(model, c);
  const daily = model.days.map((_, i) => series.reduce((acc, s) => acc + s.values[i], 0));
  const sentShown = daily.reduce((a, b) => a + b, 0);
  const leads = model.boxes.filter((b) => b.kind === 'lead');
  const products = leads.filter((b) => b.kind === 'lead' && b.project !== null).length;
  const groups = mix(model, c);
  const five = (i: number) => (model.activeNow === null ? '' : i < 2 ? 'sm:col-span-3 xl:col-span-1' : 'sm:col-span-2 xl:col-span-1');
  return (
    // Five cards: one row of five on a wide screen; 2 + 3 on a tablet. Four: one row, or 2 + 2.
    <div className={model.activeNow !== null ? 'grid gap-4 sm:grid-cols-6 xl:grid-cols-5' : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'} data-testid="stat-cards">
      <StatCard label={c.statAgents} value={num(model.total)} testid="agents" className={five(0)}>
        <span className="w-24 shrink-0 pb-2">
          <MixBar parts={groups} label={groups.map((g) => `${g.label}: ${num(g.count)}`).join('، ')} />
        </span>
      </StatCard>
      <StatCard label={c.statMessages} value={num(sentShown)} hint={c.dash.statMessagesHint} testid="messages" className={five(1)}>
        <Sparkline values={daily} label={c.sparkLabel(daily.map(num).join('، '))} />
      </StatCard>
      <StatCard label={c.statTeams} value={num(leads.length)} hint={c.dash.statTeamsHint(products ? num(products) : null)} testid="teams" className={five(2)} />
      <StatCard label={c.dash.statDepartments} value={num(model.headcount.length)} testid="departments" className={five(3)} />
      {model.activeNow !== null ? <StatCard label={c.statActive} value={num(model.activeNow)} testid="active" className={five(4)} /> : null}
    </div>
  );
}

export function UsageBand({ model, c }: { model: ChartModel; c: Copy }) {
  const num = (v: number) => v.toLocaleString(c.locale);
  const series = messageSeries(model, c);
  const groups = mix(model, c);
  const total = groups.reduce((a, g) => a + g.count, 0);
  return (
    <section aria-labelledby="usage" className="grid min-w-0 grid-cols-1 gap-4">
      <h2 id="usage" className="m-0 text-xl font-extrabold">
        {c.dash.usageTitle}
      </h2>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        {series.length ? (
          <Card className="xl:col-span-7" data-testid="messages-chart">
            <CardHeader title={c.dash.messagesTitle} />
            <CardBody className="grid gap-3 py-4">
              <p className="m-0 text-sm text-muted-foreground">{c.dash.messagesBody}</p>
              <StackedBars labels={model.days.map(c.dash.dayLabel)} series={series} caption={c.dash.messagesTitle} seriesHeader={c.dash.department} format={num} />
            </CardBody>
          </Card>
        ) : null}
        <div className="min-w-0 xl:col-span-5">
          <DepartmentTable model={model} c={c} />
        </div>
        {model.activeByHour ? (
            <Card className="xl:col-span-4" data-testid="hours-chart">
              <CardHeader title={c.dash.hoursTitle} />
              <CardBody className="grid gap-3 py-4">
                <p className="m-0 text-xs text-muted-foreground">{c.dash.hoursBody}</p>
                <HourBars values={model.activeByHour} label={c.dash.hoursLabel} format={num} suppressed={c.underThree} />
              </CardBody>
            </Card>
          ) : null}
        <div className="xl:col-span-5">
          <UsagePanel usage={model.usage} now={model.generatedAt} c={c} />
        </div>
          <Card className="xl:col-span-3" data-testid="team-mix">
            <CardHeader title={c.dash.mixTitle} aside={<Badge>{num(total)}</Badge>} />
            <CardBody className="grid gap-3 py-4">
              <MixBar parts={groups} label={groups.map((g) => `${g.label}: ${num(g.count)}`).join('، ')} />
              <ul className="m-0 grid list-none gap-1.5 p-0 text-sm">
                {groups.map((g) => (
                  <li key={g.key} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: g.color }} aria-hidden />
                      <span className="truncate">{g.label}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{num(g.count)}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
      </div>
    </section>
  );
}

/** One row per department the activity data names, the grouped "other" last, and a total of the shown values. */
export function DepartmentTable({ model, c }: { model: ChartModel; c: Copy }) {
  if (!model.activity.length && !model.other) return null;
  const num = (v: number) => v.toLocaleString(c.locale);
  const heads = new Map(model.headcount.map((d) => [d.department, d.count]));
  const rows = [
    ...model.activity.map((d) => ({ key: d.department ?? '', name: d.department ? departmentTitle(d.department, c.lang) : c.other, agents: d.department ? (heads.get(d.department) ?? null) : null, d, color: COLOR[groupOf(d.department)] })),
    ...(model.other ? [{ key: 'other', name: c.other, agents: null, d: model.other, color: COLOR.other }] : []),
  ];
  const th = 'px-3 py-2 text-start text-xs font-semibold text-muted-foreground whitespace-nowrap';
  const td = 'px-3 py-1.5 tabular-nums whitespace-nowrap';
  return (
    <section aria-labelledby="activity" className="min-w-0 rounded-card border border-border bg-card">
      <header className="border-b border-border px-4 py-3 lg:px-5">
        <h3 id="activity" className="m-0 text-base font-extrabold">
          {c.activityTitle}
        </h3>
        <p className="m-0 mt-1 text-xs text-muted-foreground">{c.activityBody}</p>
      </header>
      <div className="overflow-x-auto" data-testid="department-table">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead className="border-b border-border bg-muted">
            <tr>
              <th scope="col" className={th}>
                {c.dash.department}
              </th>
              <th scope="col" className={th}>
                {c.dash.colAgents}
              </th>
              <th scope="col" className={th}>
                {c.sent}
              </th>
              <th scope="col" className={th}>
                {c.received}
              </th>
              <th scope="col" className={th}>
                {c.dash.colTrend}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.key} data-testid="department-row">
                <th scope="row" className="px-3 py-1.5 text-start font-semibold">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} aria-hidden />
                    <span className="whitespace-nowrap">{r.name}</span>
                  </span>
                </th>
                <td className={td}>{r.agents === null ? '' : num(r.agents)}</td>
                <td className={td}>{num(r.d.sent)}</td>
                <td className={td}>{num(r.d.received)}</td>
                <td className="px-3 py-1">
                  <Sparkline values={r.d.daily} label={c.sparkLabel(r.d.daily.map(num).join('، '))} className="h-6 w-20" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border font-extrabold">
            <tr>
              <th scope="row" className="px-3 py-2.5 text-start">
                {c.dash.totalRow}
              </th>
              <td className={td} />
              <td className={td}>{num(model.totalSent)}</td>
              <td className={td}>{num(model.totalReceived)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
