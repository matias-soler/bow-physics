import { Scene, View, path } from "./scene";
import { Vec2 } from "../physics/vec2";

interface Props {
  scene: Scene;
  view: View;
  showTangents: boolean;
  showTracks: boolean;
}

const pt = (p: Vec2) => ({ cx: p.x, cy: -p.y });

export function BowView({ scene: s, view, showTangents, showTracks }: Props) {
  const w = view.x1 - view.x0;
  const h = view.y1 - view.y0;

  return (
    <svg
      className="bow-view"
      viewBox={`${view.x0} ${-view.y1} ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="limbGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--limb-dark)" />
          <stop offset="100%" stopColor="var(--limb-light)" />
        </linearGradient>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--arrow)" />
        </marker>
      </defs>

      {/* Arrow rest line — where the shaft flies. */}
      <line
        x1={view.x0} y1={0} x2={view.x1} y2={0}
        stroke="var(--axis)" strokeWidth={0.0015} strokeDasharray="0.012 0.012"
      />

      {/* Riser, as a thick spine from pocket to pocket through the grip throat. */}
      <polyline
        points={path(s.riser)} fill="none" stroke="var(--riser)"
        strokeWidth={0.034} strokeLinejoin="round" strokeLinecap="round"
      />
      <polyline
        points={path(s.riser)} fill="none" stroke="var(--riser-edge)"
        strokeWidth={0.036} strokeLinejoin="round" strokeLinecap="round" opacity={0.35}
      />
      <polyline
        points={path(s.riser)} fill="none" stroke="var(--riser)"
        strokeWidth={0.030} strokeLinejoin="round" strokeLinecap="round"
      />
      {/* Grip: where the hand goes, and the origin of brace height and draw length. */}
      <circle cx={0} cy={0} r={0.019} fill="var(--riser-edge)" />

      {/* Limbs, drawn as tapered quads from pocket to axle. */}
      {[s.upperLimb, s.lowerLimb].map((limb, i) => (
        <line
          key={i}
          x1={limb[0].x} y1={-limb[0].y} x2={limb[1].x} y2={-limb[1].y}
          stroke="url(#limbGrad)" strokeWidth={0.026} strokeLinecap="round"
        />
      ))}

      {/* Cam bodies. The tracks really are spirals; they overlap themselves by design. */}
      {showTracks && (
        <g>
          {[s.upperCableTrack, s.lowerCableTrack].map((c, i) => (
            <polyline key={`ct${i}`} points={path(c)} fill="none" stroke="var(--cable-track)" strokeWidth={0.0018} />
          ))}
          {[s.upperStringTrack, s.lowerStringTrack].map((c, i) => (
            <polyline key={`st${i}`} points={path(c)} fill="none" stroke="var(--string-track)" strokeWidth={0.0018} />
          ))}
        </g>
      )}

      {/* Buss cables: spooled arc, then a free span to the opposite axle. */}
      {[s.upperCable, s.lowerCable].map((c, i) => (
        <polyline key={`cbl${i}`} points={path(c)} fill="none" stroke="var(--cable)" strokeWidth={0.0035} strokeLinejoin="round" />
      ))}

      {/* Bowstring: spooled on the upper cam, out to the nock, back onto the lower cam. */}
      <polyline points={path(s.string)} fill="none" stroke="var(--string)" strokeWidth={0.0035} strokeLinejoin="round" />

      {/* Arrow. */}
      <line
        x1={s.arrow.from.x} y1={0} x2={s.arrow.to.x} y2={0}
        stroke="var(--arrow)" strokeWidth={0.006} markerEnd="url(#arrowhead)"
      />

      {/* Axles. */}
      {[s.upperAxle, s.lowerAxle].map((a, i) => (
        <circle key={`ax${i}`} {...pt(a)} r={0.006} fill="var(--axle)" />
      ))}

      {/* Departure points: where string and cable actually apply torque to the cam. */}
      {showTangents && (
        <g>
          {[s.stringTangent, { x: s.stringTangent.x, y: -s.stringTangent.y }].map((p, i) => (
            <circle key={`tS${i}`} {...pt(p)} r={0.0042} fill="var(--string)" stroke="var(--bg)" strokeWidth={0.0012} />
          ))}
          {[s.cableTangent, { x: s.cableTangent.x, y: -s.cableTangent.y }].map((p, i) => (
            <circle key={`tC${i}`} {...pt(p)} r={0.0042} fill="var(--cable)" stroke="var(--bg)" strokeWidth={0.0012} />
          ))}
          {/* Moment arms: the perpendicular from each axle to its line. This length IS h(u). */}
          <line
            x1={s.upperAxle.x} y1={-s.upperAxle.y} x2={s.stringTangent.x} y2={-s.stringTangent.y}
            stroke="var(--string)" strokeWidth={0.0012} strokeDasharray="0.006 0.006" opacity={0.7}
          />
          <line
            x1={s.upperAxle.x} y1={-s.upperAxle.y} x2={s.cableTangent.x} y2={-s.cableTangent.y}
            stroke="var(--cable)" strokeWidth={0.0012} strokeDasharray="0.006 0.006" opacity={0.7}
          />
        </g>
      )}

      {/* Nock. */}
      <circle {...pt(s.nock)} r={0.0055} fill="var(--nock)" />

      {/* Grip pivot: the reference for brace height and draw length. */}
      <circle {...pt(s.grip)} r={0.004} fill="none" stroke="var(--axis)" strokeWidth={0.0015} />
    </svg>
  );
}
