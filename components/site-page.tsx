import { COPY, type Lang } from './copy';
import { jsonLd } from './site';
import { buildChart } from './snapshot';
import { loadSnapshot } from './snapshot-server';
import { ChartNotice, TeamChart } from './team-chart';

/**
 * The public page. A server component with no client JavaScript of its own.
 * The team chart is fetched on the server from the public snapshot service;
 * the browser never calls that service. If the snapshot cannot be had, the page
 * still renders in full, with a short notice in place of the chart.
 */
export async function SitePage({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  const result = await loadSnapshot();
  return (
    <div className="site">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(lang) }} />
      <header className="site-header wrap">
        <span className="brand">{c.brand}</span>
        <a className="lang-switch" href={c.switchHref} hrefLang={c.switchLang} lang={c.switchLang}>
          {c.switchLabel}
        </a>
      </header>

      <main>
        <section className="hero wrap" aria-labelledby="page-title">
          <h1 id="page-title">{c.title}</h1>
          <p className="intro">{c.intro}</p>
        </section>

        {result.state === 'ok' ? (
          <TeamChart model={buildChart(result.snapshot)} c={c} />
        ) : (
          <ChartNotice c={c} state={result.state} />
        )}
      </main>

      <footer className="site-footer wrap">
        <span>{c.footerCopyright}</span>
        <span>{c.footerCookies}</span>
      </footer>
    </div>
  );
}
