import { cn } from './cn';

/** A person's initial in a neutral disc. No per-person colour. */
export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-extrabold text-muted-foreground ring-2 ring-card',
        size === 'sm' ? 'size-6 text-[0.6875rem]' : 'size-8 text-xs',
        className,
      )}
      aria-hidden
    >
      {Array.from(name)[0]}
    </span>
  );
}

/** Overlapping initials with a "+n" overflow, as on a project card. */
export function AvatarGroup({ names, max = 5, moreLabel }: { names: string[]; max?: number; moreLabel: (n: number) => string }) {
  const shown = names.slice(0, max);
  const more = names.length - shown.length;
  return (
    <span className="flex items-center" aria-hidden>
      {shown.map((n, i) => (
        <Avatar key={i} name={n} size="sm" className={i ? '-ms-1.5' : ''} />
      ))}
      {more > 0 ? <span className="-ms-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1 text-[0.6875rem] font-semibold text-muted-foreground ring-2 ring-card" dir="ltr">{moreLabel(more)}</span> : null}
    </span>
  );
}
