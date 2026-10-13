import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/** A surface: card background, border and radius from the tokens. */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('min-w-0 rounded-card border border-border bg-card text-card-foreground', className)} {...props} />;
}

/** A card's header row: a title, and optionally something on the far side (a count, a badge). */
export function CardHeader({ title, aside, className, titleProps }: { title: ReactNode; aside?: ReactNode; className?: string; titleProps?: HTMLAttributes<HTMLHeadingElement> & Record<string, string> }) {
  return (
    <header className={cn('flex min-w-0 items-start justify-between gap-3 border-b border-border px-4 py-3 lg:px-5', className)}>
      <h3 className="m-0 min-w-0 text-base leading-snug font-extrabold [overflow-wrap:anywhere]" {...titleProps}>
        {title}
      </h3>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0 px-4 py-3 lg:px-5', className)} {...props} />;
}
