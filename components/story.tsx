import { STORY_CLAIMS, type Copy, type StoryCard } from './copy';
import type { ChartModel } from './snapshot';
import { Card } from './ui/card';

/**
 * The story parts of the dashboard: what this is (the hero), what the agents do (four cards, each with one live number
 * from the snapshot), and how a request is handled (five steps). Every number comes from data the public service
 * already sends, and is left out when that data is absent; nothing is hard-coded.
 */

const HOUR_MS = 60 * 60_000;
const norm = (s: string) => s.trim().toLowerCase();

export interface StoryNumbers {
  total: number | null;
  supportSent: number | null;
  teams: number | null;
  products: number | null;
  specialties: number | null;
  activeHour: number | null;
}

/** The four card numbers, from the chart model. A number with no source in this snapshot is null. */
export function storyNumbers(model: ChartModel | null): StoryNumbers {
  if (!model) return { total: null, supportSent: null, teams: null, products: null, specialties: null, activeHour: null };
  const support = model.activity.find((d) => d.department !== null && norm(d.department) === 'customer support');
  const leads = model.boxes.filter((b) => b.kind === 'lead');
  const titled = leads.filter((b) => b.kind === 'lead' && b.project !== null).length;
  const network = model.boxes.filter((b) => b.kind === 'department' && norm(b.department) === 'network').flatMap((b) => b.people);
  const specialties = new Set(network.map((p) => p.role)).size;
  const people = [...model.strip, ...model.boxes.flatMap((b) => b.people)];
  const at = model.generatedAt ? Date.parse(model.generatedAt) : Date.now();
  return {
    total: model.total,
    supportSent: support ? support.sent : null,
    teams: leads.length || null,
    products: titled || null,
    // One generic role is not "specialties": shown only when the roles really differ.
    specialties: specialties > 1 ? specialties : null,
    activeHour: model.activeNow === null ? null : people.filter((p) => p.lastActiveAt !== null && at - Date.parse(p.lastActiveAt) <= HOUR_MS).length,
  };
}

/** The department colour token for each card: a graphic accent and the big number only, never body text. */
const DEPT_VAR: Record<StoryCard['key'], string> = {
  support: 'var(--dept-support)',
  engineering: 'var(--dept-engineering)',
  network: 'var(--dept-network)',
  leadership: 'var(--dept-executive)',
};

export function Hero({ c, n }: { c: Copy; n: StoryNumbers }) {
  const s = c.story;
  const count = n.total === null ? null : n.total.toLocaleString(c.locale);
  return (
    <section aria-labelledby="overview" className="grid items-center gap-x-10 gap-y-3 rounded-card border border-border bg-gradient-to-br from-card to-muted p-5 lg:px-7 lg:py-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" data-testid="hero">
      <h1 id="overview" className="m-0 max-w-[40ch] text-xl leading-snug font-extrabold lg:text-[1.75rem] xl:row-span-2">
        {s.headline(count)}
      </h1>
      <p className="intro m-0 max-w-[70ch] text-muted-foreground">
        {/* One text node, so the approved sentence is verbatim in the HTML. */}
        {`${s.subAnswers} ${STORY_CLAIMS[c.lang].changes}${c.lang === 'fa' ? '، ' : ', '}${s.subDeletion}`}
      </p>
      <div className="flex flex-wrap gap-2">
        <a className="rounded-control bg-primary px-4 py-2 font-semibold text-primary-foreground no-underline" href="https://kss.ir">
          {s.ctaSite}
        </a>
      </div>
    </section>
  );
}

function cardNumber(card: StoryCard, n: StoryNumbers, c: Copy): { value: string; unit: string } | null {
  const fmt = (v: number) => v.toLocaleString(c.locale);
  const s = c.story;
  switch (card.key) {
    case 'support':
      return n.supportSent === null ? null : { value: fmt(n.supportSent), unit: s.numSupport };
    case 'engineering':
      return n.teams === null ? null : { value: fmt(n.teams), unit: s.numTeams(fmt(n.teams), n.products === null ? null : fmt(n.products)) };
    case 'network':
      return n.specialties === null ? null : { value: fmt(n.specialties), unit: s.numSpecialties };
    case 'leadership':
      return n.activeHour === null ? null : { value: fmt(n.activeHour), unit: s.numActiveHour };
  }
}

export function WhatTheyDo({ c, n }: { c: Copy; n: StoryNumbers }) {
  return (
    <section aria-labelledby="what">
      <h2 id="what" className="m-0 mb-3 text-xl font-extrabold">
        {c.story.whatTitle}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {c.story.cards.map((card) => {
          const num = cardNumber(card, n, c);
          return (
            <Card key={card.key} className="flex flex-col border-t-4 p-4" style={{ borderTopColor: DEPT_VAR[card.key] }} data-testid={`what-${card.key}`}>
              <h3 className="m-0 mb-1 text-base font-extrabold">{card.title}</h3>
              <p className="m-0 mb-3 text-sm text-muted-foreground">{card.body}</p>
              {num ? (
                <p className="m-0 mt-auto flex flex-wrap items-baseline gap-x-2" data-testid="what-number">
                  <span className="text-2xl font-extrabold tabular-nums" style={{ color: DEPT_VAR[card.key] }}>
                    {num.value}
                  </span>
                  <span className="text-xs text-muted-foreground">{num.unit}</span>
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function HowItWorks({ c }: { c: Copy }) {
  return (
    <section aria-labelledby="how">
      <h2 id="how" className="m-0 mb-3 text-xl font-extrabold">
        {c.story.howTitle}
      </h2>
      <ol className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]" data-testid="how-steps">
        {c.story.steps.map(([title, line], i) => (
          <li key={i} className="grid content-start gap-1 rounded-card border border-border bg-card p-4">
            <span className="grid size-7 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground" aria-hidden>
              {(i + 1).toLocaleString(c.locale)}
            </span>
            <b className="font-extrabold">{title}</b>
            <small className="text-xs text-muted-foreground">{line}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}
