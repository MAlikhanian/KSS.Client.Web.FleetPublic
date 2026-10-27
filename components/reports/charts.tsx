import type { Chart } from './schema';
import { faNumber, tehranDay, tehranDayKey, tehranDateTime, tehranTime } from './format';

/**
 * Report charts, drawn on the server as SVG or plain HTML: no chart library and no client JavaScript.
 * - line: an SVG plot. A time x-axis (ISO-8601 UTC values) is spaced by time and labelled in Tehran time; a category
 *   x-axis is spaced evenly.
 * - bar: horizontal bars in HTML, one row per x value, which reads naturally right to left with long Persian labels.
 * - pie: an SVG ring with an HTML legend (value and share).
 * Every number is shown in Persian digits, and each chart carries a screen-reader table of its values.
 */

const PALETTE = ['var(--dept-engineering)', 'var(--dept-support)', 'var(--dept-network)', 'var(--dept-executive)', 'var(--dept-other)'];
const colour = (i: number) => PALETTE[i % PALETTE.length];

/** The x value as a person reads it: a Tehran date and time for an ISO time, the label itself otherwise. */
const xText = (chart: Chart, x: string) => (chart.xKind === 'time' ? tehranDateTime(x) : x);

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function DataTable({ chart }: { chart: Chart }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{chart.title}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {chart.series.map((s, i) => (
              <th key={i} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.series[0].points.map(([x], r) => (
            <tr key={r}>
              <th scope="row">{xText(chart, x)}</th>
              {chart.series.map((s, i) => (
                <td key={i}>{s.points[r] ? `${faNumber(s.points[r][1])} ${chart.unit}` : ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend({ chart }: { chart: Chart }) {
  if (chart.series.length < 2 || chart.type === 'pie') return null;
  return (
    <ul className="rpt-legend" aria-hidden>
      {chart.series.map((s, i) => (
        <li key={i}>
          <span className="rpt-swatch" style={{ background: colour(i) }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function LineChart({ chart }: { chart: Chart }) {
  const W = 640;
  const H = 260;
  const m = { l: 52, r: 20, t: 20, b: 48 };
  const all = chart.series.flatMap((s) => s.points);
  const maxY = niceMax(Math.max(...all.map(([, y]) => y)));
  const minY = Math.min(0, ...all.map(([, y]) => y));
  const xs = chart.series[0].points.map(([x]) => x);
  const times = chart.xKind === 'time' ? all.map(([x]) => Date.parse(x)) : [];
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const xPos = (x: string, idx: number) => {
    const w = W - m.l - m.r;
    if (chart.xKind === 'time') return m.l + (t1 === t0 ? w / 2 : ((Date.parse(x) - t0) / (t1 - t0)) * w);
    return m.l + (xs.length === 1 ? w / 2 : (idx / (xs.length - 1)) * w);
  };
  const yPos = (y: number) => m.t + (1 - (y - minY) / (maxY - minY || 1)) * (H - m.t - m.b);
  const ticks = [0, 1, 2, 3, 4].map((k) => minY + ((maxY - minY) * k) / 4);
  const sameDay = chart.xKind === 'time' && new Set(xs.map(tehranDayKey)).size === 1;
  // x labels: points spaced by time can sit close together, so a label is drawn only when it is far enough from the
  // last one drawn; the final point always gets its label, replacing a too-close neighbour.
  const shownX: number[] = [];
  xs.forEach((x, i) => {
    const px = xPos(x, i);
    const last = shownX[shownX.length - 1];
    if (last === undefined || px - xPos(xs[last], last) >= 64) shownX.push(i);
    else if (i === xs.length - 1) shownX[shownX.length - 1] = i;
  });
  // Value labels: one is skipped when it would overlap the previous one drawn in the same series.
  const valueShown = (pts: [string, number][]) => {
    const keep = new Set<number>();
    let prev: { x: number; y: number } | null = null;
    pts.forEach(([x, y], i) => {
      const p = { x: xPos(x, i), y: yPos(y) };
      if (!prev || Math.abs(p.x - prev.x) >= 22 || Math.abs(p.y - prev.y) >= 16) {
        keep.add(i);
        prev = p;
      }
    });
    return keep;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rpt-svg" style={{ direction: 'ltr' }} role="img" aria-label={chart.title}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={m.l} x2={W - m.r} y1={yPos(t)} y2={yPos(t)} className="rpt-grid" />
          <text x={m.l - 8} y={yPos(t) + 4} textAnchor="end" className="rpt-tick">
            {faNumber(t, 1)}
          </text>
        </g>
      ))}
      {xs.map((x, i) =>
        shownX.includes(i) ? (
          <text key={i} x={xPos(x, i)} y={H - m.b + 18} textAnchor="middle" className="rpt-tick">
            {chart.xKind === 'time' ? (
              <>
                <tspan x={xPos(x, i)}>{sameDay ? tehranTime(x) : tehranDay(x)}</tspan>
                {sameDay ? null : (
                  <tspan x={xPos(x, i)} dy="14">
                    {tehranTime(x)}
                  </tspan>
                )}
              </>
            ) : (
              x
            )}
          </text>
        ) : null,
      )}
      {chart.series.map((s, si) => {
        const values = valueShown(s.points);
        return (
        <g key={si} style={{ color: colour(si) }}>
          <polyline fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" points={s.points.map(([x, y], i) => `${xPos(x, i)},${yPos(y)}`).join(' ')} />
          {s.points.map(([x, y], i) => (
            <g key={i}>
              <circle cx={xPos(x, i)} cy={yPos(y)} r={3.5} fill="currentColor" />
              {values.has(i) ? (
                <text x={xPos(x, i)} y={yPos(y) - 9} textAnchor="middle" className="rpt-value">
                  {faNumber(y)}
                </text>
              ) : null}
            </g>
          ))}
        </g>
        );
      })}
    </svg>
  );
}

function BarChart({ chart }: { chart: Chart }) {
  const max = Math.max(1, ...chart.series.flatMap((s) => s.points.map(([, y]) => Math.abs(y))));
  const rows = chart.series[0].points.map(([x]) => x);
  return (
    <ul className="rpt-bars" aria-hidden>
      {rows.map((x, r) => (
        <li key={r} className="rpt-bar-row">
          <span className="rpt-bar-label">{xText(chart, x)}</span>
          <span className="rpt-bar-cells">
            {chart.series.map((s, si) => {
              const y = s.points[r]?.[1];
              if (y === undefined) return null;
              return (
                <span key={si} className="rpt-bar-line">
                  <span className="rpt-bar" style={{ width: `${Math.max(1.5, (Math.abs(y) / max) * 100)}%`, background: colour(si) }} />
                  <span className="rpt-bar-value">
                    {faNumber(y)} {chart.unit}
                  </span>
                </span>
              );
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PieChart({ chart }: { chart: Chart }) {
  const pts = chart.series[0].points.filter(([, y]) => y > 0);
  const total = pts.reduce((a, [, y]) => a + y, 0) || 1;
  const R = 70;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="rpt-pie">
      <svg viewBox="0 0 180 180" className="rpt-pie-svg" aria-hidden>
        <circle cx={90} cy={90} r={R} fill="none" className="rpt-pie-track" strokeWidth={28} />
        {pts.map(([, y], i) => {
          const len = (y / total) * C;
          const el = (
            <circle
              key={i}
              cx={90}
              cy={90}
              r={R}
              fill="none"
              stroke={colour(i)}
              strokeWidth={28}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 90 90)"
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      <ul className="rpt-legend rpt-legend-col" aria-hidden>
        {pts.map(([x, y], i) => (
          <li key={i}>
            <span className="rpt-swatch" style={{ background: colour(i) }} />
            <span className="rpt-legend-label">{xText(chart, x)}</span>
            <span className="rpt-legend-value">
              {faNumber(y)} {chart.unit} ({faNumber((y / total) * 100, 0)}٪)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportChart({ chart }: { chart: Chart | undefined }) {
  if (!chart) return null;
  return (
    <figure className="rpt-chart" data-chart-type={chart.type} data-testid="report-chart">
      <figcaption className="rpt-chart-title">
        {chart.title}
        {chart.unit ? <span className="rpt-chart-unit"> ({chart.unit})</span> : null}
      </figcaption>
      {chart.type === 'line' ? <LineChart chart={chart} /> : chart.type === 'bar' ? <BarChart chart={chart} /> : <PieChart chart={chart} />}
      <Legend chart={chart} />
      <DataTable chart={chart} />
    </figure>
  );
}
