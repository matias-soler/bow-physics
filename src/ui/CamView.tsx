import { Scene, path } from "./scene";
import { Vec2 } from "../physics/vec2";

/**
 * The upper cam, magnified. At bow scale the cam is a 5 cm speck, yet every interesting
 * quantity — the two moment arms, how much string is still spooled, where each line leaves
 * the track — lives inside it.
 */
export function CamView({ scene: s }: { scene: Scene }) {
  const A = s.upperAxle;
  const R = 0.085;

  const clip = (pts: Vec2[]) => pts.filter((p) => Math.hypot(p.x - A.x, p.y - A.y) < R * 1.6);
  const at = (p: Vec2) => ({ cx: p.x, cy: -p.y });

  // Extend each departing line a short way out of frame, so it reads as leaving the cam.
  const ray = (from: Vec2, toward: Vec2, len: number): Vec2 => {
    const dx = toward.x - from.x;
    const dy = toward.y - from.y;
    const m = Math.hypot(dx, dy) || 1;
    return { x: from.x + (dx / m) * len, y: from.y + (dy / m) * len };
  };
  const stringOut = ray(s.stringTangent, s.nock, R * 1.5);
  const cableOut = ray(s.cableTangent, s.lowerAxle, R * 1.5);

  return (
    <svg className="cam-view" viewBox={`${A.x - R} ${-A.y - R} ${2 * R} ${2 * R}`}>
      <circle {...at(A)} r={R * 0.99} fill="var(--panel-2)" stroke="var(--edge)" strokeWidth={0.0012} />

      <polyline points={path(clip(s.upperCableTrack))} fill="none" stroke="var(--cable-track)" strokeWidth={0.0016} />
      <polyline points={path(clip(s.upperStringTrack))} fill="none" stroke="var(--string-track)" strokeWidth={0.0016} />

      {/* Moment arms: the perpendicular from the axle to each line. These lengths ARE h(u). */}
      <line x1={A.x} y1={-A.y} x2={s.cableTangent.x} y2={-s.cableTangent.y}
        stroke="var(--cable)" strokeWidth={0.0011} strokeDasharray="0.004 0.003" opacity={0.85} />
      <line x1={A.x} y1={-A.y} x2={s.stringTangent.x} y2={-s.stringTangent.y}
        stroke="var(--string)" strokeWidth={0.0011} strokeDasharray="0.004 0.003" opacity={0.85} />

      {/* The cable and string as they actually lie: spooled, then departing tangentially. */}
      <polyline points={path([...s.upperCableArc, cableOut])}
        fill="none" stroke="var(--cable)" strokeWidth={0.0026} strokeLinejoin="round" />
      <polyline points={path([...s.upperStringArc, stringOut])}
        fill="none" stroke="var(--string)" strokeWidth={0.0026} strokeLinejoin="round" />

      <circle {...at(s.stringTangent)} r={0.0028} fill="var(--string)" />
      <circle {...at(s.cableTangent)} r={0.0028} fill="var(--cable)" />
      <circle {...at(A)} r={0.0035} fill="var(--axle)" />
    </svg>
  );
}
