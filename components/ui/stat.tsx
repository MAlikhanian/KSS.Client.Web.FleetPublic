import type { ReactNode } from 'react';
import { cn } from './cn';

/** A headline number with its label, as a row of tiles at the top of a dashboard. */
export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-card border border-border bg-card px-4 py-3 lg:px-5', className)} data-testid="stat">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl leading-tight font-extrabold tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
