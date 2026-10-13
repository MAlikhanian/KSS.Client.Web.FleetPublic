import { COPY, type Lang } from './copy';
import { DepartmentTable, StatCards, UsageBand } from './dashboard';
import { jsonLd } from './site';
import { buildChart } from './snapshot';
import { loadSnapshot } from './snapshot-server';
import { Hero, HowItWorks, storyNumbers, WhatTheyDo } from './story';
import { ChartNotice, TeamChart } from './team-chart';
import { ThemeToggle } from './theme-toggle';

/**
 * The public page: a dashboard showcase of the AI team. A dark sidebar (from desktop width up) and a top bar frame
 * the overview (the hero and stat cards), the usage graphs, what the agents do, the departments table, the live
 * team and how a request is handled. A server component; the only client JavaScript is the theme switch. The team
 * data is fetched on the server from the public snapshot service; the browser never calls that service.
 *
 * The page is cached (ISR). A render without a snapshot is NEVER kept as a good page:
 *  - at build time there is no service to ask, so the build renders a "loading the latest team data" page that
 *    reloads itself; a freshly started server serves it to its first visitor, and the regeneration that visit
 *    starts replaces it within seconds (never the "can't be shown" wording);
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
  const building = process.env.NEXT_PHASE === 'phase-production-build';
  if (result.state === 'unavailable' && !building) {
    console.error('[fleet-public] regeneration refused: SNAPSHOT_UNAVAILABLE, keeping the last good page');
    throw new SnapshotUnavailableError();
  }
  const model = result.state === 'ok' ? buildChart(result.snapshot) : null;
  const numbers = storyNumbers(model);
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
  const hasActivity = !!model && (model.activity.length > 0 || model.other !== null);
  const nav: [string, string][] = [
    ['overview', c.dash.nav.overview],
    ...(model ? ([['usage', c.dash.nav.usage]] as [string, string][]) : []),
    ['what', c.dash.nav.what],
    ...(hasActivity ? ([['activity', c.dash.nav.activity]] as [string, string][]) : []),
    ['teams', c.dash.nav.teams],
    ['how', c.dash.nav.how],
  ];
  const links = (className: string) =>
    nav.map(([id, label]) => (
      <li key={id}>
        <a href={`#${id}`} className={className}>
          {label}
        </a>
      </li>
    ));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(lang) }} />
      <aside className="sidebar-edge hidden bg-sidebar text-sidebar-foreground lg:block" data-testid="sidebar">
        <div className="sticky top-0 flex h-screen flex-col gap-6 overflow-y-auto px-3 py-5">
          <span className="brand px-3 text-base leading-snug font-extrabold text-sidebar-active-foreground">{c.brand}</span>
          <nav aria-label={c.dash.nav.label} data-testid="side-menu">
            <ul className="m-0 grid list-none gap-0.5 p-0">
              {links(
                'block rounded-control border-s-2 border-transparent px-3 py-2 text-sm font-semibold text-sidebar-foreground no-underline hover:border-sidebar-accent hover:bg-sidebar-active hover:text-sidebar-active-foreground',
              )}
            </ul>
          </nav>
          <a className="mx-3 mt-auto rounded-control bg-sidebar-active px-3 py-2 text-center text-sm font-semibold text-sidebar-active-foreground no-underline hover:bg-sidebar-active/70" href="https://kss.ir">
            {c.story.ctaSite}
          </a>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Sticky from desktop width up; on a phone the bar is taller and would cover the content. */}
        <header className="z-10 border-b border-border bg-card lg:sticky lg:top-0" data-testid="topbar">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 lg:px-6">
            <span className="brand font-extrabold lg:hidden">{c.brand}</span>
            <span className="hidden text-lg font-extrabold lg:inline">{c.dash.pageTitle}</span>
            {updated && model?.generatedAt ? (
              <p className="updated m-0 flex items-center gap-2 text-xs text-muted-foreground" data-testid="chart-updated"><span className="size-2 shrink-0 rounded-full bg-success" aria-hidden /><time dateTime={model.generatedAt}>{c.story.live(updated)}</time></p>
            ) : null}
            <span className="ms-auto flex shrink-0 items-center gap-2">
              <a
                className="lang-switch rounded-full border border-border px-3 py-1 text-sm font-semibold text-foreground no-underline hover:bg-muted"
                href={c.switchHref}
                hrefLang={c.switchLang}
                lang={c.switchLang}
              >
                {c.switchLabel}
              </a>
              <ThemeToggle lightLabel={c.themeLight} darkLabel={c.themeDark} />
            </span>
          </div>
          <nav aria-label={c.dash.menu} className="overflow-x-auto border-t border-border bg-sidebar lg:hidden" data-testid="section-menu">
            <ul className="m-0 flex list-none gap-1 p-0 px-2 py-1.5 whitespace-nowrap">
              {links('inline-block rounded-control px-2.5 py-1 text-sm font-semibold text-sidebar-foreground no-underline hover:bg-sidebar-active hover:text-sidebar-active-foreground')}
            </ul>
          </nav>
        </header>

        <main className="grid grid-cols-1 gap-8 px-4 py-6 lg:px-6">
          <Hero c={c} n={numbers} />
          {model ? <StatCards model={model} c={c} /> : null}
          {model ? <UsageBand model={model} c={c} /> : null}
          <WhatTheyDo c={c} n={numbers} />
          {model ? <DepartmentTable model={model} c={c} /> : null}
          <section aria-labelledby="teams" className="grid min-w-0 grid-cols-1 gap-4">
            <h2 id="teams" className="m-0 text-xl font-extrabold">
              {c.story.teamTitle}
            </h2>
            {model ? <TeamChart model={model} c={c} /> : <ChartNotice c={c} state={result.state === 'empty' ? 'empty' : building ? 'pending' : 'unavailable'} />}
          </section>
          <HowItWorks c={c} />
        </main>

        <footer className="site-footer flex flex-wrap justify-between gap-x-8 gap-y-2 border-t border-border px-4 py-6 text-sm text-muted-foreground lg:px-6">
          <span>{c.footerCopyright}</span>
          <span>{c.footerCookies}</span>
        </footer>
      </div>
    </div>
  );
}
