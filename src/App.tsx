import { useDeferredValue, useMemo, useState } from "react";
import { BowView } from "./ui/BowView";
import { CamView } from "./ui/CamView";
import { Chart, Series } from "./ui/Chart";
import { CAMS } from "./physics/cams";
import { CATALOG, catalogCam, findBow, isProvisional } from "./physics/catalog";
import { buildBow, BowSpec, DEFAULT_SPEC } from "./physics/bows";
import { drawCurve, makeSolver, maxRotation } from "./physics/solve";
import { buildScene, viewFor } from "./ui/scene";
import { shootBow } from "./physics/dynamics";
import { J_TO_FTLB, M_TO_IN, MPS_TO_FPS, N_TO_LBF } from "./physics/bow";
import { Lang, STRINGS, Strings } from "./ui/i18n";
import "./App.css";

const C = {
  force: "#e0662b",
  energy: "#3f8fd6",
  ratio: "#8b5cf6",
  stringT: "#d94f70",
  cableT: "#2fa87c",
};

/** Render our own rich-text strings (they carry <strong>/<sub>/<sup>, never user input). */
const Html = ({ html, as = "p", className }: { html: string; as?: "p" | "div"; className?: string }) => {
  const Tag = as;
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

function Slider({
  label, value, min, max, step, unit, onChange, hint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  unit: string; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <label className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <span className="slider-value">{value.toFixed(step < 1 ? 2 : 0)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      {hint && <div className="hint">{hint}</div>}
    </label>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={tone ? { color: tone } : undefined}>
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
    </div>
  );
}

/**
 * Two independent pieces of selection state:
 *
 *   camSource   — where the cam comes from: an archetype ("arch:3") or a catalogued bow's own
 *                 reconstructed cam ("bow:hoyt-rx7"). This is what the CAM dropdown drives.
 *   matchedBow  — which catalogued bow's full published spec is currently loaded, or null for
 *                 "Custom". This is only a label; it goes null the moment any slider moves.
 *
 * They are separate on purpose. Picking a bow sets both. But nudging a geometry slider off a
 * preset should say "Custom" WITHOUT swapping the cam out from under you — otherwise the force
 * curve would jump the instant you touch axle-to-axle. So editing geometry clears matchedBow and
 * leaves camSource alone.
 */
export default function App() {
  const [lang, setLang] = useState<Lang>("en");
  const s: Strings = STRINGS[lang];
  const [camSource, setCamSource] = useState("arch:3");
  const [matchedBow, setMatchedBow] = useState<string | null>(null);
  const [peakWeight, setPeakWeight] = useState(70);
  const [drawLength, setDrawLength] = useState(29);
  const [axleToAxle, setAxleToAxle] = useState(32);
  const [braceHeight, setBraceHeight] = useState(6.75);
  const [arrowGrains, setArrowGrains] = useState(350);
  const [preload, setPreload] = useState(0.34);
  const [t, setT] = useState(1);
  const [showTangents, setShowTangents] = useState(true);
  const [showTracks, setShowTracks] = useState(true);

  // Rebuilding the bow costs tens of milliseconds — a draw-stop solve, a peak-weight solve, and
  // a few hundred solver evaluations. Defer the inputs so dragging a slider stays at 60fps and
  // the model catches up behind it. The draw slider (`t`) is deliberately NOT deferred: it only
  // calls solver.at(), which is a tenth of a millisecond.
  const cfg = {
    camSource: useDeferredValue(camSource),
    matchedBow: useDeferredValue(matchedBow),
    peakWeight: useDeferredValue(peakWeight),
    drawLength: useDeferredValue(drawLength),
    axleToAxle: useDeferredValue(axleToAxle),
    braceHeight: useDeferredValue(braceHeight),
    arrowGrains: useDeferredValue(arrowGrains),
    preload: useDeferredValue(preload),
  };
  const stale =
    cfg.camSource !== camSource || cfg.peakWeight !== peakWeight || cfg.drawLength !== drawLength ||
    cfg.axleToAxle !== axleToAxle || cfg.braceHeight !== braceHeight ||
    cfg.arrowGrains !== arrowGrains || cfg.preload !== preload;

  const model = useMemo(() => {
    const { camSource, matchedBow, peakWeight, drawLength, axleToAxle, braceHeight, arrowGrains, preload } = cfg;
    const camBow = camSource.startsWith("bow:") ? findBow(camSource.slice(4)) : undefined;
    const cam = camBow ? catalogCam(camBow) : CAMS[+camSource.slice(5)];
    // The compare panel and IBO gap only apply when a bow's whole spec is loaded unedited.
    const entry = matchedBow ? findBow(matchedBow) : undefined;
    const spec: BowSpec = { ...DEFAULT_SPEC, cam, peakWeight, drawLength, axleToAxle, braceHeight, preload };
    try {
      const bow = buildBow(spec);
      const curve = drawCurve(bow, 120);
      const shot = shootBow(bow, { arrowGrains }, curve);
      // The IBO rating is defined at 70 lb / 30" / 350 gr whatever this bow is set to, so it needs
      // its own build. Only for catalogued bows, where there is a published number to compare with.
      const ibo = entry
        ? shootBow(buildBow({ ...spec, peakWeight: 70, drawLength: 30 }), { arrowGrains: 350 }).exitSpeed
        : 0;
      return { bow, curve, shot, entry, camBow, ibo, error: null as string | null };
    } catch (e) {
      return { error: (e as Error).message, bow: null, curve: null, shot: null, entry, camBow, ibo: 0 };
    }
  }, [cfg.camSource, cfg.matchedBow, cfg.peakWeight, cfg.drawLength, cfg.axleToAxle, cfg.braceHeight, cfg.arrowGrains, cfg.preload]);

  /** Load a catalogued bow: its cam AND its published geometry. */
  const selectBow = (id: string) => {
    const entry = findBow(id);
    if (!entry) return;
    setCamSource(`bow:${id}`);
    setMatchedBow(id);
    setAxleToAxle(entry.spec.axleToAxle);
    setBraceHeight(entry.spec.braceHeight);
    setDrawLength(entry.spec.drawLength);
    setPeakWeight(entry.spec.peakWeight);
    setPreload(entry.preload ?? 0.34);
  };

  /** Pick a cam archetype. That makes it no longer a stock bow, so the bow label drops to Custom. */
  const selectCam = (index: number) => {
    setCamSource(`arch:${index}`);
    setMatchedBow(null);
  };

  /** Wrap a geometry setter so touching it drops the bow label to Custom, cam untouched. */
  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setMatchedBow(null);
  };

  // Depend on `curve`, not on the draw slider: dragging the draw slider must not rebuild these.
  // Declared before any early return — hooks cannot be conditional.
  const series = useMemo(() => {
    const st = model.curve?.states;
    if (!st) return null;
    return {
      force: [
        { label: s.drawForce, color: C.force, points: st.map((p) => [p.drawLength * M_TO_IN, p.drawForce * N_TO_LBF]) },
        { label: s.storedEnergy, color: C.energy, secondary: true, points: st.map((p) => [p.drawLength * M_TO_IN, p.storedEnergy * J_TO_FTLB]) },
      ] as Series[],
      tension: [
        { label: s.cableTension, color: C.cableT, points: st.map((p) => [p.drawLength * M_TO_IN, p.cableTension * N_TO_LBF]) },
        { label: s.stringTension, color: C.stringT, points: st.map((p) => [p.drawLength * M_TO_IN, p.stringTension * N_TO_LBF]) },
        { label: "Cam ratio", color: C.ratio, secondary: true, dashed: true, points: st.map((p) => [p.drawLength * M_TO_IN, p.camRatio]) },
      ] as Series[],
    };
  }, [model.curve, s]);

  if (model.error || !model.bow || !model.curve || !model.shot || !series) {
    return (
      <div className="app">
        <div className="error">
          <h2>{s.errorTitle}</h2>
          <p>{model.error}</p>
          <p className="hint">{s.errorBody}</p>
        </div>
      </div>
    );
  }

  const { bow, curve, shot, entry, camBow, ibo } = model;
  const { force: forceSeries, tension: tensionSeries } = series;
  const rMax = maxRotation(bow);
  const state = makeSolver(bow).at(rMax * t);
  // One scene for both views: it walks ~600 groove points, so building it twice is not free.
  const scene = buildScene(bow, state);
  // Bounds from the braced axle and the full-draw nock — both fixed through a draw, so the frame
  // does not jitter as the slider moves, but a 43" wheel bow still fits and a 30" one still fills.
  const view = viewFor(curve.states[0].axle.y, curve.states[curve.states.length - 1].nockX);



  const cursor = state.drawLength * M_TO_IN;
  const atWall = t > 0.995;

  return (
    <div className={stale ? "app recomputing" : "app"}>
      <header>
        <div className="titlebar">
          <h1>{s.title}</h1>
          <div className="lang" role="group" aria-label="Language">
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
            <button className={lang === "es" ? "on" : ""} onClick={() => setLang("es")}>ES</button>
          </div>
        </div>
        <div className="header-row">
          <Html html={s.sub_html} as="p" className="sub" />
          <Html html={s.banner_html} as="div" className="disclaimer warn banner" />
        </div>
      </header>

      <div className="layout">
        <div className="main">
        <section className="viewport">
          <div className="stage">
            <BowView scene={scene} view={view} showTangents={showTangents} showTracks={showTracks} />
            <div className="cam-inset">
              <CamView scene={scene} />
              <div className="cam-inset-label">
                {s.upperCam} · <span style={{ color: C.stringT }}>h<sub>string</sub> {(state.stringArm * 1000).toFixed(1)} mm</span>
                {" · "}
                <span style={{ color: C.cableT }}>h<sub>cable</sub> {(state.cableArm * 1000).toFixed(1)} mm</span>
              </div>
            </div>
          </div>
          <div className="draw-control">
            <input
              type="range" min={0} max={1} step={0.002} value={t}
              onChange={(e) => setT(+e.target.value)} className="draw-slider"
            />
            <div className="draw-readout">
              <span>{s.brace}</span>
              <strong>
                {(state.drawLength * M_TO_IN).toFixed(2)}″ · {(state.drawForce * N_TO_LBF).toFixed(1)} lb
                {atWall && <em>{s.atTheWall}</em>}
              </strong>
              <span>{s.fullDraw}</span>
            </div>
          </div>
          <div className="toggles">
            <label><input type="checkbox" checked={showTracks} onChange={(e) => setShowTracks(e.target.checked)} /> {s.camTracks}</label>
            <label><input type="checkbox" checked={showTangents} onChange={(e) => setShowTangents(e.target.checked)} /> {s.momentArms}</label>
          </div>
        </section>

        <section className="charts">
          <div className="chart-box">
            <h3>{s.drawForceCurve}</h3>
            <Chart series={forceSeries} xLabel={s.drawLengthAxis} yLabel={s.forceAxis} y2Label={s.energyAxis} cursorX={cursor} fillFirst height={190} />
            <Html html={s.drawForceCaption_html} as="p" className="caption" />
          </div>
          <div className="chart-box">
            <h3>{s.tensionsCamRatio}</h3>
            <Chart series={tensionSeries} xLabel={s.drawLengthAxis} yLabel={s.tensionAxis} y2Label="h_string / h_cable" cursorX={cursor} height={190} />
            <Html html={s.tensionsCaption_html} as="p" className="caption" />
          </div>
        </section>
        </div>

        <aside className="panel">
          <h2>{s.bow}</h2>
          <label className="select">
            <span>{s.bowLabel}</span>
            <select value={matchedBow ?? "custom"} onChange={(e) => (e.target.value === "custom" ? setMatchedBow(null) : selectBow(e.target.value))}>
              <option value="custom">{s.custom}</option>
              <optgroup label={s.realBows}>
                {CATALOG.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.maker} {b.model} ({b.year}){isProvisional(b) ? s.provisionalSuffix : ""}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="select">
            <span>{s.camLabel}</span>
            <select
              value={camBow ? "bow" : camSource}
              onChange={(e) => selectCam(+e.target.value.slice(5))}
            >
              {/* When a catalogued bow's own reconstructed cam is in use, show it here as the
                  current value. Choosing an archetype from the list switches to it (and Custom). */}
              {camBow && <option value="bow">{camBow.camName}{s.reconstructedSuffix}</option>}
              {CAMS.map((c, i) => <option key={c.name} value={`arch:${i}`}>{c.name}</option>)}
            </select>
            {camBow && <div className="hint">{s.reconstructedHint}</div>}
          </label>
          <Slider label={s.peakWeight} value={peakWeight} min={30} max={80} step={1} unit=" lb" onChange={edit(setPeakWeight)} />
          <Slider label={s.drawLength} value={drawLength} min={24} max={32} step={0.5} unit="″" onChange={edit(setDrawLength)}
            hint={s.drawLengthHint} />
          <Slider label={s.axleToAxle} value={axleToAxle} min={28} max={46} step={0.5} unit="″" onChange={edit(setAxleToAxle)} />
          <Slider label={s.braceHeight} value={braceHeight} min={5} max={9} step={0.25} unit="″" onChange={edit(setBraceHeight)} />
          <Slider label={s.limbPreload} value={preload} min={0.05} max={0.95} step={0.01} unit=" rad" onChange={edit(setPreload)}
            hint={s.limbPreloadHint} />
          <Slider label={s.arrowMass} value={arrowGrains} min={280} max={600} step={10} unit=" gr" onChange={setArrowGrains} />

          <h2>{s.atThisDraw}</h2>
          <div className="stats">
            <Stat label={s.drawForce} value={(state.drawForce * N_TO_LBF).toFixed(1)} unit=" lb" tone={C.force} />
            <Stat label={s.storedEnergy} value={(state.storedEnergy * J_TO_FTLB).toFixed(1)} unit=" ft·lb" tone={C.energy} />
            <Stat label={s.stringTension} value={(state.stringTension * N_TO_LBF).toFixed(0)} unit=" lb" tone={C.stringT} />
            <Stat label={s.cableTension} value={(state.cableTension * N_TO_LBF).toFixed(0)} unit=" lb" tone={C.cableT} />
            <Stat label={s.camRotation} value={((state.camRotation * 180) / Math.PI).toFixed(0)} unit="°" />
            <Stat label={s.limbDeflection} value={((state.limbDeflection * 180) / Math.PI).toFixed(1)} unit="°" />
            <Stat label={s.stringArm} value={(state.stringArm * 1000).toFixed(1)} unit=" mm" />
            <Stat label={s.cableArm} value={(state.cableArm * 1000).toFixed(1)} unit=" mm" />
          </div>

          <h2>{s.wholeDraw}</h2>
          <div className="stats">
            <Stat label={s.peak} value={(curve.peakForce * N_TO_LBF).toFixed(1)} unit=" lb" />
            <Stat label={s.holding} value={(curve.holdingForce * N_TO_LBF).toFixed(1)} unit=" lb" />
            <Stat label={s.letOff} value={(curve.letOff * 100).toFixed(0)} unit="%" />
            <Stat label={s.storageEff} value={(curve.storageEfficiency * 100).toFixed(0)} unit="%" />
          </div>

          <h2>{s.shot}</h2>
          <div className="stats">
            <Stat label={s.arrowSpeed} value={(shot.exitSpeed * MPS_TO_FPS).toFixed(0)} unit=" fps" />
            <Stat label={s.arrowEnergy} value={(shot.arrowEnergy * J_TO_FTLB).toFixed(1)} unit=" ft·lb" />
            <Stat label={s.efficiency} value={(shot.efficiency * 100).toFixed(0)} unit="%" />
            <Stat label={s.timeToExit} value={(shot.duration * 1000).toFixed(1)} unit=" ms" />
          </div>
          <Html html={s.shotCaveat_html} as="p" className="caveat" />

          {entry && (
            <>
              <h2>{s.publishedVsModelled}</h2>
              <table className="compare">
                <thead>
                  <tr><th /><th>{s.published}</th><th>{s.modelled}</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{s.letOff}{entry.assumed?.includes("letOff") && <sup>?</sup>}</td>
                    <td>{(entry.spec.letOff * 100).toFixed(0)}%</td>
                    <td className="match">{(curve.letOff * 100).toFixed(0)}%</td>
                  </tr>
                  <tr>
                    <td>{s.iboSpeed}</td>
                    <td>{entry.spec.iboSpeed ? `${entry.spec.iboSpeed} fps` : s.notPublished}</td>
                    <td className={entry.spec.iboSpeed ? "miss" : ""}>{(ibo * MPS_TO_FPS).toFixed(0)} fps</td>
                  </tr>
                  <tr>
                    <td>{s.axleToAxle}{entry.assumed?.includes("axleToAxle") && <sup>?</sup>}</td>
                    <td>{entry.spec.axleToAxle}&Prime;</td>
                    <td className={axleToAxle === entry.spec.axleToAxle ? "match" : "edited"}>{axleToAxle}&Prime;</td>
                  </tr>
                  <tr>
                    <td>{s.braceHeight}{entry.assumed?.includes("braceHeight") && <sup>?</sup>}</td>
                    <td>{entry.spec.braceHeight}&Prime;</td>
                    <td className={braceHeight === entry.spec.braceHeight ? "match" : "edited"}>{braceHeight}&Prime;</td>
                  </tr>
                </tbody>
              </table>
              <Html html={s.presetDisclaimer_html.replace("{camName}", entry.camName)} as="div" className="disclaimer" />

              {entry.assumed?.length ? (
                <div className="disclaimer warn">
                  <strong>{s.provisionalLabel}</strong> {s.bowNotes[entry.id] ?? entry.notes}
                  <div className="assumed">
                    {s.guessedNotPublished} {entry.assumed.map((f) => s.fieldNames[f] ?? f).join(", ")}
                  </div>
                </div>
              ) : null}

              <p className="caveat">
                {entry.spec.iboSpeed ? s.iboGapCaveat : s.pranaNoSpeed}
                <a href={entry.source} target="_blank" rel="noreferrer">{s.source}</a>
              </p>
            </>
          )}
        </aside>
      </div>

    </div>
  );
}
