import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { COPY } from '@/components/copy';
import { pageMetadata } from '@/components/site';
import '../globals.css';

// Root layout for the English site (served at /en).
const c = COPY.en;

export const metadata: Metadata = pageMetadata('en');

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f3f5f8' };

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={c.lang} dir={c.dir}>
      <body>{children}</body>
    </html>
  );
}
