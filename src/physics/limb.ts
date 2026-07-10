/**
 * The limb is the bow's spring. Every joule the bow stores is bending strain in the
 * two limbs; the cams store none. So the limb model sets the accuracy ceiling of the
 * whole simulation, and the cams only decide how that energy is presented to the hand.
 *
 * We model each limb as a RIGID bar hinged at the limb pocket, resisted by a nonlinear
 * torsion spring. The limb does not actually work that way — it is a tapered composite
 * cantilever under large deflection — but the archer only ever observes the limb through
 * its tip, and a hinge with the right τ(φ) reproduces the tip behaviour exactly.
 *
 * The reason to prefer it over a real beam model is practical: a beam needs cross-section,
 * taper and modulus, none of which manufacturers publish. Guessing those inputs yields a
 * worse answer than fitting τ(φ) to a bow's measured draw-force curve, which is public.
 *
 * `LimbModel` is the seam. Swap in a beam solver behind it and nothing upstream changes.
 */
export interface LimbModel {
  /** Restoring torque about the pocket, N·m, for deflection φ (rad) from the unloaded pose. */
  torque(phi: number): number;
  /** Strain energy, J, stored at deflection φ. Must satisfy dU/dφ = τ(φ). */
  energy(phi: number): number;
  /** Rotational inertia about the pocket, kg·m². Used only by the shot-cycle integrator. */
  inertia: number;
  /** Distance from pocket pivot to axle, metres. */
  length: number;
  /** Angle of the unloaded limb, radians, measured from +x (pointing away from the archer). */
  restAngle: number;
}

export interface TorsionLimbSpec {
  length: number;
  restAngle: number;
  /** Linear stiffness, N·m/rad. Dominates the draw-force curve's overall weight. */
  k0: number;
  /** Quadratic term, N·m/rad². Positive means the limb stiffens as it bends. */
  k1?: number;
  /** Cubic term, N·m/rad³. */
  k2?: number;
  /** Limb mass, kg. Uniform bar assumed for inertia. */
  mass?: number;
  /** Mass carried at the tip (cam, axle, bearings), kg. */
  tipMass?: number;
}

/**
 * Polynomial torsion spring: τ(φ) = k0·φ + k1·φ² + k2·φ³.
 *
 * Real limbs stiffen slightly with deflection (k1 > 0) because the effective moment arm
 * of the tip load shortens as the limb rotates under it. Two or three terms is plenty;
 * the cam contributes far more curvature to the draw-force curve than the limb does.
 */
export class TorsionLimb implements LimbModel {
  readonly length: number;
  readonly restAngle: number;
  readonly inertia: number;
  private readonly k0: number;
  private readonly k1: number;
  private readonly k2: number;

  constructor(spec: TorsionLimbSpec) {
    this.length = spec.length;
    this.restAngle = spec.restAngle;
    this.k0 = spec.k0;
    this.k1 = spec.k1 ?? 0;
    this.k2 = spec.k2 ?? 0;
    const m = spec.mass ?? 0.12;
    const mt = spec.tipMass ?? 0.05;
    this.inertia = (m * this.length ** 2) / 3 + mt * this.length ** 2;
  }

  torque(phi: number): number {
    return this.k0 * phi + this.k1 * phi * phi + this.k2 * phi ** 3;
  }

  energy(phi: number): number {
    return (this.k0 * phi ** 2) / 2 + (this.k1 * phi ** 3) / 3 + (this.k2 * phi ** 4) / 4;
  }
}
