'use client';

import { useEffect, useState } from 'react';

/**
 * Light/dark switch. With no choice made the page follows the system setting (CSS does that on its own); a
 * click stores an explicit choice in localStorage. Storage can be unavailable (private mode, blocked site
 * data), so every access is guarded and the page works the same without it. No cookie is ever set.
 */
import { THEME_KEY as KEY } from './theme-boot';

function effective(): 'light' | 'dark' {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle({ lightLabel, darkLabel }: { lightLabel: string; darkLabel: string }) {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
  useEffect(() => setTheme(effective()), []);

  const flip = () => {
    const next = effective() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable: the choice lasts for this page view */
    }
    setTheme(next);
  };

  // The label names the mode a click switches TO.
  const label = theme === 'dark' ? lightLabel : darkLabel;
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={label}
      title={label}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted"
      data-testid="theme-toggle"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {theme === 'dark' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        )}
      </svg>
    </button>
  );
}

