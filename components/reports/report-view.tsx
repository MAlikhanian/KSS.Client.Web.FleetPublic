import Link from 'next/link';
import type { ReactNode } from 'react';
import { COPY } from '../copy';
import { ThemeToggle } from '../theme-toggle';
import { ReportChart } from './charts';
import { faNumber, tehranDayKey, tehranDayLong, tehranTime } from './format';
import type { Report } from './load';
import { type Block, type Inline, type List, parseInline } from './markdown';
import { statusOf } from './status';
import type { Figure, TimelineItem } from './schema';

/**
 * A report page: the prose from report.fa.md rendered verbatim (a safe Markdown subset, never HTML), with the charts,
 * headline figures and timeline from report.data.json. Only the data values are converted (Tehran time, Jalali dates,
 * Persian digits); the prose is left exactly as written. Persian, right to left; values that are Latin by nature
 * (code, addresses) keep their own direction.
 */

const c = COPY.fa;

/** The page's own words. The report's words come from its files. */
const UI = {
  timeline: 'گاه‌شمار رویدادها',
  timelineNote: 'زمان‌ها به وقت تهران',
  figures: 'شاخص‌ها',
  kinds: { attack: 'حمله', detect: 'شناسایی', action: 'اقدام', restore: 'بازیابی' } as Record<string, string>,
  home: 'ناوگان KSS',
  site: 'مشاهدهٔ kss.ir',
};

function InlineText({ text }: { text: string }) {
  const render = (parts: Inline[]): ReactNode[] =>
    parts.map((p, i) =>
      p.t === 'text' ? (
        <span key={i}>{p.v}</span>
      ) : p.t === 'code' ? (
        <code key={i} dir="ltr" className="rpt-code">
          {p.v}
        </code>
      ) : p.t === 'status' ? (
        p.bold ? (
          <strong key={i} className="rpt-status-word" data-tone={p.tone}>
            {p.v}
          </strong>
        ) : (
          <span key={i} className="rpt-status" data-tone={p.tone}>
            {p.v}
          </span>
        )
      ) : (
        <strong key={i}>{render(p.v)}</strong>
      ),
    );
  return <>{render(parseInline(text))}</>;
}

function ListView({ list }: { list: List }) {
  const items = list.items.map((it, i) => (
    <li key={i}>
      <InlineText text={it.text} />
      {it.children.map((ch, j) => (
        <ListView key={j} list={ch} />
      ))}
    </li>
  ));
  return list.ordered ? <ol className="rpt-ol">{items}</ol> : <ul className="rpt-ul">{items}</ul>;
}

function Figures({ figures }: { figures: Figure[] }) {
  if (!figures.length) return null;
  return (
    <section aria-label={UI.figures} className="rpt-figures" data-testid="report-figures">
      {figures.map((f, i) => (
        <div key={i} className="rpt-figure" data-accent={i % 5}>
          <span className="rpt-figure-value">
            {faNumber(f.value)}
            {f.unit ? <span className="rpt-figure-unit"> {f.unit}</span> : null}
          </span>
          <span className="rpt-figure-label">{f.label}</span>
        </div>
      ))}
    </section>
  );
}

function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return null;
  let lastDay = '';
  return (
    <section aria-labelledby="rpt-timeline" className="rpt-timeline" data-testid="report-timeline">
      <h2 id="rpt-timeline" className="rpt-h2">
        {UI.timeline}
      </h2>
      <p className="rpt-muted">{UI.timelineNote}</p>
      <ol className="rpt-tl-list">
        {items.map((it, i) => {
          const day = tehranDayKey(it.at);
          const newDay = day !== lastDay;
          lastDay = day;
          const kind = it.kind && UI.kinds[it.kind] ? it.kind : null;
          return (
            <li key={i} className="rpt-tl-item" data-kind={kind ?? 'other'}>
              {newDay ? <p className="rpt-tl-day">{tehranDayLong(it.at)}</p> : null}
              <div className="rpt-tl-row">
                <time dateTime={it.at} className="rpt-tl-time">
                  {tehranTime(it.at)}
                </time>
                <div className="rpt-tl-body">
                  <p className="rpt-tl-title">
                    {kind ? <span className="rpt-tl-kind">{UI.kinds[kind]}</span> : null}
                    {it.title}
                  </p>
                  {it.detail ? <p className="rpt-tl-detail">{it.detail}</p> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function BlockView({ b, report }: { b: Block; report: Report }) {
  switch (b.t) {
    case 'h': {
      const Tag = (['h1', 'h2', 'h3', 'h4'] as const)[b.level - 1];
      const num = b.level === 2 ? /^([0-9۰-۹]{1,3})[.)]\s+(.+)$/.exec(b.text) : null;
      if (num) {
        const n = Number(num[1].replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
        return (
          <Tag className="rpt-h2 rpt-h2-numbered" data-accent={n % 5}>
            <span className="rpt-h-num" aria-hidden>
              {num[1]}
            </span>
            <span className="sr-only">{num[1]}. </span>
            <InlineText text={num[2]} />
          </Tag>
        );
      }
      return (
        <Tag className={`rpt-h${b.level}`}>
          <InlineText text={b.text} />
        </Tag>
      );
    }
    case 'p':
      return (
        <p className="rpt-p">
          <InlineText text={b.text} />
        </p>
      );
    case 'quote':
      return (
        <blockquote className="rpt-callout">
          {b.paragraphs.map((p, i) => (
            <p key={i}>
              <InlineText text={p} />
            </p>
          ))}
        </blockquote>
      );
    case 'list':
      return <ListView list={b.list} />;
    case 'table':
      return (
        <div className="rpt-table-wrap">
          <table className="rpt-table">
            <thead>
              <tr>
                {b.head.map((h, i) => (
                  <th key={i} scope="col">
                    <InlineText text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {b.head.map((_, j) => {
                    const cell = r[j] ?? '';
                    const tone = statusOf(cell.replace(/^\*\*(.*)\*\*$/, '$1'));
                    return (
                      <td key={j}>
                        {tone ? (
                          <span className="rpt-pill" data-tone={tone}>
                            {cell.replace(/^\*\*(.*)\*\*$/, '$1')}
                          </span>
                        ) : (
                          <InlineText text={cell} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'hr':
      return <hr className="rpt-hr" />;
    case 'chart':
      return <ReportChart chart={report.data.charts.find((ch) => ch.id === b.id)} />;
    case 'figures':
      return <Figures figures={report.data.figures} />;
    case 'timeline':
      return <Timeline items={report.data.timeline} />;
    case 'container':
      return (
        <section className={`rpt-${b.kind}`} data-testid={`report-${b.kind}`}>
          {b.blocks.map((x, i) => (
            <BlockView key={i} b={x} report={report} />
          ))}
        </section>
      );
  }
}

/**
 * Where the figures and the timeline go. A {{figures}} or {{timeline}} line in the prose places them exactly; without
 * one, the figures follow the report's title and the timeline comes last, before any closing statement.
 */
function withDefaults(blocks: Block[]): Block[] {
  const has = (t: 'figures' | 'timeline') => blocks.some((b) => b.t === t || (b.t === 'container' && b.blocks.some((x) => x.t === t)));
  const out = [...blocks];
  if (!has('figures')) {
    const h1 = out.findIndex((b) => b.t === 'h' && b.level === 1);
    const firstNonOpening = out.findIndex((b) => !(b.t === 'container' && b.kind === 'opening'));
    out.splice(h1 >= 0 ? h1 + 1 : Math.max(0, firstNonOpening), 0, { t: 'figures' });
  }
  if (!has('timeline')) {
    const closing = out.findIndex((b) => b.t === 'container' && b.kind === 'closing');
    out.splice(closing >= 0 ? closing : out.length, 0, { t: 'timeline' });
  }
  return out;
}

export function ReportView({ report }: { report: Report }) {
  const blocks = withDefaults(report.markdown.blocks);
  return (
    <div className="rpt-page rpt-bg">
      <header className="rpt-top">
        <Link href="/" className="rpt-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- the site's own icon, served from this host */}
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span>{UI.home}</span>
        </Link>
        <ThemeToggle lightLabel={c.themeLight} darkLabel={c.themeDark} />
      </header>
      <main className="rpt-main" data-testid="report">
        {blocks.map((b, i) => (
          <BlockView key={i} b={b} report={report} />
        ))}
      </main>
      <footer className="rpt-footer">
        <span>{c.footerCopyright}</span>
        <a href="https://kss.ir">{UI.site}</a>
      </footer>
    </div>
  );
}
