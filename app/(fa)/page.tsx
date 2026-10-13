import { SitePage } from '@/components/site-page';

// Cached and regenerated in the background at most every 30 seconds (ISR): a visitor gets a ready page, and
// only a regeneration talks to the public snapshot service. A regeneration that cannot get a snapshot fails
// on purpose, so the last good page keeps being served (see components/site-page.tsx).
export const revalidate = 30;

export default function PersianHome() {
  return <SitePage lang="fa" />;
}
