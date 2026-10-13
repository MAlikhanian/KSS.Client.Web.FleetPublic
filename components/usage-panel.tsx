import type { Copy } from './copy';
import type { Usage, UsageAccount } from './snapshot';
import { Badge } from './ui/badge';
import { Card, CardBody, CardHeader } from './ui/card';
import { cn } from './ui/cn';

/**
 * AI account usage "as last read": one row per published account, a weekly and a five-hour bar, each with its number
 * and reset time in the page's zone. Staleness is measured against the snapshot's own time: after 30 minutes the
 * reading is marked as possibly out of date; after 6 hours (or with no reading) the panel shows no numbers at all.
 * Colour is never the only signal: every bar prints its percentage, and a high one also says so in words.
 */

export const STALE_WARN_MS = 30 * 60_000;
export const STALE_HIDE_MS = 6 * 60 * 60_000;

type Band = 'normal' | 'warning' | 'high';
const band = (pct: number): Band => (pct > 85 ? 'high' : pct >= 70 ? 'warning' : 'normal');
const FILL: Record<Band, string> = { normal: 'bg-primary', warning: 'bg-warning', high: 'bg-danger' };

function time(iso: string, c: Copy, withDay: boolean): string {
  return new Date(iso).toLocaleString(c.locale, {
    timeZone: c.timeZone,
    ...(withDay ? { weekday: 'short' as const, day: 'numeric' as const } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

function Meter({ label, pct, resetsAt, c, testid }: { label: string; pct: number | null; resetsAt: string | null; c: Copy; testid: string }) {
  const num = (v: number) => `${v.toLocaleString(c.locale)}${c.lang === 'fa' ? '٪' : '%'}`;
  const b = pct === null ? null : band(pct);
  return (
    <div className="grid gap-1" data-testid={testid} data-band={b ?? 'unknown'}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="flex items-baseline gap-1.5">
          {b === 'high' ? <span className="font-semibold text-danger">{c.dash.usageHigh}</span> : null}
          <span className="font-extrabold tabular-nums">{pct === null ? c.dash.usageUnknown : num(pct)}</span>
        </span>
      </div>
      <span className="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        {pct !== null ? <span className={cn('block h-full rounded-full', FILL[b as Band])} style={{ width: `${Math.max(pct, 2)}%` }} /> : null}
      </span>
      {resetsAt ? <span className="text-xs text-muted-foreground">{c.dash.usageResets(time(resetsAt, c, true))}</span> : null}
    </div>
  );
}

function AccountRow({ a, c }: { a: UsageAccount; c: Copy }) {
  return (
    <li className="grid gap-2.5 py-3 first:pt-0 last:pb-0" data-testid="usage-account">
      <span className="text-sm font-extrabold">{c.dash.accountLabel(a.label)}</span>
      <Meter label={c.dash.usageWeekly} pct={a.weeklyPct} resetsAt={a.weeklyResetsAt} c={c} testid="usage-weekly" />
      <Meter label={c.dash.usageFiveHour} pct={a.fiveHourPct} resetsAt={a.fiveHourResetsAt} c={c} testid="usage-five-hour" />
    </li>
  );
}

export function UsagePanel({ usage, now, c }: { usage: Usage | null; now: string | null; c: Copy }) {
  const at = now ? Date.parse(now) : Date.now();
  const age = usage ? Math.max(0, at - Date.parse(usage.asOf)) : Infinity;
  const fresh = usage !== null && age <= STALE_HIDE_MS;
  return (
    <Card data-testid="accounts" data-usage={fresh ? (age > STALE_WARN_MS ? 'stale' : 'fresh') : 'none'}>
      <CardHeader title={c.dash.accountsTitle} />
      <CardBody className="grid gap-3 py-4">
        {fresh && usage ? (
          <>
            <ul className="m-0 grid list-none divide-y divide-border p-0">
              {usage.accounts.map((a, i) => (
                <AccountRow key={i} a={a} c={c} />
              ))}
            </ul>
            <p className={cn('m-0 text-xs', age > STALE_WARN_MS ? 'font-semibold text-warning' : 'text-muted-foreground')} data-testid="usage-asof">
              <time dateTime={usage.asOf}>{c.dash.usageAsOf(time(usage.asOf, c, false), new Intl.RelativeTimeFormat(c.locale, { numeric: 'auto' }).format(-Math.round(age / 60_000), 'minute'))}</time>
              {age > STALE_WARN_MS ? ` · ${c.dash.usageStale}` : null}
            </p>
          </>
        ) : (
          <>
            <span>
              <Badge>{c.dash.accountsNone}</Badge>
            </span>
            <p className="m-0 text-xs text-muted-foreground">{c.dash.accountsBody}</p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
