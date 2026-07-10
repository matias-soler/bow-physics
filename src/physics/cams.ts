import { Cam } from "./bow";
import { eccentricGroove, profileGroove } from "./support";

/**
 * Cam archetypes.
 *
 * Where let-off comes from. By virtual work F_draw · dD = 2·τ_limb(φ) · dφ, and the two
 * rates are set by the moment arms: the string pays out h_string per radian of cam
 * rotation, and the cable takes up h_cable per radian. So
 *
 *     F_draw  ∝  τ_limb(φ) · h_cable / h_string · (string leg's component along the draw)
 *
 * The limb torque climbs monotonically through the draw, so let-off requires the cam ratio
 * h_cable/h_string to collapse near full draw. Every cam here does that by growing the
 * string track and shrinking the cable track as the cam turns. The draw stop catches the
 * cam at the bottom of the collapse — that is the "wall".
 *
 * The initial force rise is NOT a cam effect. At brace the string leg stands vertical, so
 * it has no component along the draw and the force is zero whatever the cam does. The force
 * ramps as the leg angles over. How STEEPLY it ramps is set by the string tension at brace,
 * and therefore by the limb-bolt preload — not by the cam.
 *
 * The cams turn roughly 270° through the draw, so the tracks are spirals: `h` sweeps
 * monotonically over more than 2π and never returns to its starting value. See `support.ts`
 * for why a closed convex groove cannot do that, and why real cams are shaped as snails.
 */

/**
 * Each track must be defined over the whole arc its departure point visits, plus its anchor.
 *
 * The departure point advances by the cam rotation PLUS the swing of the line's normal in the
 * world frame — the string leg swings nearly a radian as the nock travels back — so the arcs
 * run a good deal past `drawStop`. The string departs at u = 0 at brace; the cable near u = π.
 */
export const STRING_U0 = -0.8;
export const STRING_U1 = 7.0;
export const CABLE_U0 = 1.2;
export const CABLE_U1 = 9.8;

const STRING_WRAP_AT_BRACE = 6.4;
const CABLE_WRAP_AT_BRACE = 1.7;

/**
 * A cam is its two support functions, sampled as evenly spaced control points and splined.
 *
 * Control points rather than a closed-form family, because production cams do not fit clean
 * formulas: they hold a long force plateau and then plunge, which no single sigmoid produces.
 * This is also the form a digitised or DFC-fitted real cam lands in — see `fit.ts`.
 *
 * Physical validity is `h + h'' > 0` across the arc (`isTraceable`), not convexity of the
 * closed curve, which real cams do not have.
 */
export interface CamKnobs {
  /** h for the string track, over [STRING_U0, STRING_U1]. Should rise through the draw. */
  string: number[];
  /** h for the cable track, over [CABLE_U0, CABLE_U1]. Should fall through the draw. */
  cable: number[];
  /** Cam rotation at the wall, radians from brace. Overridden by `buildBow` to hit draw length. */
  drawStop: number;
}

export function makeCam(name: string, k: CamKnobs): Cam {
  return {
    name,
    stringGroove: profileGroove(STRING_U0, STRING_U1, k.string),
    cableGroove: profileGroove(CABLE_U0, CABLE_U1, k.cable),
    stringWrapAtBrace: STRING_WRAP_AT_BRACE,
    cableWrapAtBrace: CABLE_WRAP_AT_BRACE,
    drawStop: k.drawStop,
    inertia: 3.5e-4,
    knobs: k,
  };
}

/**
 * The smooth family a cam's two tracks actually want to be.
 *
 *   h_string(u) = sBase + (sEnd − sBase)·(1 − exp(−u / growth))        swells, saturating
 *   h_cable(u)  = cEnd  + (cBase − cEnd) / (1 + exp((u − mid)/width))  holds, then plunges
 *
 * Both keep h + h'' > 0 comfortably: an exponential spiral has ρ = h·(1 + k²) > 0 identically,
 * which is why the cable arm can collapse to under 2 mm and still be a track a line can lie in.
 *
 * `cableEnd` is the let-off knob — it sets the cam ratio at the wall, and the force left on your
 * fingers there is proportional to it. `cableMid` is an ABSOLUTE normal angle, and the cable's
 * departure point starts near u = π, so a value under ~3.2 puts the collapse before brace.
 *
 * `stringBase` matters more than it looks: a SMALL string arm at brace makes the nock creep while
 * the cam turns and the cable bends the limb, so draw force ramps to peak fast — a real cam's
 * front-loaded curve. A large string base gives the slow ramp that wastes storage efficiency.
 */
export interface SpiralParams {
  stringBase: number;
  stringEnd: number;
  stringGrowth: number;
  cableBase: number;
  cableEnd: number;
  cableMid: number;
  cableWidth: number;
  /** `buildBow` overrides this to hit the requested draw length; the default just opens it wide. */
  drawStop?: number;
}

const KNOTS = 15;

export function spiralCam(name: string, p: SpiralParams): Cam {
  const sample = (uMin: number, uMax: number, f: (u: number) => number) =>
    Array.from({ length: KNOTS }, (_, i) => f(uMin + ((uMax - uMin) * i) / (KNOTS - 1)));

  return makeCam(name, {
    string: sample(STRING_U0, STRING_U1, (u) =>
      p.stringBase + (p.stringEnd - p.stringBase) * (1 - Math.exp(-Math.max(0, u) / p.stringGrowth)),
    ),
    cable: sample(CABLE_U0, CABLE_U1, (u) =>
      p.cableEnd + (p.cableBase - p.cableEnd) / (1 + Math.exp((u - p.cableMid) / p.cableWidth)),
    ),
    drawStop: p.drawStop ?? 6.0,
  });
}

/**
 * A pair of round wheels on offset axles — the original compound, and still what budget and
 * older bows use.
 *
 * A wheel's support function is exactly h(u) = r + e·cos(u − ψ). The first harmonic of a support
 * function IS a translation of the curve, so `ecc` is literally how far the axle hole sits from
 * the wheel's centre, and h + h'' = r identically: an offset circle is convex for any offset.
 *
 * `phase` is where the wheel's fat side points, in the cam's local normal angle. It decides
 * everything. Put the string track's maximum at the wall and the cable track's minimum there and
 * you get let-off; rotate either by π and you get the opposite, a bow that gets heavier as you
 * hold it. Nothing about a wheel bow is subtle except this.
 *
 * A wheel can only sweep its moment arm monotonically over half a turn, so let-off is capped by
 * how far the wheel rotates through the draw. Long-axle-to-axle bows with big wheels turn less,
 * which is why the breed tops out around 50% where a spiral cam reaches 80%.
 */
export interface WheelParams {
  stringRadius: number;
  stringEcc: number;
  stringPhase: number;
  cableRadius: number;
  cableEcc: number;
  cablePhase: number;
  drawStop?: number;
}

export function wheelCam(name: string, p: WheelParams): Cam {
  const polar = (r: number, e: number, psi: number, uMin: number, uMax: number) =>
    eccentricGroove(r, e * Math.cos(psi), e * Math.sin(psi), uMin, uMax);
  return {
    name,
    stringGroove: polar(p.stringRadius, p.stringEcc, p.stringPhase, -1, 7.6),
    cableGroove: polar(p.cableRadius, p.cableEcc, p.cablePhase, 1, 10),
    stringWrapAtBrace: STRING_WRAP_AT_BRACE,
    cableWrapAtBrace: CABLE_WRAP_AT_BRACE,
    drawStop: p.drawStop ?? 6.0,
    inertia: 5.5e-4, // Bigger, heavier wheels than a modern cam.
  };
}

/**
 * A plain round wheel concentric with its axle. The cam ratio never changes, so there is no
 * let-off: the force climbs until the wheel runs out of string. This is the control case —
 * a compound with the cam taken away behaves like a very stiff recurve.
 */
export const roundWheel: Cam = {
  name: "Round wheel (no let-off)",
  stringGroove: eccentricGroove(0.042, 0, 0, -1, 7.6),
  cableGroove: eccentricGroove(0.019, 0, 0, 1, 10),
  stringWrapAtBrace: STRING_WRAP_AT_BRACE,
  cableWrapAtBrace: CABLE_WRAP_AT_BRACE,
  drawStop: 6.0,
  inertia: 3.5e-4,
};

/**
 * The 1966 Allen compound: round wheels on offset axles. The offset alone makes the moment
 * arms vary, so it gets some let-off with no spiral anywhere — but not much, because a closed
 * convex groove's moment arm has to come back to where it started after one turn.
 */
export const eccentricWheel: Cam = {
  name: "Eccentric wheel (Allen, 1966)",
  stringGroove: eccentricGroove(0.040, 0.004, -0.012, -1, 7.6),
  cableGroove: eccentricGroove(0.019, 0.003, -0.007, 1, 10),
  stringWrapAtBrace: STRING_WRAP_AT_BRACE,
  cableWrapAtBrace: CABLE_WRAP_AT_BRACE,
  drawStop: 6.0,
  inertia: 3.5e-4,
};

// The three spiral archetypes below sweep the let-off/storage frontier. They are the same family
// the real bows in `catalog.ts` use; only `cableEnd` really separates them.
//
//   soft    39% let-off, 74% storage   hybrid  66% / 70%   hard  78% / 66%
//
// That trade is a prediction of the model, not a fudge: a force plateau that fills more of the
// rectangle leaves the cam ratio less room to collapse before the wall.

/** Gentle: a long smooth build and a soft valley. Stores the most, lets off the least. */
export const softCam = spiralCam("Soft cam", {
  stringBase: 0.010, stringEnd: 0.070, stringGrowth: 2.4,
  cableBase: 0.032, cableEnd: 0.0060, cableMid: 5.4, cableWidth: 1.00,
});

/** What most hunting bows ship with: a real plateau, a firm wall, let-off you can hold. */
export const hybridCam = spiralCam("Hybrid cam", {
  stringBase: 0.008, stringEnd: 0.075, stringGrowth: 2.0,
  cableBase: 0.038, cableEnd: 0.0028, cableMid: 5.2, cableWidth: 0.70,
});

/**
 * Aggressive: steep build, hard wall, the most let-off. The cable arm collapses to under
 * 2 mm at full draw, which is what buys the let-off and what drives cable tension up.
 */
export const hardCam = spiralCam("Hard cam", {
  stringBase: 0.006, stringEnd: 0.082, stringGrowth: 1.7,
  cableBase: 0.044, cableEnd: 0.0016, cableMid: 5.0, cableWidth: 0.50,
});

export const CAMS: Cam[] = [roundWheel, eccentricWheel, softCam, hybridCam, hardCam];
