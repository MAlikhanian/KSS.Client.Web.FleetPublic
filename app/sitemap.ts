import type { MetadataRoute } from 'next';
import { PATHS, SITE_URL } from '@/components/site';
import { loadReports } from '@/components/reports/load';
import listing from '@/components/reports/listing.json';

// Read on each request, so a listed report (one mounted after the build) appears without a rebuild.
export const dynamic = 'force-dynamic';

// One entry per language, each listing the other as its alternate. Report pages are listed only when the site-wide
// reports flag is on; by default they are unlisted and never appear here.
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = { fa: `${SITE_URL}${PATHS.fa}`, en: `${SITE_URL}${PATHS.en}` };
  const reports = listing.listed ? [...loadReports().keys()].map((slug) => ({ url: `${SITE_URL}/reports/${slug}`, changeFrequency: 'monthly' as const, priority: 0.5 })) : [];
  return [
    { url: `${SITE_URL}${PATHS.fa}`, changeFrequency: 'weekly', priority: 1, alternates: { languages } },
    { url: `${SITE_URL}${PATHS.en}`, changeFrequency: 'weekly', priority: 0.8, alternates: { languages } },
    ...reports,
  ];
}
