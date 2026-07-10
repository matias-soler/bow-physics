import { Bow, Cam, IN_TO_M, LBF_TO_N } from "./bow";
import { TorsionLimb } from "./limb";
import { completeBow, makeSolver, maxRotation, scaleToPeak } from "./solve";
import { illinois } from "./roots";
import { hybridCam } from "./cams";
import { v } from "./vec2";

export interface BowSpec {
  name?: string;
  cam: Cam;
  /** Peak draw weight, pounds. */
  peakWeight: number;
  /** Draw length at the wall, inches (archery convention: nock to grip pivot + 1¾"). */
  drawLength: number;
  /** Axle-to-axle distance at brace, inches. */
  axleToAxle: number;
  /** Brace height, inches. */
  braceHeight: number;
  /** Limb deflection at brace, radians — the limb-bolt preload. Sets the initial force ramp. */
  preload?: number;
  limbLength?: number;
  restAngle?: number;
  /** Quadratic term of τ(φ), as a multiple of k0. Larger means the limb stiffens faster. */
  limbStiffening?: number;
  limbMass?: number;
  stringMass?: number;
}

export const DEFAULT_SPEC: Omit<BowSpec, "cam"> = {
  peakWeight: 70,
  drawLength: 29,
  axleToAxle: 32,
  braceHeight: 6.75,
};

/**
 * The three geometry knobs decouple, which is why this needs no outer iteration:
 *
 *   • Axle-to-axle and brace height are pure placement. The limb swings on a fixed-length
 *     bar, so once the deflection at brace is chosen the axle sits at a known offset from
 *     the pocket — invert that to place the pocket.
 *   • Draw length is set by the draw stop, exactly as on a real bow, where a rotating module
 *     or a stop peg decides where the cam quits turning. Kinematics are fixed by the
 *     inextensible string and cable, so the stop position does not depend on limb stiffness.
 *   • Peak weight scales the limb stiffness. Draw force is exactly linear in limb torque
 *     (see `B` in solve.ts), so one probe solve gives the factor.
 *
 * Solve them in that order and each is a closed form or a single monotone root-find.
 */
export const buildBow = (spec: BowSpec): Bow => build(spec, true);

/**
 * The bow with its geometry and cam timing solved, but limb stiffness left at an arbitrary
 * scale. Every shape property of the draw-force curve — let-off, storage efficiency, where
 * the peak falls — is invariant under limb stiffness, because draw force is exactly linear
 * in limb torque. So a fitter searching for those never needs the peak-weight solve.
 */
export const buildBowShape = (spec: BowSpec): Bow => build(spec, false);

function build(spec: BowSpec, scalePeak: boolean): Bow {
  const limbLength = spec.limbLength ?? 0.28;
  const restAngle = spec.restAngle ?? (55 * Math.PI) / 180;
  // Limb deflection already present at brace, from the limb bolt. This is what sets how steeply
  // the force ramps off brace: the initial slope is proportional to the string tension there,
  // which is proportional to the preload torque. The cam has nothing to do with it.
  const preload = spec.preload ?? 0.34;
  const ata = spec.axleToAxle * IN_TO_M;
  const brace = spec.braceHeight * IN_TO_M;

  // Place the pocket so the braced limb lands the axle at the requested height, and so the
  // braced string (tangent to the cam at local u = 0) stands at the requested brace height.
  const alpha = restAngle - preload;
  const pocket = v(
    brace - spec.cam.stringGroove.h(0) - limbLength * Math.cos(alpha),
    ata / 2 - limbLength * Math.sin(alpha),
  );

  const make = (cam: Cam, k0: number): Bow =>
    completeBow({
      name: spec.name ?? `${cam.name} · ${spec.peakWeight} lb · ${spec.drawLength}"`,
      cam,
      limb: new TorsionLimb({
        length: limbLength,
        restAngle,
        k0,
        // Real limbs stiffen a little with deflection. Keep it small: a strongly rising τ(φ)
        // fights let-off, since let-off needs the cam ratio to outrun the limb torque.
        k1: (spec.limbStiffening ?? 0.15) * k0,
        mass: spec.limbMass ?? 0.11,
        tipMass: 0.055,
      }),
      pocket,
      preload,
      stringMass: spec.stringMass ?? 0.008,
    });

  const cam = { ...spec.cam, drawStop: solveDrawStop(spec.cam, make, spec.drawLength * IN_TO_M) };
  const probe = make(cam, 100);
  if (!scalePeak) return probe;
  return make(cam, 100 * scaleToPeak(probe, spec.peakWeight * LBF_TO_N));
}

/**
 * Where to put the draw stop so the bow reaches `target` draw length.
 *
 * The stop only caps how far the cam turns; it does not enter the kinematics, which are fixed by
 * the inextensible string and cable. So ONE solver, built with the stop wide open, answers for
 * every candidate — draw length at cam rotation r is just `at(r).drawLength`. Rebuilding the bow
 * per candidate, and re-deriving its string run-out each time, was pure waste.
 *
 * Draw length rises monotonically with cam rotation, so the stop lands in ~10 evaluations.
 */
function solveDrawStop(cam: Cam, make: (c: Cam, k0: number) => Bow, target: number): number {
  const wideOpen = make({ ...cam, drawStop: cam.stringWrapAtBrace - 0.1 }, 100);
  const runOut = maxRotation(wideOpen);
  const solver = makeSolver(wideOpen);
  const reach = (stop: number) => solver.at(stop).drawLength - target;

  if (reach(runOut) < 0) return runOut; // The cam runs out of string short of this draw length.
  if (reach(1.0) > 0) return 1.0;
  return illinois(reach, 1.0, runOut, 1e-9);
}

export const defaultBow = (cam: Cam = hybridCam, overrides: Partial<BowSpec> = {}): Bow =>
  buildBow({ ...DEFAULT_SPEC, cam, ...overrides });
