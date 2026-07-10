import { Bow, GRAIN_TO_KG } from "./bow";
import { BowState, drawCurve, DrawCurve } from "./solve";

/**
 * The shot cycle.
 *
 * After release the bow is a conservative system with ONE degree of freedom — the cam
 * rotation r — because the string and cable are inextensible and everything else is tied to
 * them. So there is no need to integrate an equation of motion for the speed: energy
 * conservation gives it in closed form at every r.
 *
 *     ½·M(r)·ṙ²  =  E_stored(r_full) − E_stored(r)
 *
 * where M(r) is the generalised inertia gathered at the cam:
 *
 *     M(r) = 2·I_limb·(dφ/dr)²  +  2·I_cam  +  (m_arrow + m_string/3)·(dD/dr)²
 *
 * The 1/3 is the usual effective-mass rule for a line whose ends are fixed and whose middle
 * carries the load. Time comes from integrating dt = dr / |ṙ|.
 *
 * A CONSEQUENCE WORTH UNDERSTANDING, because it is easy to mistake for a bug. As the string
 * straightens at brace, dD/dr diverges: a vanishing string payout swings the nock a finite
 * distance, which is exactly why a bowstring "snaps" straight. So M(r) → ∞ and ṙ → 0. The
 * limbs and cams are therefore at rest the instant the arrow leaves, and they return ALL of
 * their kinetic energy. Taking the limit,
 *
 *     v_exit  →  √( 2·E_stored / (m_arrow + m_string/3) )
 *
 * Limb mass drops out of the exit speed entirely. That is a real property of this
 * idealisation (inextensible string, arrow held to the nock until brace), not an artefact of
 * the solver — and it is why the string's mass, not the limb's, is the dominant modelled loss.
 *
 * Real bows do lose energy to limb motion, because the arrow separates fractionally before
 * brace and because limbs and string are neither rigid nor lossless. None of that is captured
 * here. `mechanicalEfficiency` is an honest fudge factor standing in for hysteresis in the
 * limbs and string, and friction at the axles; it is not derived from anything.
 */

export interface ShotSpec {
  /** Arrow mass in grains. IBO rates at 350 gr; hunting arrows run 400-500 gr. */
  arrowGrains: number;
  /**
   * Empirical catch-all for limb and string hysteresis and axle friction. Not derived.
   * Around 0.90-0.94 reproduces measured chronograph speeds.
   */
  mechanicalEfficiency?: number;
}

export interface ShotSample {
  time: number;
  camRotation: number;
  /** Nock position. */
  nockX: number;
  /** Arrow speed, m/s. */
  arrowSpeed: number;
  /** Cam angular speed, rad/s. */
  camSpeed: number;
  /** Generalised inertia at the cam, kg·m². */
  effectiveInertia: number;
  /** Energy still held in the limbs, J. */
  remainingEnergy: number;
}

export interface ShotResult {
  samples: ShotSample[];
  /** Arrow speed as it leaves the string, m/s. */
  exitSpeed: number;
  /** Arrow kinetic energy at exit, J. */
  arrowEnergy: number;
  /** Energy stored at full draw, J. */
  storedEnergy: number;
  /** arrowEnergy / storedEnergy. */
  efficiency: number;
  /** Time from release to arrow exit, s. */
  duration: number;
  /** Fraction of stored energy left in the string's own motion. */
  stringLoss: number;
}

/** Effective mass the string presents at the nock: a third of its own, by the usual rule. */
const stringEffectiveMass = (bow: Bow) => bow.stringMass / 3;

function effectiveInertia(bow: Bow, s: BowState, dPhiDr: number, arrowMass: number): number {
  return (
    2 * bow.limb.inertia * dPhiDr ** 2 +
    2 * bow.cam.inertia +
    (arrowMass + stringEffectiveMass(bow)) * s.drawRate ** 2
  );
}

export function shootBow(bow: Bow, spec: ShotSpec, curve?: DrawCurve): ShotResult {
  const c = curve ?? drawCurve(bow, 600);
  const eta = spec.mechanicalEfficiency ?? 0.92;
  const arrowMass = spec.arrowGrains * GRAIN_TO_KG;
  const st = c.states;
  const full = st[st.length - 1];

  // dφ/dr by central differences on the uniformly sampled cam rotation.
  const dPhiDr = st.map((_, i) => {
    const lo = st[Math.max(0, i - 1)];
    const hi = st[Math.min(st.length - 1, i + 1)];
    return (hi.limbDeflection - lo.limbDeflection) / (hi.camRotation - lo.camRotation);
  });

  // Walk from full draw back toward brace, accumulating time.
  const samples: ShotSample[] = [];
  let t = 0;
  let prevRdot = 0;
  for (let i = st.length - 1; i >= 1; i--) {
    const s = st[i];
    const released = eta * (full.storedEnergy - s.storedEnergy);
    const M = effectiveInertia(bow, s, dPhiDr[i], arrowMass);
    const rdot = Math.sqrt(Math.max(0, (2 * released) / M));
    samples.push({
      time: t,
      camRotation: s.camRotation,
      nockX: s.nockX,
      arrowSpeed: rdot * s.drawRate,
      camSpeed: rdot,
      effectiveInertia: M,
      remainingEnergy: s.storedEnergy,
    });
    // dt = dr / |ṙ|, trapezoid in 1/ṙ. The first step has ṙ = 0, so start it from the next.
    const dr = s.camRotation - st[i - 1].camRotation;
    if (prevRdot > 0 && rdot > 0) t += dr * 0.5 * (1 / rdot + 1 / prevRdot);
    else if (rdot > 0) t += dr / rdot;
    prevRdot = rdot;
  }

  // Exit speed from the limit above, not from the last sample: dD/dr diverges at brace, so
  // any finite-difference estimate of it there is meaningless.
  const exitSpeed = Math.sqrt((2 * eta * full.storedEnergy) / (arrowMass + stringEffectiveMass(bow)));
  const arrowEnergy = 0.5 * arrowMass * exitSpeed ** 2;

  return {
    samples,
    exitSpeed,
    arrowEnergy,
    storedEnergy: full.storedEnergy,
    efficiency: arrowEnergy / full.storedEnergy,
    duration: t,
    stringLoss: stringEffectiveMass(bow) / (arrowMass + stringEffectiveMass(bow)),
  };
}

/**
 * The IBO/ATA speed rating: 70 lb peak, 30" draw, 350 gr arrow. Quoted by every manufacturer,
 * so it is the one number a reader can check this simulator against. Modern bows rate 330-350 fps.
 */
export function ibospeed(bow: Bow, curve?: DrawCurve): number {
  return shootBow(bow, { arrowGrains: 350 }, curve).exitSpeed;
}
