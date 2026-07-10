/**
 * Solve each catalogued bow's cam `cableEnd` so the model reproduces its published let-off,
 * at that bow's own published geometry. Run with: npx tsx src/physics/fitcatalog.ts
 * Paste the printed `cableEnd` values into catalog.ts.
 *
 * Only `cableEnd` is fitted. It is the moment arm the cable has at the wall, and the force left
 * on your fingers there is proportional to it — so it is the let-off knob, and it is monotone.
 * One published number, one free parameter: no room to overfit, and no pretence of having found
 * the real cam.
 */
import { CATALOG, catalogCam } from "./catalog";
import { buildBowShape, DEFAULT_SPEC } from "./bows";
import { drawCurve } from "./solve";
import { shootBow } from "./dynamics";
import { buildBow } from "./bows";
import { minCurvature } from "./support";
import { illinois } from "./roots";
import { MPS_TO_FPS, J_TO_FTLB } from "./bow";

/**
 * The let-off knob, per cam kind.
 *
 * Spiral cam: `cableEnd`, the cable's moment arm at the wall. Force there is proportional to it.
 * Wheel:      `cableEcc`, how far the cable wheel's axle sits off centre. With the phase pointing
 *             the thin side at the wall, more eccentricity means a smaller arm there.
 *
 * Both are monotone in let-off, and both are ONE parameter against ONE published number. There is
 * no room to overfit and no pretence of having recovered the real cam.
 */
const KNOB = {
  spiral: { lo: 0.0012, hi: 0.012 }, // a track thinner than ~1 mm is not a track
  wheel: { lo: 0.0, hi: 0.024 }, //  eccentricity cannot exceed the wheel's own radius
};

for (const b of CATALOG) {
  const geometry = {
    ...DEFAULT_SPEC,
    axleToAxle: b.spec.axleToAxle,
    braceHeight: b.spec.braceHeight,
    drawLength: b.spec.drawLength,
    peakWeight: b.spec.peakWeight,
    preload: b.preload ?? 0.34,
  };

  const withKnob = (x: number) =>
    b.cam.kind === "spiral"
      ? ({ kind: "spiral", params: { ...b.cam.params, cableEnd: x } } as const)
      : ({ kind: "wheel", params: { ...b.cam.params, cableEcc: x } } as const);

  const letOffAt = (x: number): number => {
    const cam = catalogCam({ ...b, cam: withKnob(x) });
    if (minCurvature(cam.cableGroove) < 3e-4) return NaN;
    try {
      return drawCurve(buildBowShape({ ...geometry, cam }), 120).letOff;
    } catch {
      return NaN;
    }
  };

  // Spiral: let-off FALLS as cableEnd grows. Wheel: let-off RISES as cableEcc grows.
  const sign = b.cam.kind === "spiral" ? 1 : -1;
  const err = (x: number) => sign * (letOffAt(x) - b.spec.letOff);
  const { lo, hi } = KNOB[b.cam.kind];
  const eLo = err(lo);
  const eHi = err(hi);

  let knob: number;
  let note = "";
  if (!isFinite(eLo) || !isFinite(eHi)) {
    knob = b.cam.kind === "spiral" ? lo : hi;
    note = "  (search hit an unbuildable cam — floored)";
  } else if (eLo < 0) {
    knob = lo;
    note = `  (CANNOT REACH ${(b.spec.letOff * 100).toFixed(0)}% — knob at limit)`;
  } else if (eHi > 0) {
    knob = hi;
    note = `  (CANNOT REACH ${(b.spec.letOff * 100).toFixed(0)}% — knob at limit)`;
  } else {
    knob = illinois(err, lo, hi, 1e-7);
  }

  const cam = catalogCam({ ...b, cam: withKnob(knob) });
  const bow = buildBow({ ...geometry, cam });
  const curve = drawCurve(bow, 300);
  // IBO is rated at 70 lb / 30" / 350 gr, regardless of how this entry is configured.
  const iboBow = buildBow({ ...geometry, cam, peakWeight: 70, drawLength: 30 });
  const ibo = shootBow(iboBow, { arrowGrains: 350 });
  const published = b.spec.iboSpeed ? `${b.spec.iboSpeed} fps` : "(none published)";

  console.log(
    `\n// ${b.maker} ${b.model}  (${b.camName})${note}\n` +
      `//   let-off  published ${(b.spec.letOff * 100).toFixed(0)}%   modelled ${(curve.letOff * 100).toFixed(1)}%\n` +
      `//   IBO      published ${published}   modelled ${(ibo.exitSpeed * MPS_TO_FPS).toFixed(0)} fps\n` +
      `//   stored ${(curve.storedEnergy * J_TO_FTLB).toFixed(1)} ft·lb @ ${b.spec.peakWeight} lb / ${b.spec.drawLength}"` +
      `   storage ${(curve.storageEfficiency * 100).toFixed(0)}%   min cable curvature ${(minCurvature(cam.cableGroove) * 1000).toFixed(2)} mm`,
  );
  const knobName = b.cam.kind === "spiral" ? "cableEnd" : "cableEcc";
  console.log(`      ${knobName}: ${knob.toFixed(5)},   // ${b.id}`);
}
