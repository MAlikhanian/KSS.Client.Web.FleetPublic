import { COPY, type Lang } from './copy';
import { jsonLd } from './site';
import { TeamMotif } from './team-motif';

/**
 * The public page. A server component with no data and no client JavaScript
 * of its own: it renders the same way for every visitor.
 */
export function SitePage({ lang }: { lang: Lang }) {
  const c = COPY[lang];
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
          <div className="hero-text">
            <h1 id="page-title">{c.title}</h1>
            <p className="intro">{c.intro}</p>
          </div>
          <TeamMotif label={c.artLabel} />
        </section>

        <section className="soon" aria-labelledby="soon-title">
          <div className="wrap soon-inner">
            <h2 id="soon-title">{c.soonTitle}</h2>
            <p>{c.soonBody}</p>
            <ul>
              {c.soonItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="site-footer wrap">
        <span>{c.footerCopyright}</span>
        <span>{c.footerCookies}</span>
      </footer>
    </div>
  );
}
