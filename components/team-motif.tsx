/**
 * An abstract organisation chart drawn in the team's role colours: one lead,
 * the teams under it, and the members of each team.
 *
 * It is an ILLUSTRATION, not data. The number of nodes is fixed and says
 * nothing about the real team's size or shape; the live chart replaces it.
 * Rows appear one after another on load (the page's only motion), and not at
 * all when the visitor prefers reduced motion.
 */

const ROLE = {
  lead: 'var(--role-cyan)',
  chief: 'var(--role-blue)',
  office: 'var(--role-violet)',
  advisor: 'var(--role-pink)',
  engineer: 'var(--role-amber)',
  support: 'var(--role-red)',
  legal: 'var(--role-green)',
  ops: 'var(--role-orange)',
};

type Node = { x: number; y: number; color: string; size: number };

const W = 480;
const ROWS: { y: number; nodes: { x: number; color: string }[]; size: number }[] = [
  { y: 40, size: 22, nodes: [{ x: 240, color: ROLE.lead }] },
  {
    y: 128,
    size: 17,
    nodes: [
      { x: 96, color: ROLE.chief },
      { x: 192, color: ROLE.office },
      { x: 288, color: ROLE.advisor },
      { x: 384, color: ROLE.chief },
    ],
  },
  {
    y: 214,
    size: 12,
    nodes: [
      { x: 52, color: ROLE.engineer },
      { x: 96, color: ROLE.engineer },
      { x: 140, color: ROLE.engineer },
      { x: 340, color: ROLE.support },
      { x: 384, color: ROLE.legal },
      { x: 428, color: ROLE.ops },
    ],
  },
  {
    y: 284,
    size: 12,
    nodes: [
      { x: 52, color: ROLE.engineer },
      { x: 96, color: ROLE.engineer },
      { x: 140, color: ROLE.engineer },
      { x: 340, color: ROLE.support },
      { x: 384, color: ROLE.support },
      { x: 428, color: ROLE.support },
    ],
  },
];

function parentOf(row: number, x: number): Node | null {
  if (row === 0) return null;
  const above = ROWS[row - 1];
  // Each node hangs from the nearest node in the row above.
  const nearest = above.nodes.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
  return { x: nearest.x, y: above.y, color: nearest.color, size: above.size };
}

export function TeamMotif({ label }: { label: string }) {
  return (
    <figure className="motif">
      <svg viewBox={`0 0 ${W} 320`} role="img" aria-label={label}>
        {ROWS.map((row, r) => (
          <g key={row.y} className="motif-row" style={{ animationDelay: `${r * 140}ms` }}>
            {row.nodes.map((n) => {
              const p = parentOf(r, n.x);
              return (
                <g key={`${n.x}-${row.y}`}>
                  {p ? (
                    <path
                      className="motif-link"
                      d={`M${p.x} ${p.y + p.size} V${(p.y + row.y) / 2} H${n.x} V${row.y - row.size}`}
                    />
                  ) : null}
                  <rect
                    x={n.x - row.size}
                    y={row.y - row.size}
                    width={row.size * 2}
                    height={row.size * 2}
                    rx={row.size * 0.55}
                    fill={n.color}
                  />
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </figure>
  );
}
