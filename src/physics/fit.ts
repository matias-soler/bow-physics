import { CamKnobs, makeCam } from "./cams";
import { BowSpec, buildBow, buildBowShape } from "./bows";
import { drawCurve, DrawCurve } from "./solve";
import { minCurvature } from "./support";
import { M_TO_IN, N_TO_LBF } from "./bow";

/** Nelder-Mead simplex. Derivative-free, which suits an objective that runs a whole solver. */
export function nelderMead(
  f: (x: number[]) => number,
  x0: number[],
  step: number[],
  iters = 800,
): { x: number[]; fx: number } {
  const n = x0.length;
  const simplex = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    p[i] += step[i];
    simplex.push(p);
  }
  const vals = simplex.map(f);

  const centroid = (excl: number): number[] => {
    const c = new Array(n).fill(0);
    for (let i = 0; i < simplex.length; i++) {
      if (i === excl) continue;
      for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
    }
    return c;
  };
  const comb = (a: number[], b: number[], t: number) => a.map((ai, i) => ai + t * (b[i] - ai));

  for (let it = 0; it < iters; it++) {
    const order = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
    const best = order[0];
    const worst = order[n];
    const second = order[n - 1];
    if (Math.abs(vals[worst] - vals[best]) < 1e-12) break;

    const c = centroid(worst);
    const refl = comb(simplex[worst], c, 2);
    const fr = f(refl);

    if (fr < vals[best]) {
      const exp = comb(simplex[worst], c, 3);
      const fe = f(exp);
      if (fe < fr) { simplex[worst] = exp; vals[worst] = fe; } else { simplex[worst] = refl; vals[worst] = fr; }
    } else if (fr < vals[second]) {
      simplex[worst] = refl;
      vals[worst] = fr;
    } else {
      const con = comb(simplex[worst], c, 0.5);
      const fc = f(con);
      if (fc < vals[worst]) {
        simplex[worst] = con;
        vals[worst] = fc;
      } else {
        for (let i = 0; i < simplex.length; i++) {
          if (i === best) continue;
          simplex[i] = comb(simplex[i], simplex[best], 0.5);
          vals[i] = f(simplex[i]);
        }
      }
    }
  }
  const bestIdx = vals.indexOf(Math.min(...vals));
  return { x: simplex[bestIdx], fx: vals[bestIdx] };
}

/**
 * A target draw-force curve, as normalised force (fraction of peak) against stroke fraction.
 *
 * This is the shape a compound's DFC actually has, and the shape a manufacturer publishes:
 * a ramp off brace, a long plateau at peak, then the let-off plunge into the wall. Fitting
 * against the whole curve rather than against summary scalars gives the optimiser a gradient
 * everywhere and avoids the degenerate solutions that "hit these three numbers" admits.
 *
 * When real bow data arrives, this is where a digitised curve goes.
 */
export interface TargetCurve {
  /** Normalised force at stroke fraction s ∈ [0, 1]. f(0) must be 0; f(1) is (1 - letOff). */
  f(s: number): number;
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * The canonical compound shape. `rampEnd` is where the plateau begins, `plunge` where let-off
 * starts, and `hold` the fraction of peak still on the fingers at the wall.
 */
export const compoundTarget = (rampEnd: number, plunge: number, hold: number): TargetCurve => ({
  f: (s) => {
    if (s <= rampEnd) return smooth(s / rampEnd);
    if (s <= plunge) return 1;
    return 1 - (1 - hold) * smooth((s - plunge) / (1 - plunge));
  },
});

/** Resample a solved draw curve as normalised force against stroke fraction. */
export function normalisedCurve(c: DrawCurve, samples = 40): number[] {
  const st = c.states;
  const x0 = st[0].nockX;
  const x1 = st[st.length - 1].nockX;
  const out: number[] = [];
  let j = 0;
  for (let i = 0; i <= samples; i++) {
    const x = x0 + ((x1 - x0) * i) / samples;
    while (j < st.length - 2 && st[j + 1].nockX < x) j++;
    const a = st[j];
    const b = st[j + 1];
    const t = b.nockX === a.nockX ? 0 : (x - a.nockX) / (b.nockX - a.nockX);
    out.push((a.drawForce + t * (b.drawForce - a.drawForce)) / c.peakForce);
  }
  return out;
}

const STRING_BOUNDS = { lo: 0.018, hi: 0.075 };
const CABLE_BOUNDS = { lo: 0.0015, hi: 0.045 };

/**
 * Fit a cam's control points so the bow reproduces `target`.
 *
 * `drawStop` is not fitted: `buildBow` already solves it to hit the requested draw length, so
 * the two would fight. And limb stiffness is not fitted either — the normalised curve is
 * invariant under it, since draw force is exactly linear in limb torque.
 *
 * The penalties encode what makes a shape a cam rather than a scribble: the tracks must be
 * monotone (string growing, cable shrinking), stay in a machinable range, and satisfy
 * h + h'' > 0 so a line can lie in the track at all.
 */
export function fitCam(
  seed: CamKnobs,
  target: TargetCurve,
  spec: Omit<BowSpec, "cam">,
  iters = 3000,
): { knobs: CamKnobs; report: string; loss: number } {
  const ns = seed.string.length;
  const pack = (k: CamKnobs) => [...k.string, ...k.cable];
  const unpack = (x: number[]): CamKnobs => ({
    string: x.slice(0, ns),
    cable: x.slice(ns),
    drawStop: seed.drawStop,
  });

  const SAMPLES = 36;
  const wanted = Array.from({ length: SAMPLES + 1 }, (_, i) => target.f(i / SAMPLES));

  const objective = (x: number[]): number => {
    const k = unpack(x);
    let penalty = 0;
    const clampPen = (v: number, lo: number, hi: number) =>
      v < lo ? (lo - v) ** 2 * 1e4 : v > hi ? (v - hi) ** 2 * 1e4 : 0;

    for (const v of k.string) penalty += clampPen(v, STRING_BOUNDS.lo, STRING_BOUNDS.hi);
    for (const v of k.cable) penalty += clampPen(v, CABLE_BOUNDS.lo, CABLE_BOUNDS.hi);

    // The cable track shrinks monotonically: that is the let-off collapse, and there is no reason
    // for it ever to grow back. This is a hard constraint — a growing cable arm is not a cam.
    for (let i = 1; i < k.cable.length; i++) penalty += Math.max(0, k.cable[i] - k.cable[i - 1]) ** 2 * 1e4;
    if (penalty > 0) return 1e3 + penalty;

    // The string track is NOT required to be monotone, and requiring it was a real mistake.
    //
    // Near the wall a cam wants its string radius to FALL — that is the "let-off shelf". It makes
    // dD/dr small, so the nock barely moves while the cam turns through the last of its rotation.
    // The cable arm then finishes collapsing without the let-off plunge eating any of the power
    // stroke, which is how a real bow keeps its force plateau long AND lets off hard. Forbidding it
    // capped storage efficiency around 66%.
    //
    // What DOES need constraining is smoothness — a cam track is machined, not scribbled. This is a
    // soft roughness term added to the fit error below, not a gate, so a curved track is allowed;
    // only a jagged one is discouraged.
    let roughness = 0;
    for (let i = 1; i < k.string.length - 1; i++) {
      roughness += (k.string[i + 1] - 2 * k.string[i] + k.string[i - 1]) ** 2;
    }

    let bow;
    try {
      const cam = makeCam("fit", k);
      if (minCurvature(cam.stringGroove) < 1e-3) return 1e6;
      if (minCurvature(cam.cableGroove) < 4e-4) return 1e6;
      bow = buildBowShape({ ...spec, cam });
    } catch {
      return 1e6;
    }

    let c: DrawCurve;
    try {
      c = drawCurve(bow, 96);
    } catch {
      return 1e6;
    }
    if (!isFinite(c.peakForce) || c.peakForce <= 0) return 1e6;

    const got = normalisedCurve(c, SAMPLES);
    let sse = 0;
    for (let i = 0; i <= SAMPLES; i++) sse += (got[i] - wanted[i]) ** 2;
    return sse / (SAMPLES + 1) + 3e3 * roughness;
  };

  const x0 = pack(seed);
  const step = x0.map((_, i) => (i < ns ? 0.0025 : 0.0018));
  const { x, fx } = nelderMead(objective, x0, step, iters);
  const knobs = unpack(x);

  const bow = buildBow({ ...spec, cam: makeCam("fit", knobs) });
  const c = drawCurve(bow, 400);
  const report =
    `loss ${fx.toExponential(2)}  ` +
    `peak ${(c.peakForce * N_TO_LBF).toFixed(1)} lb  ` +
    `let-off ${(c.letOff * 100).toFixed(1)}%  ` +
    `storage ${(c.storageEfficiency * 100).toFixed(1)}%  ` +
    `draw ${(c.drawLength * M_TO_IN).toFixed(2)}"  ` +
    `brace ${(c.braceHeight * M_TO_IN).toFixed(2)}"`;
  return { knobs, report, loss: fx };
}
