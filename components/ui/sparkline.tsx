import { cn } from './cn';

/**
 * A small bar chart of a few values (oldest first), drawn left to right in every language because it is a
 * time axis. The label carries the values for screen readers. Drawn by the `spark` class (globals.css): one short
 * element per bar, its height inline.
 */
export function Sparkline({ values, label, className }: { values: (number | null)[]; label: string; className?: string }) {
  // null = a suppressed day: drawn like an empty day, its value is in the label.
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  return (
    <span role="img" aria-label={label} dir="ltr" className={cn('spark', className)}>
      {values.map((v, i) => (
        <i key={i} {...(v ? {} : { className: 'z' })} style={{ height: `${v ? Math.max(12, Math.round((v / max) * 100)) : 8}%` }} />
      ))}
    </span>
  );
}
