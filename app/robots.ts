import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/components/site';

// A public site: crawling is allowed. The health probe is not content.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/api/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
