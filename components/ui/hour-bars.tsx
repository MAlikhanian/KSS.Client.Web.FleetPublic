import { cn } from './cn';

/**
 * Twenty-four hourly bars (00 to 23), left to right in every language (a time axis). A suppressed hour (null, or 0)
 * is drawn as a short neutral bar and read as `suppressed` in the label: never as "none". The label carries every
 * value for screen readers.
 */
export function HourBars({
  values,
  label,
  format,
  suppressed,
  className,
}: {
  values: (number | null)[];
  label: (values: string) => string;
  format: (v: number) => string;
  suppressed: string;
  className?: string;
}) {
  const shown = (v: number | null) => (v === null || v === 0 ? null : v);
  const max = Math.max(1, ...values.map((v) => shown(v) ?? 0));
  const hour = (h: number) => String(h).padStart(2, '0');
  const spoken = values.map((v, h) => `${hour(h)}: ${shown(v) === null ? suppressed : format(v as number)}`).join('، ');
  return (
    <div className={cn('grid min-w-0 gap-1.5', className)} data-testid="hour-bars">
      <div role="img" aria-label={label(spoken)} dir="ltr" className="grid h-36 grid-cols-24 items-end gap-[2px] border-b border-border sm:gap-1">
        {values.map((v, h) => {
          const s = shown(v);
          return (
            <span
              key={h}
              className={cn('block min-w-0 rounded-t-[2px]', s === null ? 'bg-border' : 'bg-primary')}
              style={{ height: s === null ? '6%' : `${Math.max(8, (s / max) * 100)}%` }}
              data-hour={h}
              data-suppressed={s === null ? '' : undefined}
            />
          );
        })}
      </div>
      <div aria-hidden dir="ltr" className="grid grid-cols-8 text-xs text-muted-foreground">
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
          <span key={h} className="min-w-0">
            {hour(h)}
          </span>
        ))}
      </div>
    </div>
  );
}
