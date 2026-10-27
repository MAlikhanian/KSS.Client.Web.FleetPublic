import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { COPY } from '@/components/copy';
import { getReport } from '@/components/reports/load';
import { ReportView } from '@/components/reports/report-view';
import listing from '@/components/reports/listing.json';

// Rendered on each request from the mounted report files: new content needs no rebuild, and nothing is written to
// disk (the read-only mount is the only thing read). An unknown or malformed slug, or no mount at all, is a 404.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const report = getReport(slug);
  // Unlisted unless the one site-wide flag says otherwise (the X-Robots-Tag header in next.config says the same).
  const robots = { index: listing.listed, follow: listing.listed };
  if (!report) return { robots };
  const title = report.markdown.title ?? slug;
  return {
    title: `${title} | ${COPY.fa.brand}`,
    robots,
    alternates: { canonical: `/reports/${report.slug}`, languages: {} },
    openGraph: { type: 'article', url: `/reports/${report.slug}`, title, siteName: COPY.fa.brand, locale: 'fa_IR' },
    twitter: { card: 'summary', title },
  };
}

export default async function ReportPage({ params }: Props) {
  const { slug } = await params;
  const report = getReport(slug);
  if (!report) notFound();
  return <ReportView report={report} />;
}
