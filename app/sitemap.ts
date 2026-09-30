import type { MetadataRoute } from 'next';
import { PATHS, SITE_URL } from '@/components/site';

// One entry per language, each listing the other as its alternate.
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = { fa: `${SITE_URL}${PATHS.fa}`, en: `${SITE_URL}${PATHS.en}` };
  return [
    { url: `${SITE_URL}${PATHS.fa}`, changeFrequency: 'weekly', priority: 1, alternates: { languages } },
    { url: `${SITE_URL}${PATHS.en}`, changeFrequency: 'weekly', priority: 0.8, alternates: { languages } },
  ];
}
