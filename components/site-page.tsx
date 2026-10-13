import { COPY, type Lang } from './copy';
import { jsonLd } from './site';
import { buildChart } from './snapshot';
import { loadSnapshot } from './snapshot-server';
import { ChartNotice, sectionsOf, TeamChart, type SectionKey } from './team-chart';
import { ThemeToggle } from './theme-toggle';

/**
 * The public page, as a dashboard: a section menu (a sidebar from lg up, a wrapping row above the content
 * below that), a top bar, then the cards. A server component; the only client JavaScript is the theme
 * switch. The team data is fetched on the server from the public snapshot service; the browser never calls
 * that service.
 *
 * The page is cached (ISR). A render without a snapshot is NEVER kept as a good page:
 *  - at build time there is no service to ask, so the build renders the short notice; that page is replaced
 *    by the first regeneration that gets a snapshot;
 *  - after that, a regeneration that cannot get one throws, so the last good page keeps being served and the
 *    next request tries again. A valid but EMPTY team is a real answer and is rendered.
 */
export class SnapshotUnavailableError extends Error {
  constructor() {
    super('SNAPSHOT_UNAVAILABLE: keeping the last good page');
  }
}

export async function SitePage({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  const result = await loadSnapshot();
  if (result.state === 'unavailable' && process.env.NEXT_PHASE !== 'phase-production-build') throw new SnapshotUnavailableError();
  const model = result.state === 'ok' ? buildChart(result.snapshot) : null;
  const sections = sectionsOf(model);
  const label: Record<SectionKey, string> = c.nav;
  const updated = model?.generatedAt
    ? new Date(model.generatedAt).toLocaleString(c.locale, {
        timeZone: c.timeZone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
    : null;

  const menu = (variant: 'side' | 'top') => (
    <nav aria-label={c.nav.label} className={variant === 'side' ? 'mt-6' : ''}>
      {variant === 'side' ? <p className="m-0 mb-1 px-3 text-xs font-semibold tracking-wide text-sidebar-muted uppercase">{c.nav.label}</p> : null}
      <ul className={variant === 'side' ? 'm-0 grid list-none gap-0.5 p-0' : 'm-0 flex list-none flex-wrap gap-2 p-0'}>
        {sections.map((s) => (
          <li key={s}>
            <a
              href={`#${s}`}
              className={
                variant === 'side'
                  ? 'block rounded-control px-3 py-2 text-sm font-semibold text-sidebar-foreground no-underline hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground'
                  : 'inline-block rounded-full px-3 py-1 text-sm font-semibold text-sidebar-foreground no-underline hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground'
              }
            >
              {label[s]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(lang) }} />
      <aside className="sidebar-edge hidden bg-sidebar px-4 py-5 text-sidebar-foreground lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto" data-testid="sidebar">
        <span className="brand block px-3 text-lg font-extrabold text-sidebar-active-foreground">{c.brand}</span>
        {menu('side')}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex min-w-0 items-center gap-3 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur lg:px-6">
          <span className="brand min-w-0 truncate font-extrabold lg:hidden">{c.brand}</span>
          {updated && model?.generatedAt ? (
            <p className="updated m-0 hidden min-w-0 truncate text-sm text-muted-foreground sm:block" data-testid="chart-updated">
              <time dateTime={model.generatedAt}>{c.updated(updated)}</time>
            </p>
          ) : null}
          <span className="ms-auto flex shrink-0 items-center gap-2">
            <a
              className="lang-switch rounded-full border border-border px-3 py-1 text-sm font-semibold no-underline hover:bg-muted"
              href={c.switchHref}
              hrefLang={c.switchLang}
              lang={c.switchLang}
            >
              {c.switchLabel}
            </a>
            <ThemeToggle lightLabel={c.themeLight} darkLabel={c.themeDark} />
          </span>
        </header>

        <div className="bg-sidebar px-3 py-2 lg:hidden" data-testid="section-menu">
          {menu('top')}
        </div>

        <main className="grid gap-8 px-4 py-6 lg:px-6">
          <section aria-labelledby="overview" className="grid gap-2">
            <h1 id="overview" className="m-0 text-xl leading-snug font-extrabold lg:text-2xl">
              {c.title}
            </h1>
            <p className="intro m-0 max-w-3xl text-muted-foreground">{c.intro}</p>
            {updated && model?.generatedAt ? (
              <p className="m-0 text-sm text-muted-foreground sm:hidden">
                <time dateTime={model.generatedAt}>{c.updated(updated)}</time>
              </p>
            ) : null}
          </section>

          {model ? <TeamChart model={model} c={c} /> : <ChartNotice c={c} state={result.state === 'empty' ? 'empty' : 'unavailable'} />}
        </main>

        <footer className="site-footer flex flex-wrap justify-between gap-x-8 gap-y-2 border-t border-border px-4 py-6 text-sm text-muted-foreground lg:px-6">
          <span>{c.footerCopyright}</span>
          <span>{c.footerCookies}</span>
        </footer>
      </div>
    </div>
  );
}
