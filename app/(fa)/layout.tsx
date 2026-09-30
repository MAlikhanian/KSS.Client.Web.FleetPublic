import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { COPY } from '@/components/copy';
import { pageMetadata } from '@/components/site';
import '../globals.css';

// Root layout for the Persian site (served at /). The English site has its
// own root layout, so each page carries the correct lang and direction from
// the first byte.
const c = COPY.fa;

export const metadata: Metadata = pageMetadata('fa');

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f3f5f8' };

export default function PersianLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={c.lang} dir={c.dir}>
      <body>{children}</body>
    </html>
  );
}
