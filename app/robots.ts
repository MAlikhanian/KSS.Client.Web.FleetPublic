import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/components/site';

// A public site: crawling is allowed. The health probe is not content, and /s/ (one-time links, served by another
// service on this host) must never be crawled. The trailing slash matters: a bare "/s" prefix would block /sitemap.xml.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/s/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
