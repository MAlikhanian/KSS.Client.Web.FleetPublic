import type { Metadata } from 'next';
import { COPY, LEGAL_NAME_FA, type Lang } from './copy';

/** The site's one public origin. Every canonical, sitemap and share URL uses it. */
export const SITE_URL = 'https://fleet.kss.ir';

export const PATHS: Record<Lang, string> = { fa: '/', en: '/en' };

/** Share card per language: the Persian page shares a Persian card carrying the legal name. */
const OG_IMAGE: Record<Lang, { url: string; width: number; height: number }> = {
  fa: { url: '/og-fa.png', width: 1200, height: 630 },
  en: { url: '/og.png', width: 1200, height: 630 },
};

/** Page metadata for one language: title, description, canonical, hreflang, share cards. */
export function pageMetadata(lang: Lang): Metadata {
  const c = COPY[lang];
  const other: Lang = lang === 'fa' ? 'en' : 'fa';
  return {
    metadataBase: new URL(SITE_URL),
    title: c.siteTitle,
    description: c.description,
    applicationName: c.brand,
    alternates: {
      canonical: PATHS[lang],
      languages: { fa: PATHS.fa, en: PATHS.en, 'x-default': PATHS.fa },
    },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      url: PATHS[lang],
      siteName: c.brand,
      title: c.siteTitle,
      description: c.description,
      locale: lang === 'fa' ? 'fa_IR' : 'en_US',
      alternateLocale: [other === 'fa' ? 'fa_IR' : 'en_US'],
      images: [{ ...OG_IMAGE[lang], alt: c.artLabel }],
    },
    twitter: {
      card: 'summary_large_image',
      title: c.siteTitle,
      description: c.description,
      images: [OG_IMAGE[lang].url],
    },
    icons: {
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  };
}

/**
 * Structured data for search engines: the organisation and this website.
 * Built only from this site's own constants. `<` is escaped so no value can
 * ever close the surrounding <script> element, whatever a future edit puts in.
 */
export function jsonLd(lang: Lang): string {
  return rawJsonLd(lang).replace(/</g, '\\u003c');
}

function rawJsonLd(lang: Lang): string {
  const c = COPY[lang];
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      lang === 'fa'
        ? { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: LEGAL_NAME_FA, alternateName: 'KSS', url: SITE_URL }
        : { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'KSS', url: SITE_URL },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: c.brand,
        description: c.description,
        inLanguage: ['fa', 'en'],
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  });
}
