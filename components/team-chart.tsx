import type { CSSProperties } from 'react';
import type { Copy } from './copy';
import { DEPARTMENT_NAMES_FA, ROLE_NAMES_FA } from './names';
import type { ChartModel, ChartPerson } from './snapshot';

/**
 * The public team chart, in the same dense layout as the signed-in chart: a
 * leadership strip, then boxes packed into columns that fill the width. One line
 * per person: an initial in her colour, first name, role.
 *
 * Only first name, role, department and colour are shown. No identifier of any
 * kind is rendered, no project and no customer: an engineering box is titled by
 * its lead's first name, role and head-count only. There is no presence.
 */

const accent = (p: ChartPerson) => ({ '--accent': p.color }) as CSSProperties;

function names(c: Copy) {
  const fa = c.lang === 'fa';
  return {
    role: (served: string) => (fa && ROLE_NAMES_FA[served]) || served,
    department: (served: string) => (fa && DEPARTMENT_NAMES_FA[served]) || served,
  };
}

function Initial({ p }: { p: ChartPerson }) {
  return (
    <span className="initial" style={accent(p)} aria-hidden>
      {Array.from(p.firstName)[0]}
    </span>
  );
}

function Line({ p, label, strong }: { p: ChartPerson; label: string; strong?: boolean }) {
  return (
    <>
      <Initial p={p} />
      <span className="line-text">
        <bdi className={strong ? 'line-name strong' : 'line-name'}>{p.firstName}</bdi>
        <span className="line-role">{label}</span>
      </span>
    </>
  );
}

export function TeamChart({ model, c }: { model: ChartModel; c: Copy }) {
  const num = (n: number) => n.toLocaleString(c.locale);
  const n = names(c);
  const max = (values: number[]) => Math.max(1, ...values);
  return (
    <>
      <section className="chart" aria-labelledby="chart-title" data-chart-state="ok">
        <div className="wrap">
          <div className="section-head">
            <h2 id="chart-title">{c.chartTitle}</h2>
            <p>{c.chartBody}</p>
            <span className="pill">{c.members(num(model.total))}</span>
          </div>

          {model.strip.length ? (
            <div className="strip" data-testid="team-strip">
              <span className="strip-label">
                {c.leadership} · {num(model.strip.length)}
              </span>
              <ul>
                {model.strip.map((p, i) => (
                  <li key={`s${i}`} className="chip">
                    <Line p={p} strong label={p.byDepartment ? n.department(p.department) : n.role(p.role)} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="boxes">
            {model.boxes.map((box, bi) => {
              const title =
                box.kind === 'lead'
                  ? [box.lead.firstName, n.role(box.lead.role), num(box.size)]
                  : [n.department(box.department), num(box.size)];
              return (
                <section className="box" key={`b${bi}`} data-box-kind={box.kind}>
                  <h3 data-box-title={box.kind}>
                    {title.map((part, pi) => (
                      <span key={pi}>
                        {pi ? ' · ' : ''}
                        <bdi>{part}</bdi>
                      </span>
                    ))}
                  </h3>
                  <ul>
                    {box.people.map((p, pi) => (
                      <li
                        key={`p${pi}`}
                        className={p.depth === 0 && box.people.length > 1 ? 'row row-lead' : 'row'}
                        style={p.depth > 1 ? { paddingInlineStart: `${(p.depth - 1) * 0.75 + 0.5}rem` } : undefined}
                      >
                        <Line p={p} strong={p.depth === 0 && box.people.length > 1} label={n.role(p.role)} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </section>

      {model.activity.length || model.other ? (
        <section className="activity" aria-labelledby="activity-title">
          <div className="wrap">
            <div className="section-head">
              <h2 id="activity-title">{c.activityTitle}</h2>
              <p>{c.activityBody}</p>
              <span className="pill">
                {c.sent} {num(model.totalSent)} · {c.received} {num(model.totalReceived)}
              </span>
            </div>
            <ul className="activity-grid">
              {model.activity.map((d) => {
                const m = max(d.daily);
                return (
                  <li className="activity-card" key={d.department ?? ''}>
                    <div className="activity-top">
                      <h3>{d.department ? n.department(d.department) : ''}</h3>
                      <span className="bars" dir="ltr" aria-hidden>
                        {d.daily.map((v, i) => (
                          <span key={i} style={{ height: `${v ? Math.max(12, Math.round((v / m) * 100)) : 8}%` }} className={v ? '' : 'bar-zero'} />
                        ))}
                      </span>
                    </div>
                    <dl>
                      <div>
                        <dt>{c.sent}</dt>
                        <dd>{num(d.sent)}</dd>
                      </div>
                      <div>
                        <dt>{c.received}</dt>
                        <dd>{num(d.received)}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
              {model.other ? (
                <li className="activity-card activity-other">
                  <div className="activity-top">
                    <h3>{c.other}</h3>
                    <span className="activity-note">{c.otherBody}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>{c.sent}</dt>
                      <dd>{num(model.other.sent)}</dd>
                    </div>
                    <div>
                      <dt>{c.received}</dt>
                      <dd>{num(model.other.received)}</dd>
                    </div>
                  </dl>
                </li>
              ) : null}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Shown when there is no chart to show. Never an error code, never a technical reason. */
export function ChartNotice({ c, state }: { c: Copy; state: 'empty' | 'unavailable' }) {
  return (
    <section className="chart chart-notice" aria-labelledby="chart-title" data-chart-state={state}>
      <div className="wrap notice-inner">
        <h2 id="chart-title">{state === 'empty' ? c.emptyTitle : c.unavailableTitle}</h2>
        <p>{state === 'empty' ? c.emptyBody : c.unavailableBody}</p>
      </div>
    </section>
  );
}
