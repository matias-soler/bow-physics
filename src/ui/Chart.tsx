import { ReactNode, useMemo } from "react";

export interface Series {
  points: [number, number][];
  color: string;
  label: string;
  /** Draw against the right-hand axis instead of the left. */
  secondary?: boolean;
  dashed?: boolean;
}

interface Props {
  series: Series[];
  xLabel: string;
  yLabel: string;
  y2Label?: string;
  /** Vertical rule at the current draw position. */
  cursorX?: number;
  height?: number;
  /** Shade the area under the first series — stored energy is the integral of the force curve. */
  fillFirst?: boolean;
  children?: ReactNode;
}

const W = 460;
const PAD = { l: 46, r: 46, t: 12, b: 30 };

const niceTicks = (lo: number, hi: number, count = 5): number[] => {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(t);
  return ticks;
};

export function Chart({ series, xLabel, yLabel, y2Label, cursorX, height = 210, fillFirst }: Props) {
  const H = height;
  const bounds = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const prim = series.filter((s) => !s.secondary).flatMap((s) => s.points);
    const sec = series.filter((s) => s.secondary).flatMap((s) => s.points);
    const xs = all.map((p) => p[0]);
    return {
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: 0,
      y1: Math.max(...prim.map((p) => p[1]), 1e-9) * 1.08,
      s0: 0,
      s1: sec.length ? Math.max(...sec.map((p) => p[1])) * 1.08 : 1,
    };
  }, [series]);

  const sx = (x: number) => PAD.l + ((x - bounds.x0) / (bounds.x1 - bounds.x0)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => H - PAD.b - ((y - bounds.y0) / (bounds.y1 - bounds.y0)) * (H - PAD.t - PAD.b);
  const sy2 = (y: number) => H - PAD.b - ((y - bounds.s0) / (bounds.s1 - bounds.s0)) * (H - PAD.t - PAD.b);

  const line = (s: Series) =>
    s.points.map((p, i) => `${i ? "L" : "M"}${sx(p[0]).toFixed(2)},${(s.secondary ? sy2 : sy)(p[1]).toFixed(2)}`).join("");

  const first = series[0];

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      {niceTicks(bounds.y0, bounds.y1).map((t) => (
        <g key={`y${t}`}>
          <line x1={PAD.l} y1={sy(t)} x2={W - PAD.r} y2={sy(t)} stroke="var(--grid)" strokeWidth={1} />
          <text x={PAD.l - 6} y={sy(t) + 3.5} textAnchor="end" className="tick">{t.toFixed(t < 10 ? 1 : 0)}</text>
        </g>
      ))}
      {y2Label && niceTicks(bounds.s0, bounds.s1).map((t) => (
        <text key={`y2${t}`} x={W - PAD.r + 6} y={sy2(t) + 3.5} textAnchor="start" className="tick tick-2">
          {t.toFixed(t < 10 ? 1 : 0)}
        </text>
      ))}
      {niceTicks(bounds.x0, bounds.x1).map((t) => (
        <text key={`x${t}`} x={sx(t)} y={H - PAD.b + 15} textAnchor="middle" className="tick">{t.toFixed(0)}</text>
      ))}

      {fillFirst && first && (
        <path
          d={`${line(first)}L${sx(first.points[first.points.length - 1][0])},${sy(0)}L${sx(first.points[0][0])},${sy(0)}Z`}
          fill={first.color}
          opacity={0.1}
        />
      )}

      {series.map((s) => (
        <path
          key={s.label}
          d={line(s)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.secondary ? 1.5 : 2}
          strokeDasharray={s.dashed ? "4 3" : undefined}
        />
      ))}

      {cursorX !== undefined && cursorX >= bounds.x0 && cursorX <= bounds.x1 && (
        <line x1={sx(cursorX)} y1={PAD.t} x2={sx(cursorX)} y2={H - PAD.b} stroke="var(--cursor)" strokeWidth={1.5} />
      )}

      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--axis)" strokeWidth={1} />
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--axis)" strokeWidth={1} />

      <text x={W / 2} y={H - 3} textAnchor="middle" className="axis-label">{xLabel}</text>
      <text x={10} y={H / 2} textAnchor="middle" className="axis-label" transform={`rotate(-90 10 ${H / 2})`}>{yLabel}</text>
      {y2Label && (
        <text x={W - 8} y={H / 2} textAnchor="middle" className="axis-label" transform={`rotate(-90 ${W - 8} ${H / 2})`}>
          {y2Label}
        </text>
      )}
    </svg>
  );
}
