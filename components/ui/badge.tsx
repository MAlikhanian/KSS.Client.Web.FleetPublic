import type { ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
};

/** A small status or count label. The tone carries meaning (state), never identity. */
export function Badge({ tone = 'neutral', dot, className, children }: { tone?: BadgeTone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap', TONES[tone], className)}>
      {dot ? <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden /> : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
