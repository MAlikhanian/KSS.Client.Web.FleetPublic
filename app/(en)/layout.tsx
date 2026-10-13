import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { COPY } from '@/components/copy';
import { pageMetadata } from '@/components/site';
import { THEME_BOOT } from '@/components/theme-boot';
import '../globals.css';

// Root layout for the English site (served at /en).
const c = COPY.en;

export const metadata: Metadata = pageMetadata('en');

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f5f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1520' },
  ],
};

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={c.lang} dir={c.dir} suppressHydrationWarning>
      <head>
        {/* Applies a stored theme choice before first paint; the page follows the system setting otherwise. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
