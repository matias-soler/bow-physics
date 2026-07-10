import { Cam } from "./bow";
import { SpiralParams, WheelParams, spiralCam, wheelCam } from "./cams";

/**
 * Real bows, RECONSTRUCTED — not measured.
 *
 * Read this before believing anything below. Manufacturers publish geometry (axle-to-axle,
 * brace height, draw range) and performance (peak weight, let-off, IBO speed). They do NOT
 * publish cam profiles: that is the proprietary part, and no amount of searching will find it.
 *
 * So each entry pairs a bow's real published geometry with a cam whose `cableEnd` — the moment
 * arm the buss cable has at full draw, which is the let-off knob — was solved so the model
 * reproduces that bow's published let-off. Everything else about the cam is the archetype family.
 *
 * What that buys you: the FORCES and ENERGIES this simulator reports for a named bow are
 * roughly right, because they are pinned to that bow's real geometry and real let-off.
 *
 * What it does not buy you: the cam you see drawn on screen is a plausible reconstruction, not
 * the real part. The Hoyt HBX and the Mathews SWX do not look like this. Do not measure a real
 * cam against it, and say so to anyone you show it to.
 *
 * The honest way to improve an entry is to digitise its published draw-force curve and hand that
 * to `fitCam` in fit.ts, which searches the cam's control points against a whole target curve
 * rather than a single number. See the README.
 */
/** Exactly what the manufacturer publishes. Nothing here is inferred. */
export interface PublishedSpec {
  /** Axle-to-axle at brace, inches. */
  axleToAxle: number;
  braceHeight: number;
  /** Draw length this entry is configured at, inches. */
  drawLength: number;
  /** Draw-length range the bow supports, inches. */
  drawRange: [number, number];
  peakWeight: number;
  weightRange: [number, number];
  /** Published let-off, as a fraction. Most of these ship switchable between 80% and 85%. */
  letOff: number;
  /** Published IBO/ATA rating: 70 lb, 30" draw, 350 gr arrow. Zero when the maker publishes none. */
  iboSpeed: number;
}

/**
 * Which of a spec's fields the manufacturer does NOT publish, and which we therefore guessed.
 *
 * Every entry is a reconstruction of the cam, but an entry with a non-empty `assumed` list is a
 * reconstruction of the BOW. Keep the two failures separate: one is a known limit of what anyone
 * can know from outside, the other is us making numbers up until somebody measures the thing.
 */
export type AssumedField = keyof PublishedSpec;

export interface CatalogBow {
  id: string;
  maker: string;
  model: string;
  year: number;
  /** The manufacturer's name for the cam. Ours is a reconstruction, not this part. */
  camName: string;
  spec: PublishedSpec;
  /**
   * Limb-bolt preload, radians of limb deflection at brace. Also the visible limb pose: modern
   * "past parallel" bows sit near horizontal at brace (high preload); older bows keep straighter,
   * more swept limbs (low preload). Set from the real bow's look, then the let-off knob is
   * re-solved at this preload. Defaults to 0.34 when absent.
   */
  preload?: number;
  /** Reconstructed cam: a spiral cam, or a pair of eccentric wheels. */
  cam: { kind: "spiral"; params: SpiralParams } | { kind: "wheel"; params: WheelParams };
  /** Spec fields NOT published by the maker. Empty means the whole spec is sourced. */
  assumed?: AssumedField[];
  notes?: string;
  source: string;
}

export const CATALOG: CatalogBow[] = [
  {
    id: "hoyt-rx7",
    maker: "Hoyt",
    model: "Carbon RX-7",
    year: 2022,
    camName: "HBX Pro",
    spec: {
      axleToAxle: 30,
      braceHeight: 6.25,
      drawLength: 29,
      drawRange: [27, 30],
      peakWeight: 70,
      weightRange: [40, 80],
      letOff: 0.8,
      iboSpeed: 342,
    },
    preload: 0.65, // modern past-parallel limbs sit near horizontal at brace
    cam: { kind: "spiral", params: {
      stringBase: 0.006, stringEnd: 0.082, stringGrowth: 1.7,
      cableBase: 0.044, cableEnd: 0.00316, cableMid: 5.0, cableWidth: 0.50,
    } },
    source: "https://fieldandstream.com/outdoor-gear/hunting-gear/bow-hunting/compound-bows/hoyt-carbon-rx7-bow-review",
  },
  {
    id: "hoyt-rx7-ultra",
    maker: "Hoyt",
    model: "Carbon RX-7 Ultra",
    year: 2022,
    camName: "HBX Pro",
    spec: {
      axleToAxle: 34,
      braceHeight: 7,
      drawLength: 29,
      drawRange: [27, 32],
      peakWeight: 70,
      weightRange: [40, 80],
      letOff: 0.8,
      iboSpeed: 334,
    },
    preload: 0.65,
    cam: { kind: "spiral", params: {
      stringBase: 0.006, stringEnd: 0.082, stringGrowth: 1.7,
      // Narrower plunge than the others: with 34" between the axles and a 7" brace the cam turns
      // less through the draw, so the collapse has to be sharper to reach 80%.
      cableBase: 0.044, cableEnd: 0.00324, cableMid: 4.9, cableWidth: 0.42,
    } },
    source: "https://lancasterarchery.com/products/hoyt-rx-7-ultra-compound-hunting-bow",
  },
  {
    id: "mathews-lift-29",
    maker: "Mathews",
    model: "Lift 29.5",
    year: 2024,
    camName: "SwitchWeight X (SWX)",
    spec: {
      axleToAxle: 29.5,
      braceHeight: 6,
      drawLength: 29,
      drawRange: [24.5, 30],
      peakWeight: 70,
      weightRange: [55, 80],
      letOff: 0.8,
      iboSpeed: 348,
    },
    preload: 0.65,
    cam: { kind: "spiral", params: {
      stringBase: 0.006, stringEnd: 0.082, stringGrowth: 1.7,
      cableBase: 0.044, cableEnd: 0.00336, cableMid: 5.0, cableWidth: 0.50,
    } },
    source: "https://stories.mathewsinc.com/product/lift29-5/",
  },
  {
    id: "mathews-lift-33",
    maker: "Mathews",
    model: "Lift 33",
    year: 2024,
    camName: "SwitchWeight X (SWX)",
    spec: {
      axleToAxle: 33,
      braceHeight: 6.5,
      drawLength: 29,
      drawRange: [26, 31.5],
      peakWeight: 70,
      weightRange: [55, 80],
      letOff: 0.8,
      iboSpeed: 343,
    },
    preload: 0.65,
    cam: { kind: "spiral", params: {
      stringBase: 0.006, stringEnd: 0.082, stringGrowth: 1.7,
      cableBase: 0.044, cableEnd: 0.00244, cableMid: 5.0, cableWidth: 0.50,
    } },
    source: "https://stories.mathewsinc.com/product/lift33/",
  },
  {
    id: "prana-millenium-hunter",
    maker: "Prana",
    model: "Millenium Hunter",
    year: 2010,
    camName: "Round eccentric wheels",
    spec: {
      // Prana publishes only draw weight, overall length, mass and materials. Everything below
      // that is flagged in `assumed` is a guess from the class of bow, not from the maker.
      axleToAxle: 43,
      braceHeight: 7.5,
      drawLength: 29,
      drawRange: [26, 30],
      peakWeight: 70,
      weightRange: [50, 70],
      letOff: 0.5,
      iboSpeed: 0,
    },
    preload: 0.05, // older bow: straighter, more swept limbs than a modern parallel-limb cam
    cam: { kind: "wheel", params: {
      // Retailers describe "poleas de mayor diámetro" and owners "poleas redondas muy suaves":
      // large wheels, modest eccentricity. The phases put the string wheel's fat side and the
      // cable wheel's thin side at the wall, which is the whole of where let-off comes from.
      //
      // Big wheels on a 43" bow turn only ~180° through the draw, and half a turn is exactly the
      // range over which a wheel's h(u) = r + e·cos(u − ψ) sweeps monotonically. That is why this
      // breed works at all, and why a short-ATA bow cannot use wheels.
      stringRadius: 0.050, stringEcc: 0.020, stringPhase: 3.8,
      cableRadius: 0.030, cableEcc: 0.02007, cablePhase: 3.2,
    } },
    assumed: ["axleToAxle", "braceHeight", "letOff", "drawRange", "iboSpeed"],
    notes:
      "Prana publishes draw weight (50-70 lb), overall length 112 cm (44\") and materials, and nothing else. " +
      "Axle-to-axle is guessed just under the published overall length; brace height and let-off are " +
      "typical round-wheel values. Owners and retailers confirm round eccentric wheels of large diameter. " +
      "Measure yours and these become real.",
    source: "https://pranaarchery.com.ar/producto/arco-prana-millenium-hunter/",
  },
];

export const catalogCam = (b: CatalogBow): Cam => {
  const name = `${b.maker} ${b.model}`;
  return b.cam.kind === "spiral" ? spiralCam(name, b.cam.params) : wheelCam(name, b.cam.params);
};

export const findBow = (id: string): CatalogBow | undefined => CATALOG.find((b) => b.id === id);

/** True when some of the bow's own spec was guessed, not just its cam profile. */
export const isProvisional = (b: CatalogBow): boolean => (b.assumed?.length ?? 0) > 0;
