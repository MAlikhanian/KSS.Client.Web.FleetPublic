import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/** A surface: card background, border and radius from the tokens (the `card` classes, globals.css). */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('card', className)} {...props} />;
}

/** A card's header row: a title, and optionally something on the far side (a count, a badge). */
export function CardHeader({ title, aside, className, titleProps }: { title: ReactNode; aside?: ReactNode; className?: string; titleProps?: HTMLAttributes<HTMLHeadingElement> & Record<string, string> }) {
  return (
    <header className={cn('card-h', className)}>
      <h3 className="card-t" {...titleProps}>
        {title}
      </h3>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-b', className)} {...props} />;
}
