import { cn } from './cn';

/**
 * A small bar chart of a few values (oldest first), drawn left to right in every language because it is a
 * time axis. The label carries the values for screen readers.
 */
export function Sparkline({ values, label, className }: { values: (number | null)[]; label: string; className?: string }) {
  // null = a suppressed day: drawn like an empty day, its value is in the label.
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  return (
    <span role="img" aria-label={label} dir="ltr" className={cn('flex h-8 w-24 shrink-0 items-end gap-[3px]', className)} data-testid="sparkline">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn('min-w-0 flex-1 rounded-[2px]', v ? 'bg-primary' : 'bg-border')}
          style={{ height: `${v ? Math.max(12, Math.round((v / max) * 100)) : 8}%` }}
        />
      ))}
    </span>
  );
}
