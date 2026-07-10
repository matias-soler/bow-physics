/**
 * Regenerate the archetype cam control points. Run with: npx tsx src/physics/tune.ts
 * Paste the printed blocks into cams.ts.
 */
import { compoundTarget, fitCam } from "./fit";
import { CamKnobs, softCam, hybridCam, hardCam } from "./cams";
import { DEFAULT_SPEC } from "./bows";

/** rampEnd, plunge, hold-fraction. See `compoundTarget`. */
const jobs: { name: string; seed: CamKnobs; target: ReturnType<typeof compoundTarget> }[] = [
  { name: "softCam", seed: softCam.knobs!, target: compoundTarget(0.46, 0.70, 0.35) },
  { name: "hybridCam", seed: hybridCam.knobs!, target: compoundTarget(0.40, 0.74, 0.20) },
  { name: "hardCam", seed: hardCam.knobs!, target: compoundTarget(0.34, 0.78, 0.15) },
];

const arr = (a: number[]) => `[${a.map((x) => x.toFixed(4)).join(", ")}]`;

for (const j of jobs) {
  const { knobs, report } = fitCam(j.seed, j.target, DEFAULT_SPEC, 3000);
  console.log(`\n// ${j.name}: ${report}`);
  console.log(`  string: ${arr(knobs.string)},`);
  console.log(`  cable: ${arr(knobs.cable)},`);
}
