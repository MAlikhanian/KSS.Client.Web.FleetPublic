import { cn } from './cn';

/**
 * An agent's avatar: her photo when one is published (`photo` is its slug), otherwise one generic silhouette, never
 * an initial. Every avatar carries a small "AI" badge, and the same fact is in its accessible name (`label`), so it
 * is never shown by the picture alone. Photos are our own files, served from this site, lazily loaded at 1x and 2x.
 */
export function Avatar({ photo, label, badge, size = 'md', className }: { photo: string | null; label: string; badge: string; size?: 'sm' | 'md'; className?: string }) {
  const px = size === 'sm' ? 28 : 36;
  return (
    <span role="img" aria-label={label} className={cn('relative inline-flex shrink-0', size === 'sm' ? 'size-7' : 'size-9', className)} data-testid="avatar" data-photo={photo ? '' : undefined}>
      <span className="block size-full overflow-hidden rounded-full bg-muted ring-2 ring-card">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own static files; the image optimizer is off (next.config)
          <img
            src={`/avatars/${photo}.webp`}
            srcSet={`/avatars/${photo}.webp 1x, /avatars/${photo}@2x.webp 2x`}
            width={px}
            height={px}
            alt=""
            loading="lazy"
            decoding="async"
            className="block size-full object-cover"
          />
        ) : (
          <svg viewBox="0 0 36 36" className="block size-full text-muted-foreground" aria-hidden data-testid="avatar-generic">
            <circle cx="18" cy="14" r="6.5" fill="currentColor" />
            <path d="M5.5 33c1.9-6.6 6.7-10.2 12.5-10.2S28.6 26.4 30.5 33" fill="currentColor" />
          </svg>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute -end-1 -bottom-0.5 rounded-full bg-primary px-[3px] font-extrabold leading-none text-primary-foreground ring-2 ring-card',
          size === 'sm' ? 'py-[1px] text-[0.5rem]' : 'py-[2px] text-[0.5625rem]',
        )}
        dir="ltr"
        data-testid="ai-badge"
      >
        {badge}
      </span>
    </span>
  );
}

/** Overlapping avatars with a "+n" overflow, as on a project card. Hidden from screen readers: the rows below name everyone. */
export function AvatarGroup({ people, max = 5, moreLabel, badge }: { people: { photo: string | null; label: string }[]; max?: number; moreLabel: (n: number) => string; badge: string }) {
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  return (
    <span className="flex items-center" aria-hidden>
      {shown.map((p, i) => (
        <Avatar key={i} photo={p.photo} label={p.label} badge={badge} size="sm" className={i ? '-ms-1.5' : ''} />
      ))}
      {more > 0 ? (
        <span className="-ms-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-1 text-[0.6875rem] font-semibold text-muted-foreground ring-2 ring-card" dir="ltr">
          {moreLabel(more)}
        </span>
      ) : null}
    </span>
  );
}
