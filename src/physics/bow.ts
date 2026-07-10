import { Groove } from "./support";
import { LimbModel } from "./limb";
import { Vec2 } from "./vec2";

/**
 * Coordinate frame, all SI (metres, radians, newtons, joules):
 *
 *   +x points toward the archer (the draw direction)
 *   +y points up
 *   the origin is the grip pivot, and the arrow flies along y = 0
 *
 * The bow is mirror-symmetric about y = 0, so we only ever solve the upper half and
 * reflect. `Bow` therefore describes the UPPER limb and UPPER cam.
 *
 * On a drawn compound the limb tips lean back toward the archer (modern "past parallel"
 * limbs), so the axle sits at positive x, ahead of the pocket.
 */

export interface Cam {
  name: string;
  /** The bowstring's track. Departs on the archer side (+x) of the cam. */
  stringGroove: Groove;
  /** The buss cable's track. Departs on the target side (-x). Typically a smaller radius. */
  cableGroove: Groove;
  /**
   * How much string is spooled on the cam at brace, in radians of normal-angle.
   * Sets where the string terminates on the cam, and so how far the bow can be drawn.
   */
  stringWrapAtBrace: number;
  /** Same, for the cable. */
  cableWrapAtBrace: number;
  /** Cam rotation at the draw stop, radians from brace. The "wall". */
  drawStop: number;
  /** Rotational inertia about the axle, kg·m². Shot-cycle only. */
  inertia: number;
  /** Shape parameters, when the cam came from `makeCam`. Absent for the wheel archetypes. */
  knobs?: import("./cams").CamKnobs;
}

export interface Bow {
  name: string;
  cam: Cam;
  limb: LimbModel;
  /** Upper limb pocket, where the limb bolts to the riser. */
  pocket: Vec2;
  /** Limb deflection at brace, radians. This is the limb-bolt preload. */
  preload: number;
  /** Total string length, m. Derived at construction from the brace geometry. */
  stringLength: number;
  /** Length of one buss cable, m. Likewise derived. */
  cableLength: number;
  /** Bowstring mass, kg. Includes serving and peep. Shot-cycle only. */
  stringMass: number;
}

/**
 * Which way each line wraps its groove, as seen by `tangentFrom`.
 *
 * These are not free choices. At brace the string leaves the upper cam at the point
 * whose outward normal is +x, where the tangent direction is +y; the string runs DOWN
 * to the nock, so it departs along -t̂ and the handedness is -1. The cable leaves on
 * the target side (normal -x, tangent -y) and also runs down, so it departs along +t̂.
 *
 * That they come out opposite is required, not coincidence: the cam's torque balance is
 * s_string·T_string·h_string + s_cable·T_cable·h_cable = 0, and both moment arms h are
 * positive by construction. Opposite handedness is the only way the cam can be in
 * equilibrium — which is another way of saying the string must pay out as the cable
 * takes up. The model reproduces the real thing: string on the archer side of the cam,
 * buss cable on the target side.
 */
export const STRING_HANDEDNESS = -1 as const;
export const CABLE_HANDEDNESS = 1 as const;

/** Archery's draw-length convention: nock to grip pivot, plus 1¾ inches. */
export const DRAW_LENGTH_OFFSET = 0.04445;

export const N_TO_LBF = 0.2248089;
export const LBF_TO_N = 4.4482216;
export const M_TO_IN = 39.3700787;
export const IN_TO_M = 0.0254;
export const J_TO_FTLB = 0.7375621;
export const MPS_TO_FPS = 3.2808399;
/** Grains to kg. Arrow masses are quoted in grains. */
export const GRAIN_TO_KG = 6.479891e-5;
