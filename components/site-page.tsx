import { readContact } from './contact';
import { COPY, type Lang } from './copy';
import { jsonLd } from './site';
import { buildChart } from './snapshot';
import { loadSnapshot } from './snapshot-server';
import { Hero, HowItWorks, storyNumbers, WhatTheyDo } from './story';
import { ChartNotice, TeamChart } from './team-chart';
import { ThemeToggle } from './theme-toggle';

/**
 * The public page. It first says what this is (the hero), what the agents do and how a request is handled, then
 * shows the live team. A server component; the only client JavaScript is the theme switch. The team data is
 * fetched on the server from the public snapshot service; the browser never calls that service. The contact
 * details come from the deployment's environment (see contact.ts), never from the source.
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
  const numbers = storyNumbers(model);
  const contact = readContact();
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
  const nav: [string, string][] = [
    ['what', c.story.nav.what],
    ['how', c.story.nav.how],
    ['team', c.story.nav.team],
  ];

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(lang) }} />
      {/* Sticky from tablet width up; on a phone the bar wraps to two rows and would cover the content. */}
      <header className="z-10 bg-sidebar md:sticky md:top-0 text-sidebar-foreground" data-testid="topbar">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <span className="brand font-extrabold text-sidebar-active-foreground">{c.brand}</span>
          <nav aria-label={c.story.nav.label} className="ms-auto" data-testid="section-menu">
            <ul className="m-0 flex list-none flex-wrap gap-x-1 gap-y-1 p-0">
              {nav.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="inline-block rounded-control px-2.5 py-1 text-sm font-semibold text-sidebar-foreground no-underline hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <span className="flex shrink-0 items-center gap-2">
            <a
              className="lang-switch rounded-full border border-sidebar-active px-3 py-1 text-sm font-semibold text-sidebar-active-foreground no-underline hover:bg-sidebar-active/60"
              href={c.switchHref}
              hrefLang={c.switchLang}
              lang={c.switchLang}
            >
              {c.switchLabel}
            </a>
            <ThemeToggle lightLabel={c.themeLight} darkLabel={c.themeDark} />
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-6">
        <Hero c={c} n={numbers} contact={contact} updated={updated} generatedAt={model?.generatedAt ?? null} />
        <WhatTheyDo c={c} n={numbers} />
        <HowItWorks c={c} />
        <section aria-labelledby="team" className="grid gap-4">
          <h2 id="team" className="m-0 text-xl font-extrabold">
            {c.story.teamTitle}
          </h2>
          {model ? <TeamChart model={model} c={c} /> : <ChartNotice c={c} state={result.state === 'empty' ? 'empty' : 'unavailable'} />}
        </section>
      </main>

      <footer className="site-footer mx-auto flex max-w-6xl flex-wrap justify-between gap-x-8 gap-y-2 border-t border-border px-4 py-6 text-sm text-muted-foreground">
        <span>{c.footerCopyright}</span>
        <span>{c.footerCookies}</span>
      </footer>
    </div>
  );
}
