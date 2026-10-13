import { cn } from "./cn";

export interface BarSeries {
  key: string;
  label: string;
  /** A colour token reference, e.g. var(--dept-network). */
  color: string;
  values: number[];
}

/**
 * A stacked bar chart drawn with plain boxes: one column per label, oldest first, left to right in every language
 * (a time axis). A column's height is its total against the largest total, and its total is printed above it.
 * The drawing is hidden from screen readers; a visually hidden table carries every value instead.
 */
export function StackedBars({
  labels,
  series,
  caption,
  seriesHeader,
  format,
  className,
}: {
  labels: string[];
  series: BarSeries[];
  caption: string;
  seriesHeader: string;
  format: (v: number) => string;
  className?: string;
}) {
  const totals = labels.map((_, i) =>
    series.reduce((acc, s) => acc + (s.values[i] ?? 0), 0),
  );
  const max = Math.max(1, ...totals);
  return (
    <figure
      className={cn("m-0 grid min-w-0 gap-3", className)}
      data-testid="stacked-bars"
    >
      <div aria-hidden dir="ltr" className="grid min-w-0 gap-1.5">
        <div className="grid h-52 grid-flow-col [grid-auto-columns:minmax(0,1fr)] items-end gap-1.5 border-b border-border pt-6 sm:gap-3 lg:h-64">
          {labels.map((label, i) => (
            <div
              key={label}
              className="relative min-w-0"
              style={{
                height: `${Math.max(totals[i] ? 2 : 0, (totals[i] / max) * 100)}%`,
              }}
              data-total={totals[i]}
            >
              <span className="absolute inset-x-0 -top-5 text-center text-xs font-semibold text-muted-foreground tabular-nums">
                {format(totals[i])}
              </span>
              <div className="flex h-full flex-col-reverse overflow-hidden rounded-t-[4px]">
                {series.map((s) =>
                  s.values[i] > 0 ? (
                    <span
                      key={s.key}
                      className="block min-h-px"
                      style={{
                        height: `${(s.values[i] / totals[i]) * 100}%`,
                        background: s.color,
                      }}
                    />
                  ) : null,
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-flow-col gap-1.5 [grid-auto-columns:minmax(0,1fr)] sm:gap-3">
          {labels.map((label) => (
            <span
              key={label}
              className="min-w-0 truncate text-center text-xs text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <ul
        className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-xs"
        data-testid="chart-legend"
      >
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: s.color }}
              aria-hidden
            />
            <span>{s.label}</span>
            <span className="font-semibold tabular-nums">
              {format(s.values.reduce((a, b) => a + b, 0))}
            </span>
          </li>
        ))}
      </ul>
      {/* sr-only on a <table> itself does not clip its cells, so the wrapper carries it. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{seriesHeader}</th>
              {labels.map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.key}>
                <th scope="row">{s.label}</th>
                {s.values.map((v, i) => (
                  <td key={i}>{format(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
