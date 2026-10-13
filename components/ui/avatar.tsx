import { cn } from './cn';

/**
 * An agent's avatar: her photo when one is published (`photo` is its slug), otherwise one generic silhouette, never
 * an initial. Every avatar carries a small "AI" badge, and the same fact is in its accessible name (`label`), so it
 * is never shown by the picture alone. Photos are our own files, served from this site, lazily loaded at 1x and 2x.
 * The silhouette and the badge are drawn by the `av` class (globals.css), so each of the page's ~180 avatars costs a
 * few bytes of markup, not a copy of the drawing.
 */
export function Avatar({ photo, label, size = 'md', className }: { photo: string | null; label: string; size?: 'sm' | 'md'; className?: string }) {
  const px = size === 'sm' ? 28 : 36;
  return (
    <span role="img" aria-label={label} className={cn('av', size === 'md' && 'av-md', className)}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- our own static files; the image optimizer is off (next.config)
        <img src={`/avatars/${photo}.webp`} srcSet={`/avatars/${photo}.webp 1x, /avatars/${photo}@2x.webp 2x`} width={px} height={px} alt="" loading="lazy" decoding="async" />
      ) : null}
    </span>
  );
}
