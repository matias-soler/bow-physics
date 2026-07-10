import {
  Vec2, v, add, sub, scale, cross, dot, norm, dir, mirrorY,
} from "./vec2";
import { arcLength, boundary, tangentFrom, toLocal, toWorld } from "./support";
import { Bow, CABLE_HANDEDNESS, DRAW_LENGTH_OFFSET, STRING_HANDEDNESS } from "./bow";
import { illinois } from "./roots";

/** Position of the upper axle for limb deflection `phi`. Deflection swings the tip back and in. */
export function axle(bow: Bow, phi: number): Vec2 {
  return add(bow.pocket, scale(dir(bow.limb.restAngle - phi), bow.limb.length));
}

export interface BowState {
  /** Cam rotation from brace, radians. The independent variable of the whole solve. */
  camRotation: number;
  /** Limb deflection from unloaded, radians. */
  limbDeflection: number;
  /** Nock x-coordinate. */
  nockX: number;
  /** Draw length by the archery convention. */
  drawLength: number;
  /** Force the archer must hold, N. */
  drawForce: number;
  /** Bowstring tension, N. */
  stringTension: number;
  /** Buss cable tension, N (each of the two cables). */
  cableTension: number;
  /** Total strain energy in both limbs, above the brace value, J. */
  storedEnergy: number;
  /** String moment arm about the axle, m. */
  stringArm: number;
  /** Cable moment arm about the axle, m. */
  cableArm: number;
  /** Instantaneous mechanical advantage, stringArm / cableArm. Let-off lives here. */
  camRatio: number;
  /** d(nockX)/d(camRotation), m/rad. The cam's "gear ratio" to the arrow. */
  drawRate: number;

  // Geometry, for drawing.
  axle: Vec2;
  nock: Vec2;
  stringTangent: Vec2;
  cableTangent: Vec2;
  /** Local normal angle where the string departs the cam. */
  stringU: number;
  /** Local normal angle where the cable departs the cam. */
  cableU: number;
}

export interface Anchors {
  /** Local normal angle where the string terminates on the cam. */
  stringAnchorU: number;
  /** Local normal angle where the cable terminates on the cam. */
  cableAnchorU: number;
  /** Local normal angle where each line departs the cam at brace. */
  stringU0: number;
  cableU0: number;
}

/**
 * Where the string and cable terminate on the cam, in the cam's local normal-angle.
 *
 * At brace (cam rotation 0) the string leg is vertical by symmetry, so it departs the
 * cam exactly where the outward normal is +x — local angle 0. The string wraps from
 * there around to its anchor at larger u (handedness -1), so the anchor sits at
 * +stringWrapAtBrace. The cable is the mirror argument with the sign flipped.
 */
export function anchors(bow: Bow): Anchors {
  const A = axle(bow, bow.preload);
  const Ap = mirrorY(A);
  const cable = tangentFrom(bow.cam.cableGroove, toLocal(A, 0, Ap), CABLE_HANDEDNESS, Math.PI);
  return {
    stringU0: 0,
    cableU0: cable.u,
    stringAnchorU: bow.cam.stringWrapAtBrace,
    cableAnchorU: cable.u - bow.cam.cableWrapAtBrace,
  };
}

/**
 * As the cam turns by `r` the departure point advances by the same amount in the cam's
 * local frame, because the world direction of each line barely changes. That makes a good
 * enough branch hint for a spiral groove, whose roots sit about 2π apart.
 */
const stringHint = (an: Anchors, r: number) => an.stringU0 + r;
const cableHint = (an: Anchors, r: number) => an.cableU0 + r;

/** Total length of one buss cable: the arc spooled on the cam plus the free span to the far axle. */
function cableLength(bow: Bow, an: Anchors, r: number, phi: number): number {
  const omega = -r; // The upper cam turns clockwise as the bow is drawn.
  const A = axle(bow, phi);
  const Ap = mirrorY(A);
  const g = bow.cam.cableGroove;
  const tg = tangentFrom(g, toLocal(A, omega, Ap), CABLE_HANDEDNESS, cableHint(an, r));
  // Handedness +1: the cable runs from its anchor at smaller u round to the departure point.
  return arcLength(g, an.cableAnchorU, tg.u) + tg.freeLength;
}

/** Half the bowstring: the arc spooled on the upper cam plus the free leg to the nock. */
function stringHalfLength(bow: Bow, an: Anchors, r: number, phi: number, nockX: number): number {
  const omega = -r;
  const A = axle(bow, phi);
  const g = bow.cam.stringGroove;
  const tg = tangentFrom(g, toLocal(A, omega, v(nockX, 0)), STRING_HANDEDNESS, stringHint(an, r));
  // Handedness -1: the anchor sits at larger u, and drawing unwraps toward it.
  return arcLength(g, tg.u, an.stringAnchorU) + tg.freeLength;
}

/**
 * Derive the string and cable lengths implied by the brace configuration. Both are
 * inextensible, so these two numbers are what actually define the bow's kinematics;
 * `preload` and the cam's wrap angles are just a convenient way to author them.
 */
export function completeBow(spec: Omit<Bow, "stringLength" | "cableLength">): Bow {
  const partial = { ...spec, stringLength: 0, cableLength: 0 } as Bow;
  const an = anchors(partial);
  const A = axle(partial, partial.preload);
  // At brace the string departs at local u = 0, so the tangent line is x = A.x + h(0).
  const nockX = A.x + partial.cam.stringGroove.h(0);
  return {
    ...partial,
    cableLength: cableLength(partial, an, 0, partial.preload),
    stringLength: 2 * stringHalfLength(partial, an, 0, partial.preload, nockX),
  };
}

export interface Solver {
  bow: Bow;
  at(camRotation: number): BowState;
}

export function makeSolver(bow: Bow): Solver {
  const an = anchors(bow);
  const cam = bow.cam;

  const solveDeflection = (r: number): number =>
    illinois((phi) => cableLength(bow, an, r, phi) - bow.cableLength, bow.preload - 0.02, bow.preload + 0.9);

  /**
   * The nock position where the string leg stands vertical, for cam rotation `r`.
   *
   * A taut path from the cam to the line y = 0 is shortest when it meets that line at a
   * right angle, so this is the minimum of `stringHalfLength` over nockX. At brace it is
   * also the solution — which is why the string is straight there, and why the draw force
   * is zero. It gives us a guaranteed lower bracket for every r, and it keeps the solver
   * on the physical branch (drawn, not pushed through the bow).
   */
  const straightNock = (r: number, phi: number): number => axle(bow, phi).x + cam.stringGroove.h(r);

  const solveNock = (r: number, phi: number): number => {
    const lo = straightNock(r, phi);
    const target = bow.stringLength / 2;
    const f = (x: number) => stringHalfLength(bow, an, r, phi, x) - target;
    // At brace this is a tangency, not a crossing: f(lo) = 0 and f > 0 on both sides.
    if (f(lo) >= 0) return lo;
    return illinois(f, lo, axle(bow, phi).x + 1.2);
  };

  const at = (r: number): BowState => {
    const omega = -r;
    const phi = solveDeflection(r);
    const nockX = solveNock(r, phi);

    const A = axle(bow, phi);
    const Ap = mirrorY(A);
    const N = v(nockX, 0);
    const Pk = bow.pocket;

    const tgS = tangentFrom(cam.stringGroove, toLocal(A, omega, N), STRING_HANDEDNESS, stringHint(an, r));
    const tgC = tangentFrom(cam.cableGroove, toLocal(A, omega, Ap), CABLE_HANDEDNESS, cableHint(an, r));

    const Ps = toWorld(A, omega, tgS.point);
    const Pc = toWorld(A, omega, tgC.point);
    // The lower cam's cable terminates on THIS axle, pulling it toward the lower cam.
    const PcLower = mirrorY(Pc);

    const uS = norm(sub(N, Ps)); // direction the string pulls the cam
    const uC = norm(sub(Ap, Pc)); // direction this cam's cable pulls the cam
    const uC2 = norm(sub(PcLower, A)); // direction the other cable pulls this axle

    const hs = tgS.armLength;
    const hc = tgC.armLength;

    // Cam torque balance about the axle fixes the tension ratio:
    //   s_s·T_s·h_s + s_c·T_c·h_c = 0,  with s_s = -1, s_c = +1
    const ratio = hs / hc; // T_cable = ratio · T_string

    // Limb torque balance about the pocket fixes the magnitude. The limb + cam are one
    // rigid body here (the axle is a frictionless pin, so it carries no moment), loaded
    // by the string, by its own cable, and by the opposite cable landing on the axle.
    const B =
      cross(sub(Ps, Pk), uS) + ratio * (cross(sub(Pc, Pk), uC) + cross(sub(A, Pk), uC2));
    const tau = bow.limb.torque(phi);
    const stringTension = -tau / B;
    const cableTension = ratio * stringTension;

    // Both string legs pull the nock; their y-components cancel by symmetry.
    const drawForce = 2 * stringTension * uS.x;

    const storedEnergy = 2 * (bow.limb.energy(phi) - bow.limb.energy(bow.preload));

    return {
      camRotation: r,
      limbDeflection: phi,
      nockX,
      drawLength: nockX + DRAW_LENGTH_OFFSET,
      drawForce,
      stringTension,
      cableTension,
      storedEnergy,
      stringArm: hs,
      cableArm: hc,
      camRatio: hs / hc,
      drawRate: 0, // filled by the caller when sweeping; see `drawCurve`
      axle: A,
      nock: N,
      stringTangent: Ps,
      cableTangent: Pc,
      stringU: tgS.u,
      cableU: tgC.u,
    };
  };

  return { bow, at };
}

/** Arc of string left spooled on the cam, in radians of normal angle. Zero means it runs off. */
const WRAP_MARGIN = 0.15;

/**
 * The furthest the cam can turn: the draw stop, or the string running out of track.
 *
 * The departure point does NOT advance one radian per radian of cam rotation. It advances
 * by the cam rotation PLUS the rotation of the string leg's normal in the world frame, and
 * the leg swings by nearly a radian as the nock travels back. So the run-out point has to be
 * found, not assumed. `at` throws once the departure point leaves the groove's defined arc,
 * which bounds the search from above.
 */
const maxRotationCache = new WeakMap<Bow, number>();

export function maxRotation(bow: Bow): number {
  const hit = maxRotationCache.get(bow);
  if (hit !== undefined) return hit;

  const solver = makeSolver(bow);
  const anchorU = bow.cam.stringWrapAtBrace;
  const ok = (r: number): boolean => {
    try {
      return solver.at(r).stringU <= anchorU - WRAP_MARGIN;
    } catch {
      return false;
    }
  };
  let result = bow.cam.drawStop;
  if (!ok(result)) {
    let lo = 0;
    let hi = bow.cam.drawStop;
    for (let i = 0; i < 30; i++) {
      const mid = 0.5 * (lo + hi);
      if (ok(mid)) lo = mid;
      else hi = mid;
    }
    result = lo;
  }
  maxRotationCache.set(bow, result);
  return result;
}

export interface DrawCurve {
  states: BowState[];
  peakForce: number;
  peakForceAt: number;
  holdingForce: number;
  letOff: number;
  /** Energy stored at full draw, J. */
  storedEnergy: number;
  braceHeight: number;
  drawLength: number;
  /** Stored energy divided by (peak force × power stroke). 0.8 is a good modern bow. */
  storageEfficiency: number;
}

export function drawCurve(bow: Bow, samples = 400): DrawCurve {
  const solver = makeSolver(bow);
  const rMax = maxRotation(bow);
  const states: BowState[] = [];
  for (let i = 0; i <= samples; i++) states.push(solver.at((rMax * i) / samples));

  // Central differences for the gear ratio dD/dr.
  for (let i = 0; i < states.length; i++) {
    const lo = states[Math.max(0, i - 1)];
    const hi = states[Math.min(states.length - 1, i + 1)];
    states[i].drawRate = (hi.nockX - lo.nockX) / (hi.camRotation - lo.camRotation);
  }

  let peak = states[0];
  for (const s of states) if (s.drawForce > peak.drawForce) peak = s;
  const full = states[states.length - 1];
  const brace = states[0];

  const powerStroke = full.nockX - brace.nockX;
  return {
    states,
    peakForce: peak.drawForce,
    peakForceAt: peak.drawLength,
    holdingForce: full.drawForce,
    letOff: 1 - full.drawForce / peak.drawForce,
    storedEnergy: full.storedEnergy,
    braceHeight: brace.nockX,
    drawLength: full.drawLength,
    storageEfficiency: full.storedEnergy / (peak.drawForce * powerStroke),
  };
}

/**
 * The largest draw force anywhere on the curve.
 *
 * A coarse scan to bracket the maximum, then golden-section to sit on it. Sampling a dense draw
 * curve and taking its max costs several times more and is *less* accurate — it can only ever
 * land on a sample. A compound's peak is a broad smooth plateau, which is what golden-section
 * eats for breakfast.
 */
export function peakDrawForce(bow: Bow, coarse = 36): number {
  const solver = makeSolver(bow);
  const rMax = maxRotation(bow);
  const f = (r: number) => solver.at(r).drawForce;

  let bestI = 0;
  let bestF = -Infinity;
  for (let i = 0; i <= coarse; i++) {
    const val = f((rMax * i) / coarse);
    if (val > bestF) {
      bestF = val;
      bestI = i;
    }
  }
  // The round wheel peaks at the wall, so the bracket must be allowed to sit on an endpoint.
  let a = (rMax * Math.max(0, bestI - 1)) / coarse;
  let b = (rMax * Math.min(coarse, bestI + 1)) / coarse;

  const gr = (Math.sqrt(5) - 1) / 2;
  let c = b - gr * (b - a);
  let d = a + gr * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < 20 && b - a > 1e-6; i++) {
    if (fc > fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - gr * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + gr * (b - a);
      fd = f(d);
    }
  }
  return Math.max(bestF, fc, fd);
}

/**
 * Scale the limb's stiffness so the bow peaks at `targetPeak` newtons.
 *
 * Draw force is linear in limb torque (see `B` above: geometry is untouched by stiffness,
 * because the kinematics are set by the inextensible string and cable, not by force). So one
 * peak evaluation gives the scale factor exactly — no outer iteration needed.
 */
export function scaleToPeak(bow: Bow, targetPeak: number): number {
  return targetPeak / peakDrawForce(bow);
}

/** Energy by integrating the draw-force curve. Must agree with the limb strain energy. */
export function integrateWork(curve: DrawCurve): number {
  let w = 0;
  for (let i = 1; i < curve.states.length; i++) {
    const a = curve.states[i - 1];
    const b = curve.states[i];
    w += 0.5 * (a.drawForce + b.drawForce) * (b.nockX - a.nockX);
  }
  return w;
}

export { dot, boundary };
