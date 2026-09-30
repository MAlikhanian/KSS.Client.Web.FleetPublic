import { SitePage } from '@/components/site-page';

// Rendered per request: the team chart comes from the public snapshot service
// (cached in memory for a short time; see components/snapshot-server.ts), and a
// build-time render would bake in whatever the build could not reach.
export const dynamic = 'force-dynamic';

export default function PersianHome() {
  return <SitePage lang="fa" />;
}
