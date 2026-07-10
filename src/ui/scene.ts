import { Bow } from "../physics/bow";
import { anchors, BowState } from "../physics/solve";
import { boundary, outline } from "../physics/support";
import { mirrorY, Vec2, v } from "../physics/vec2";

const camToWorld = (axlePos: Vec2, omega: number, pLocal: Vec2): Vec2 =>
  v(
    axlePos.x + pLocal.x * Math.cos(omega) - pLocal.y * Math.sin(omega),
    axlePos.y + pLocal.x * Math.sin(omega) + pLocal.y * Math.cos(omega),
  );

export interface Scene {
  /**
   * Riser spine, drawn as a thick stroked polyline rather than a filled outline. The grip
   * throat sits at the origin: it is the reference the brace height and draw length are
   * measured from, so it should read as a point on the drawing.
   */
  riser: Vec2[];
  upperLimb: Vec2[];
  lowerLimb: Vec2[];
  upperAxle: Vec2;
  lowerAxle: Vec2;
  /** Cam bodies: the string track and the cable track, each as a spiral outline. */
  upperStringTrack: Vec2[];
  upperCableTrack: Vec2[];
  lowerStringTrack: Vec2[];
  lowerCableTrack: Vec2[];
  /** The whole bowstring: spooled arc, free leg, nock, mirrored leg, mirrored arc. */
  string: Vec2[];
  /** Just the arc of string still spooled on the upper cam. Shortens as the cam turns. */
  upperStringArc: Vec2[];
  /** Just the arc of cable spooled on the upper cam. Lengthens as the cam turns. */
  upperCableArc: Vec2[];
  /** Each buss cable: spooled arc on its cam, then a free span to the opposite axle. */
  upperCable: Vec2[];
  lowerCable: Vec2[];
  nock: Vec2;
  arrow: { from: Vec2; to: Vec2 };
  grip: Vec2;
  /** Departure points, where torque is actually applied. */
  stringTangent: Vec2;
  cableTangent: Vec2;
}

const ARROW_LENGTH = 0.79;

/**
 * The string is drawn as it actually lies: spooled around the cam from its anchor to the
 * departure point, then straight to the nock. Watching the spooled arc shorten as the cam
 * turns is the clearest picture of where draw length comes from.
 */
function spooled(
  axlePos: Vec2,
  omega: number,
  groove: Parameters<typeof boundary>[0],
  fromU: number,
  toU: number,
  steps = 64,
): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = fromU + ((toU - fromU) * i) / steps;
    pts.push(camToWorld(axlePos, omega, boundary(groove, u)));
  }
  return pts;
}

export function buildScene(bow: Bow, s: BowState): Scene {
  const an = anchors(bow);
  const omega = -s.camRotation;
  const A = s.axle;
  const Ap = mirrorY(A);
  const pocketU = bow.pocket;
  const pocketL = mirrorY(bow.pocket);
  const cam = bow.cam;

  const track = (g: Parameters<typeof boundary>[0]) =>
    outline(g, 220).map((p) => camToWorld(A, omega, p));
  const mirrorTrack = (pts: Vec2[]) => pts.map(mirrorY);

  const upperStringTrack = track(cam.stringGroove);
  const upperCableTrack = track(cam.cableGroove);

  // String: from the anchor, round the cam to the departure point, then out to the nock.
  const upperArc = spooled(A, omega, cam.stringGroove, an.stringAnchorU, s.stringU);
  const lowerArc = upperArc.map(mirrorY).reverse();
  const string = [...upperArc, s.nock, ...lowerArc];

  // Cable: from its anchor round the cam to the departure point, then across to the far axle.
  const upperCableArc = spooled(A, omega, cam.cableGroove, an.cableAnchorU, s.cableU);
  const upperCable = [...upperCableArc, Ap];
  const lowerCable = upperCable.map(mirrorY);

  // A reflexed riser: it sweeps back from each limb pocket and comes forward to meet the
  // archer's hand at the grip throat, which is the origin.
  const back = pocketU.x - 0.028;
  const riser: Vec2[] = [
    pocketU,
    v(back, pocketU.y * 0.62),
    v(back - 0.008, pocketU.y * 0.28),
    v(-0.004, 0.0),
    v(back - 0.008, -pocketU.y * 0.28),
    v(back, -pocketU.y * 0.62),
    pocketL,
  ];

  return {
    riser,
    upperLimb: [pocketU, A],
    lowerLimb: [pocketL, Ap],
    upperAxle: A,
    lowerAxle: Ap,
    upperStringTrack,
    upperCableTrack,
    lowerStringTrack: mirrorTrack(upperStringTrack),
    lowerCableTrack: mirrorTrack(upperCableTrack),
    string,
    upperStringArc: upperArc,
    upperCableArc,
    upperCable,
    lowerCable,
    nock: s.nock,
    arrow: { from: s.nock, to: v(s.nock.x - ARROW_LENGTH, 0) },
    grip: v(0, 0),
    stringTangent: s.stringTangent,
    cableTangent: s.cableTangent,
  };
}

export interface View {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * The drawing bounds, derived from the bow rather than fixed.
 *
 * Axle-to-axle ranges from 28" to 46" across the presets — a 43" wheel bow is half a metre taller
 * than a 30" Hoyt — so a hardcoded box either clips the long bows or wastes half the canvas on the
 * short ones. Bounds are computed from the braced axle height and the full-draw nock, both of which
 * are constant through a draw, so nothing jitters while the slider moves.
 */
export function viewFor(braceAxleY: number, fullDrawNockX: number): View {
  const y = braceAxleY + 0.085; // clear the cams, which sit outboard of the axles
  return { x0: -0.30, x1: fullDrawNockX + 0.06, y0: -y, y1: y };
}

export const toSvg = (p: Vec2) => `${p.x},${-p.y}`;
export const path = (pts: Vec2[]) => pts.map(toSvg).join(" ");
