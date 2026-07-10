import { Vec2, v, dot, dir, rot, add, scale } from "./vec2";
import { illinois } from "./roots";

/**
 * A cam groove, represented by its SUPPORT FUNCTION h(u) over an interval of the
 * outward-normal angle u, in the cam's local frame.
 *
 *   h(u) = perpendicular distance from the axle to the groove's tangent line at the
 *          point whose outward normal points along u.
 *
 * Two identities make this the natural representation for a cam:
 *
 *   1. A line departing tangentially at normal-angle u exerts torque T·h(u) about the
 *      axle. The support function IS the moment arm.
 *   2. The radius of curvature is ρ(u) = h(u) + h''(u), so arc length is ∫ρ du, which
 *      integrates in closed form. String payout needs no numerical differentiation, and
 *      the force curve inherits no differencing noise.
 *
 * WHY AN INTERVAL AND NOT A CIRCLE. A closed convex curve has h defined on all of
 * [0, 2π), and h must return to its starting value after one turn. But a compound cam
 * rotates about 300° through the draw, so a closed groove's moment arm cannot sweep
 * monotonically — and monotone moment arms are precisely what produces let-off. Real
 * cams resolve this by being SPIRALS: the track is a captured channel that overlaps
 * itself, its radius stepping back at the anchor post. The string cannot bridge the
 * hollow the way a free string would, because the channel walls hold it.
 *
 * So we define h only on [uMin, uMax], the arc the departure point actually visits,
 * which may span more than 2π. The condition h + h'' > 0 still has to hold pointwise —
 * that is the groove being locally convex, which is what the tangent construction needs.
 * There is no global convexity requirement, and none is physical.
 */
export interface Groove {
  readonly uMin: number;
  readonly uMax: number;
  /** Support function: moment arm at normal angle u. */
  h(u: number): number;
  dh(u: number): number;
  ddh(u: number): number;
  /**
   * Any antiderivative of the arc-length element: cumArc(b) - cumArc(a) is the arc length
   * between normal angles a and b. Equal to ∫h du + h'(u), since ∫(h + h'') du = ∫h du + h'.
   */
  cumArc(u: number): number;
}

/** Radius of curvature. Must be positive throughout [uMin, uMax] for the groove to be traceable. */
export const curvatureRadius = (g: Groove, u: number): number => g.h(u) + g.ddh(u);

/** Boundary point whose outward normal points along u, in the cam's local frame. */
export function boundary(g: Groove, u: number): Vec2 {
  const n = dir(u);
  const t = v(-n.y, n.x);
  return add(scale(n, g.h(u)), scale(t, g.dh(u)));
}

export const arcLength = (g: Groove, from: number, to: number): number => g.cumArc(to) - g.cumArc(from);

export function minCurvature(g: Groove, samples = 600): number {
  let m = Infinity;
  for (let i = 0; i <= samples; i++) {
    m = Math.min(m, curvatureRadius(g, g.uMin + ((g.uMax - g.uMin) * i) / samples));
  }
  return m;
}

export const isTraceable = (g: Groove): boolean => minCurvature(g) > 0;

/**
 * A circle of radius `r` whose centre is offset from the axle by (ex, ey).
 *
 * h(u) = r + ex·cos(u) + ey·sin(u), and h + h'' = r identically — an offset circle is
 * convex for any offset, because the first harmonic of a support function is exactly a
 * translation. This is the classic eccentric wheel of the original 1966 compound.
 */
export function eccentricGroove(r: number, ex = 0, ey = 0, uMin = -1, uMax = 10): Groove {
  return {
    uMin,
    uMax,
    h: (u) => r + ex * Math.cos(u) + ey * Math.sin(u),
    dh: (u) => -ex * Math.sin(u) + ey * Math.cos(u),
    ddh: (u) => -ex * Math.cos(u) - ey * Math.sin(u),
    // ∫h du + h'(u) collapses to r·u: an offset circle has constant curvature radius r.
    cumArc: (u) => r * u,
  };
}

/**
 * A spiral groove: h given by a natural cubic spline through control points, which may
 * span more than one turn. This is how real cam tracks are shaped, and how a digitised
 * or DFC-fitted profile will land.
 */
export function profileGroove(uMin: number, uMax: number, values: number[]): Groove {
  const n = values.length;
  if (n < 3) throw new Error("profileGroove needs at least 3 control points");
  const step = (uMax - uMin) / (n - 1);
  const y = values;

  // Natural cubic spline: solve for second derivatives m via the standard tridiagonal system.
  const m = new Array<number>(n).fill(0);
  const c = new Array<number>(n).fill(0);
  const d = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const denom = 4 - c[i - 1];
    c[i] = 1 / denom;
    d[i] = ((6 * (y[i + 1] - 2 * y[i] + y[i - 1])) / (step * step) - d[i - 1]) / denom;
  }
  for (let i = n - 2; i >= 1; i--) m[i] = d[i] - c[i] * m[i + 1];

  const seg = (u: number) => {
    const raw = (u - uMin) / step;
    const i = Math.max(0, Math.min(n - 2, Math.floor(raw)));
    return { i, t: raw - i };
  };

  // Cumulative ∫h du at each knot, so cumArc is O(1).
  const intAt = new Array<number>(n).fill(0);
  const segInt = (i: number, t: number): number => {
    const a = 1 - t;
    return (
      step *
      (y[i] * (t - (t * t) / 2) +
        y[i + 1] * ((t * t) / 2) +
        ((step * step) / 6) *
          (m[i] * (-(a ** 4) / 4 + (a * a) / 2 - 1 / 4) + m[i + 1] * ((t ** 4) / 4 - (t * t) / 2)))
    );
  };
  for (let i = 1; i < n; i++) intAt[i] = intAt[i - 1] + segInt(i - 1, 1);

  const h = (u: number) => {
    const { i, t } = seg(u);
    const a = 1 - t;
    return (
      y[i] * a + y[i + 1] * t + ((step * step) / 6) * (m[i] * (a ** 3 - a) + m[i + 1] * (t ** 3 - t))
    );
  };
  const dh = (u: number) => {
    const { i, t } = seg(u);
    const a = 1 - t;
    return (
      (y[i + 1] - y[i]) / step + (step / 6) * (m[i] * (-3 * a * a + 1) + m[i + 1] * (3 * t * t - 1))
    );
  };
  const ddh = (u: number) => {
    const { i, t } = seg(u);
    return m[i] * (1 - t) + m[i + 1] * t;
  };

  return {
    uMin,
    uMax,
    h,
    dh,
    ddh,
    cumArc: (u) => {
      const { i, t } = seg(u);
      return intAt[i] + segInt(i, t) + dh(u);
    },
  };
}

export interface Tangent {
  /** Normal angle at the departure point, in the cam's local frame. */
  u: number;
  point: Vec2;
  /** Moment arm about the axle: h(u). */
  armLength: number;
  /** Free (unwrapped) length from the departure point to the external point. */
  freeLength: number;
}

/**
 * Where a taut line to the external point `p` (cam frame, axle at origin) departs the groove.
 *
 * Solves g(u) = p·n̂(u) − h(u) = 0 on [uMin, uMax]. `handedness` says which side the line
 * leaves on: +1 means `p` lies in the +tangent direction from the departure point.
 *
 * A spiral groove overlaps itself, so several roots can share a handedness, about 2π apart.
 * `hint` picks the physically continuous branch. Roots further than π from the hint are
 * REJECTED rather than merely deprioritised: if the true departure point has walked off the
 * end of the defined arc, the nearest surviving root is an alias one full turn away, and
 * silently taking it corrupts the wrap length instead of failing.
 */

/**
 * The two tangent lines from an external point touch a near-circular groove at normal angles
 * roughly π apart, so a window this wide around the hint captures the wanted one and excludes
 * both its opposite-handedness twin and its aliases a full turn away.
 */
const NARROW_WINDOW = 1.5;

export function tangentFrom(g: Groove, p: Vec2, handedness: 1 | -1, hint?: number): Tangent {
  const gf = (u: number) => dot(p, dir(u)) - g.h(u);
  /** Offset of p along the tangent line from the departure point; its sign is the handedness. */
  const offset = (u: number) => {
    const n = dir(u);
    return dot(p, v(-n.y, n.x)) - g.dh(u);
  };

  /** Scan [lo, hi] for sign changes of gf, refining each with Illinois, and keep the wanted side. */
  const scan = (lo: number, hi: number, samples: number): number[] => {
    const roots: number[] = [];
    const step = (hi - lo) / samples;
    const accept = (u: number) => {
      if (Math.sign(offset(u)) === handedness) roots.push(u);
    };
    let prevU = lo;
    let prevG = gf(prevU);
    if (prevG === 0) accept(prevU);
    for (let i = 1; i <= samples; i++) {
      const u = lo + step * i;
      const cur = gf(u);
      // A root can land exactly on a sample point — at brace it lands exactly on u = 0.
      if (cur === 0) accept(u);
      else if (prevG !== 0 && prevG * cur < 0) accept(illinois(gf, prevU, u, 1e-12));
      prevU = u;
      prevG = cur;
    }
    return roots;
  };

  // This is the innermost loop of the simulator — the solver calls it inside two nested
  // root-finds. The departure point sits within about a radian of the hint, so scan a narrow
  // window first and only fall back to the full ±π if that misses. Roots beyond ±π are aliases
  // one turn away on a spiral groove, and taking one silently corrupts the wrap length.
  let roots: number[] = [];
  if (hint !== undefined) {
    roots = scan(
      Math.max(g.uMin, hint - NARROW_WINDOW),
      Math.min(g.uMax, hint + NARROW_WINDOW),
      24,
    );
  }
  if (roots.length === 0) {
    const lo = hint === undefined ? g.uMin : Math.max(g.uMin, hint - Math.PI);
    const hi = hint === undefined ? g.uMax : Math.min(g.uMax, hint + Math.PI);
    roots = scan(lo, hi, 96);
  }

  if (roots.length === 0) {
    throw new Error(
      `No tangent with handedness ${handedness} near u = ${hint?.toFixed(2)} ` +
        `on the groove's arc [${g.uMin.toFixed(2)}, ${g.uMax.toFixed(2)}]`,
    );
  }
  const u =
    hint === undefined
      ? roots[0]
      : roots.reduce((best, r) => (Math.abs(r - hint) < Math.abs(best - hint) ? r : best));

  return { u, point: boundary(g, u), armLength: g.h(u), freeLength: Math.abs(offset(u)) };
}

/** The groove's working arc as a polyline in the cam's local frame, for rendering. */
export function outline(g: Groove, samples = 320): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= samples; i++) pts.push(boundary(g, g.uMin + ((g.uMax - g.uMin) * i) / samples));
  return pts;
}

export const toWorld = (axle: Vec2, theta: number, pLocal: Vec2): Vec2 => add(axle, rot(pLocal, theta));
export const toLocal = (axle: Vec2, theta: number, pWorld: Vec2): Vec2 =>
  rot({ x: pWorld.x - axle.x, y: pWorld.y - axle.y }, -theta);
