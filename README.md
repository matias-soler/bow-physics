# Compound bow physics

An interactive model for understanding how a compound bow works: pick a cam or a real bow, set the
geometry, then draw it with the slider and watch the draw force, stored energy, and let-off change
through the shot. The UI has an EN/ES language toggle (top-right).

> **A learning tool, not a measurement tool.** Every number is an estimate. Manufacturers don't
> publish cam profiles or limb data, so the cam shapes and many values are guessed or fitted, and
> the model itself can be wrong. Don't use it to compare real bows or make a buying decision.

```
npm install
npm run dev          # the app
npm run check        # physics consistency checks — run this after touching src/physics
npm run fit-catalog  # re-solve the real bows' let-off knob against their published specs
npm run tune         # refit the cam archetypes (slow)
```

## The one thing to understand

**The cams store no energy.** Every joule the bow holds is bending strain in the two limbs. The
cams are a variable-ratio gearbox that decides how that energy is presented to your hand.

That single fact organises the whole model. By virtual work,

```
F_draw · dD  =  2 · τ_limb(φ) · dφ
```

and the two rates are set by the cam's moment arms — the string pays out `h_string` metres per
radian of cam rotation, the cable takes up `h_cable` per radian. So

```
F_draw  ∝  τ_limb(φ) · h_cable / h_string · (component of the string leg along the draw)
```

- **`τ_limb(φ)`** climbs monotonically as you draw. On its own the bow would just get heavier.
- **`h_cable / h_string`** is the gear ratio. Collapsing it near full draw is what let-off *is*.
  The draw stop catches the cam at the bottom of the collapse; that is the "wall".
- **The leg-angle term** is why the force is zero at brace and ramps from there. At brace the
  string leg stands vertical and has no component along the draw. How *steeply* it ramps is set by
  string tension at brace, hence by **limb-bolt preload** — not by the cam.

## How the model is built

Everything is SI internally. `+x` points at the archer, `+y` up, the origin is the grip pivot, and
the bow is mirror-symmetric about `y = 0`, so only the upper half is ever solved.

### Cams are support functions

A groove is described by its **support function** `h(u)`: the perpendicular distance from the axle
to the groove's tangent line whose outward normal points along `u`. Two identities make this the
right representation:

1. A line departing tangentially at normal-angle `u` exerts torque `T · h(u)` about the axle. The
   support function is the moment arm.
2. The radius of curvature is `ρ(u) = h(u) + h''(u)`, so arc length is `∫ρ du`, in closed form.
   String payout needs no numerical differentiation, so the force curve carries no differencing
   noise.

`h` is defined on an *interval*, not a circle. A closed convex curve's support function must return
to its starting value after one turn, but a compound cam turns about 270°, and monotone moment arms
over that sweep are what let-off requires. Real cams are therefore **spirals** — a track that
overlaps itself and steps back at the anchor post. The only physical requirement is `h + h'' > 0`
pointwise; there is no global convexity condition.

### Limbs are calibrated hinges

Each limb is a rigid bar hinged at the pocket, resisted by a nonlinear torsion spring
`τ(φ) = k₀φ + k₁φ²`. A real limb is a tapered composite cantilever, but the archer only observes it
through its tip, and a hinge with the right `τ(φ)` reproduces the tip behaviour. A beam model would
need cross-section, taper and modulus — none of which manufacturers publish — so it would give a
worse answer than a hinge calibrated to a public draw-force curve. `LimbModel` in `limb.ts` is the
seam: a beam solver can drop in behind it without changing anything upstream.

### The solve

One degree of freedom: cam rotation `r`. Everything else follows in order, with no outer iteration,
because each step is a closed form or a single monotone root-find.

| Given | Solve for | How |
|---|---|---|
| `r` | limb deflection `φ` | cable length is constant → Illinois root-find |
| `r`, `φ` | nock position `D` | string length is constant → Illinois root-find |
| geometry | `T_string`, `T_cable` | cam torque balance, then limb torque balance |

Draw length is set by the **draw stop**, exactly as a rotating module does on a real bow.
Axle-to-axle and brace height are pure placement of the limb pocket. Peak weight scales limb
stiffness — draw force is exactly linear in limb torque, so one probe solve gives the factor. All
three decouple, which is why `buildBow` needs no fixed point.

## Why you can trust it

Draw force is computed from a torque balance; stored energy from limb strain. These are independent
routes — if the geometry, moment arms, or wrap handedness were wrong, they would disagree.

```
npm run check
```

asserts `F(D) = dE/dD`. It holds to **0.01% worst case** pointwise and `∫F dD = ΔU_limb` to
**0.00%**. The checks also cover force vanishing at brace, cable tension exceeding string tension,
energy monotone in draw, and the cam ratio collapsing.

## Accuracy

At 70 lb and 29" the archetypes land here:

| Cam | Let-off | Storage eff. | Stored | IBO |
|---|---|---|---|---|
| Round wheel | 0% | 51% | 61 ft·lb | 259 fps |
| Eccentric wheel (1966) | 39% | 60% | 72 ft·lb | 281 fps |
| Soft | 37% | 78% | 94 ft·lb | 321 fps |
| Hybrid | 65% | 72% | 87 ft·lb | 306 fps |
| Hard | 80% | 69% | 82 ft·lb | 297 fps |

Let-off and stored energy are in the right place. The accuracy limit is **storage efficiency** —
the fraction of the peak-force rectangle the draw-force curve fills. The model reaches ~69% at 80%
let-off where a real bow reaches ~78%, so arrow speed lands ~15% below published IBO figures.

There is a real trade between let-off and storage: a curve that lets off harder fills less of the
rectangle, which is why the soft cam stores more than the hard cam. That trade is a prediction of
the model, not a fudge — it falls out of the same identity as everything else.

Exit speed is `v = √(2·η·E / (m_arrow + m_string/3))`, so with stored energy `E` fixed the residual
gap is split between the quasi-static limb storing a little less than a real limb, and published IBO
figures being best-case (independent chronograph tests run 10-20 fps under them). Closing it fully
would need the beam limb model behind the `LimbModel` seam.

## What is not modelled

- **Exit speed does not depend on limb mass.** As the string straightens, `dD/dr` diverges, so the
  generalised inertia diverges and the limbs are at rest the instant the arrow leaves. Taking the
  limit, `v = √(2E / (m_arrow + m_string/3))`. This is a real property of an inextensible, lossless
  string with the arrow held to brace. `mechanicalEfficiency` (default 0.92) is a fudge for
  hysteresis and friction; it is not derived from anything.
- **No string stretch, no cam lean, no limb torsion, no axle friction, no archer's paradox.**
- **No real cam profiles.** Manufacturers do not publish cam geometry. The archetypes are fitted to
  target draw-force curves; the catalogued bows to their published let-off. Neither is traced from a
  real cam.

## Real bows

Five presets, selectable in the dropdown.

| Bow | Cam | ATA | Brace | Let-off (pub / model) | IBO (pub / model) |
|---|---|---|---|---|---|
| Hoyt Carbon RX-7 (2022) | spiral | 30" | 6.25" | 80% / 80% | 342 / 298 fps |
| Hoyt Carbon RX-7 Ultra (2022) | spiral | 34" | 7" | 80% / 80% | 334 / 292 fps |
| Mathews Lift 29.5 (2024) | spiral | 29.5" | 6" | 80% / 80% | 348 / 298 fps |
| Mathews Lift 33 (2024) | spiral | 33" | 6.5" | 80% / 80% | 343 / 298 fps |
| Prana Millenium Hunter | round wheels | 43"? | 7.5"? | 50%? / 50% | — / 290 fps |

**The cams are reconstructions.** Manufacturers publish geometry and let-off, never cam profiles.
Each preset pairs the bow's published geometry with a cam whose let-off knob — `cableEnd` for a
spiral, `cableEcc` for a wheel — is solved so the model reproduces the published let-off. One
published number, one free parameter. What is drawn on screen is not the real HBX Pro, SWX, or
Prana wheels; forces and energies are roughly right because they are pinned to real geometry and
real let-off, and everything else is inference. Each preset also carries a limb **preload** set
from the real bow's limb pose (modern past-parallel bows sit near horizontal at brace, the older
Prana keeps straighter limbs); the let-off knob is re-solved at that preload.

**The Prana entry is provisional.** Prana publishes only draw weight (50-70 lb), overall length
112 cm (44"), mass and materials. The `?` fields — axle-to-axle 43", brace 7.5", let-off 50% — are
guessed from the class of bow; owners and retailers confirm round eccentric wheels of large
diameter. Those big wheels turn only ~180° through the draw, and half a turn is exactly where a
wheel's `h(u) = r + e·cos(u−ψ)` sweeps monotonically — which is why the breed works at long
axle-to-axle where a short modern bow cannot use wheels.

Regenerate the fitted knobs with `npm run fit-catalog` after changing any published spec.

### Adding one

For a bow with only a spec sheet: add an entry to `CATALOG`, seed the cam from an archetype, and run
`npm run fit-catalog` to solve its let-off knob. List any field the maker does not publish in
`assumed` — the UI marks those with a `?` and flags the preset as provisional.

For a bow you can measure or whose draw-force curve is published: `fit.ts` searches a cam's control
points against a whole `TargetCurve` (normalised force against stroke fraction, which is what a
published draw-force curve is), constraining the whole curve rather than one number.

## Layout

```
src/physics/     pure TypeScript, no React, no DOM
  vec2.ts        2D vector math
  support.ts     support functions, spiral grooves, tangent construction
  limb.ts        LimbModel interface + calibrated torsion hinge
  bow.ts         types, unit conversions, wrap handedness
  cams.ts        cam archetypes and families
  solve.ts       the quasi-static solver
  dynamics.ts    the shot cycle
  bows.ts        geometry solve: draw length, axle-to-axle, brace, peak weight
  catalog.ts     real bows: published specs + reconstructed cams
  fit.ts         Nelder-Mead fit of cam control points to a target curve
  fitcatalog.ts  solve each catalogued bow's let-off knob  (npm run fit-catalog)
  check.ts       physical consistency checks  (npm run check)
  tune.ts        regenerate archetypes         (npm run tune)
src/ui/          React + SVG
  scene.ts       world → SVG geometry for the bow drawing
  BowView.tsx    the big bow; CamView.tsx the magnified cam inset
  Chart.tsx      the draw-force and tension plots
  i18n.ts        UI strings, English + Spanish
src/App.tsx      the whole UI: sliders, dropdowns, stats, panels
```
