/**
 * Physical consistency checks. Run with: npx tsx src/physics/check.ts
 *
 * The load-bearing one is virtual work. The solver computes draw force from a torque
 * balance, and stored energy from limb strain energy, by completely independent routes.
 * If F(D) is not dE/dD, something is wrong with the geometry, the moment arms, or the
 * handedness. Nothing else in the app can be trusted until this passes.
 */
import { CAMS } from "./cams";
import { defaultBow } from "./bows";
import { drawCurve, integrateWork } from "./solve";
import { isTraceable, minCurvature } from "./support";
import { shootBow } from "./dynamics";
import { J_TO_FTLB, M_TO_IN, MPS_TO_FPS, N_TO_LBF } from "./bow";

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
};

console.log("\nGroove traceability (h + h'' > 0 across the working arc)");
for (const c of CAMS) {
  check(
    `${c.name} string`,
    isTraceable(c.stringGroove),
    `min curvature radius ${(minCurvature(c.stringGroove) * 1000).toFixed(1)} mm`,
  );
  check(
    `${c.name} cable`,
    isTraceable(c.cableGroove),
    `min curvature radius ${(minCurvature(c.cableGroove) * 1000).toFixed(1)} mm`,
  );
}

for (const c of CAMS) {
  console.log(`\n${c.name}`);
  const bow = defaultBow(c);
  const curve = drawCurve(bow, 800);

  // 1. Virtual work: ∫F dD over the draw must equal the limbs' strain energy.
  const work = integrateWork(curve);
  const relErr = Math.abs(work - curve.storedEnergy) / curve.storedEnergy;
  check("virtual work  ∫F dD = ΔU_limb", relErr < 2e-3, `rel. error ${(relErr * 100).toFixed(3)}%`);

  // 2. Pointwise: F(D) = dE/dD at every sample, not just in aggregate.
  //    Skip the first few percent of the stroke. Brace is a tangency of the string-length
  //    constraint, so D(r) leaves it like a square root — a central difference there is
  //    measuring its own truncation error, not the model's. The aggregate check above still
  //    covers that region, since ∫F dD is insensitive to it.
  let worst = 0;
  let worstAt = 0;
  const st = curve.states;
  const skip = Math.ceil(st.length * 0.04);
  for (let i = skip; i < st.length - 2; i++) {
    const dEdD = (st[i + 1].storedEnergy - st[i - 1].storedEnergy) / (st[i + 1].nockX - st[i - 1].nockX);
    const scale = Math.max(curve.peakForce * 0.05, Math.abs(st[i].drawForce));
    const err = Math.abs(dEdD - st[i].drawForce) / scale;
    if (err > worst) {
      worst = err;
      worstAt = st[i].drawLength;
    }
  }
  check("pointwise  F(D) = dE/dD", worst < 0.01, `worst ${(worst * 100).toFixed(3)}% at ${(worstAt * M_TO_IN).toFixed(1)}"`);

  // 3. Draw force must vanish at brace: the string leg is vertical there.
  check("F = 0 at brace", Math.abs(st[0].drawForce) < 0.5, `${st[0].drawForce.toFixed(3)} N`);

  // 4. Cable tension exceeds string tension — that is the point of the cam's ratio.
  const mid = st[Math.floor(st.length / 2)];
  check("cable tension > string tension", mid.cableTension > mid.stringTension, `ratio ${mid.camRatio.toFixed(2)}`);

  // 5. Energy is monotone in draw: the bow never gives energy back mid-draw.
  let monotone = true;
  for (let i = 1; i < st.length; i++) if (st[i].storedEnergy < st[i - 1].storedEnergy - 1e-9) monotone = false;
  check("stored energy monotone", monotone, "");

  // 6. The mechanical advantage h_cable/h_string must collapse through the draw. This IS let-off.
  //    camRatio is h_string/h_cable, so it rises. Only the spiral cams are asked to do this:
  //    a concentric wheel has a constant ratio by construction, and an offset wheel's ratio is
  //    bounded by having to return to its starting value after one turn — which is precisely
  //    why the 1966 compound got only a little let-off and why real cams became spirals.
  const spiral = c.knobs !== undefined;
  if (spiral) {
    check(
      "cam ratio collapses (let-off)",
      st[st.length - 1].camRatio > st[0].camRatio * 2,
      `h_s/h_c: ${st[0].camRatio.toFixed(2)} → ${st[st.length - 1].camRatio.toFixed(2)}`,
    );
    // The soft cam sits at the low end on purpose: let-off and storage efficiency trade against
    // each other here, because a force plateau that fills more of the rectangle leaves the cam
    // ratio less room to collapse before the wall. The frontier, not a floor, is the claim.
    check("let-off in a compound's range", curve.letOff > 0.35, `${(curve.letOff * 100).toFixed(0)}%`);
  }
  check("let-off non-negative", curve.letOff >= -1e-9, `${(curve.letOff * 100).toFixed(1)}%`);

  console.log(
    `        peak ${(curve.peakForce * N_TO_LBF).toFixed(1)} lb` +
      `  hold ${(curve.holdingForce * N_TO_LBF).toFixed(1)} lb` +
      `  let-off ${(curve.letOff * 100).toFixed(0)}%` +
      `  peak at ${(curve.peakForceAt * M_TO_IN).toFixed(1)}"`,
  );
  console.log(
    `        brace ${(curve.braceHeight * M_TO_IN).toFixed(2)}"` +
      `  draw ${(curve.drawLength * M_TO_IN).toFixed(2)}"` +
      `  energy ${(curve.storedEnergy * J_TO_FTLB).toFixed(1)} ft·lb` +
      `  storage eff ${(curve.storageEfficiency * 100).toFixed(1)}%`,
  );
  const peakTension = Math.max(...st.map((s) => s.cableTension));
  // The IBO/ATA rating: 70 lb, 30" draw, 350 gr. Every manufacturer publishes it, so it is the
  // one number here a reader can check against a real spec sheet. Modern bows rate 330-350 fps.
  const ibo = shootBow(defaultBow(c, { drawLength: 30 }), { arrowGrains: 350 });
  console.log(
    `        peak cable tension ${(peakTension * N_TO_LBF).toFixed(0)} lb` +
      `  ·  IBO ${(ibo.exitSpeed * MPS_TO_FPS).toFixed(0)} fps` +
      `  (efficiency ${(ibo.efficiency * 100).toFixed(0)}%)`,
  );

  // A coarse rendering of the draw-force curve, so the shape is visible at a glance.
  const rows = 12;
  const cols = 56;
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(" "));
  for (let col = 0; col < cols; col++) {
    const s = st[Math.round((col / (cols - 1)) * (st.length - 1))];
    const row = rows - 1 - Math.round((s.drawForce / curve.peakForce) * (rows - 1));
    grid[Math.max(0, Math.min(rows - 1, row))][col] = "•";
  }
  console.log(grid.map((g) => `        │${g.join("")}`).join("\n"));
  console.log(`        └${"─".repeat(cols)}`);
  console.log(`         brace${" ".repeat(cols - 15)}full draw`);
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
