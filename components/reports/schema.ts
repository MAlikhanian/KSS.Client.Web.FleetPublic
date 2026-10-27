import { isIsoUtc } from './format';

/**
 * The shape of a report's data file (report.data.json). The file comes from outside the repository (a mounted
 * ConfigMap), so it is checked field by field: a malformed item is dropped and counted, never fatal; only a missing
 * or malformed slug rejects the whole report.
 */

export const SLUG = /^[a-z0-9-]+$/;
const CHART_ID = /^[a-z0-9-]+$/;
export const CHART_TYPES = ['line', 'bar', 'pie'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export interface TimelineItem {
  at: string;
  title: string;
  detail: string | null;
  kind: string | null;
}

export interface ChartSeries {
  label: string;
  /** [x, y]: x is an ISO-8601 UTC time or a category label; y is a number. */
  points: [string, number][];
}

export interface Chart {
  id: string;
  title: string;
  type: ChartType;
  unit: string;
  series: ChartSeries[];
  /** "time" when every x is an ISO-8601 UTC string, otherwise "category". */
  xKind: 'time' | 'category';
}

export interface Figure {
  label: string;
  value: number;
  unit: string;
}

export interface ReportData {
  slug: string;
  timeline: TimelineItem[];
  charts: Chart[];
  figures: Figure[];
  /** How many malformed items were dropped, for the server log. */
  dropped: number;
}

const str = (v: unknown, max = 2000): string | null => (typeof v === 'string' && v.trim() !== '' && v.length <= max ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export type ParseResult = { ok: true; data: ReportData } | { ok: false; reason: string };

export function parseReportData(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'NOT_AN_OBJECT' };
  const o = raw as Record<string, unknown>;
  const slug = typeof o.slug === 'string' && SLUG.test(o.slug) && o.slug.length <= 100 ? o.slug : null;
  if (!slug) return { ok: false, reason: 'SLUG_INVALID' };
  let dropped = 0;

  const timeline: TimelineItem[] = [];
  for (const it of arr(o.timeline)) {
    const r = (it ?? {}) as Record<string, unknown>;
    const title = str(r.title_fa);
    if (!isIsoUtc(r.at) || !title) {
      dropped++;
      continue;
    }
    timeline.push({ at: r.at, title, detail: str(r.detail_fa, 8000), kind: str(r.kind, 40) });
  }
  timeline.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const charts: Chart[] = [];
  const ids = new Set<string>();
  for (const it of arr(o.charts)) {
    const c = (it ?? {}) as Record<string, unknown>;
    const id = typeof c.id === 'string' && CHART_ID.test(c.id) ? c.id : null;
    const title = str(c.title_fa);
    const type = CHART_TYPES.find((t) => t === c.type) ?? null;
    if (!id || ids.has(id) || !title || !type) {
      dropped++;
      continue;
    }
    const series: ChartSeries[] = [];
    for (const s of arr(c.series)) {
      const so = (s ?? {}) as Record<string, unknown>;
      const points: [string, number][] = [];
      for (const p of arr(so.points)) {
        const x = Array.isArray(p) ? p[0] : undefined;
        const y = Array.isArray(p) ? num(p[1]) : null;
        if (Array.isArray(p) && p.length === 2 && typeof x === 'string' && x.trim() !== '' && x.length <= 200 && y !== null) points.push([x, y]);
        else dropped++;
      }
      if (points.length) series.push({ label: str(so.label_fa, 200) ?? '', points });
      else dropped++;
    }
    if (!series.length) {
      dropped++;
      continue;
    }
    const xKind = series.every((s) => s.points.every(([x]) => isIsoUtc(x))) ? 'time' : 'category';
    if (xKind === 'time') for (const s of series) s.points.sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]));
    ids.add(id);
    charts.push({ id, title, type, unit: typeof c.unit_fa === 'string' ? c.unit_fa.slice(0, 60) : '', series, xKind });
  }

  const figures: Figure[] = [];
  for (const it of arr(o.figures)) {
    const f = (it ?? {}) as Record<string, unknown>;
    const label = str(f.label_fa, 200);
    const value = num(f.value);
    if (!label || value === null) {
      dropped++;
      continue;
    }
    figures.push({ label, value, unit: typeof f.unit_fa === 'string' ? f.unit_fa.slice(0, 60) : '' });
  }

  return { ok: true, data: { slug, timeline, charts, figures, dropped } };
}
