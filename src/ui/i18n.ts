/**
 * UI strings, English and Spanish. Plain strings are labels; the `_html` ones carry inline markup
 * (`<strong>`, `<sub>`, `<sup>`) and are rendered with dangerouslySetInnerHTML — safe because the
 * content is all ours, never user input. `{camName}` in the preset disclaimer is filled at render.
 *
 * The physics core stays English-only: it has no user-facing strings, only code and comments.
 */
export type Lang = "en" | "es";

export interface Strings {
  title: string;
  sub_html: string;
  banner_html: string;

  bow: string;
  bowLabel: string;
  custom: string;
  realBows: string;
  provisionalSuffix: string;
  camLabel: string;
  reconstructedSuffix: string;
  reconstructedHint: string;

  peakWeight: string;
  drawLength: string;
  drawLengthHint: string;
  axleToAxle: string;
  braceHeight: string;
  limbPreload: string;
  limbPreloadHint: string;
  arrowMass: string;

  camTracks: string;
  momentArms: string;
  brace: string;
  fullDraw: string;
  atTheWall: string;
  upperCam: string;

  drawForceCurve: string;
  drawLengthAxis: string;
  forceAxis: string;
  energyAxis: string;
  drawForceCaption_html: string;
  tensionsCamRatio: string;
  tensionAxis: string;
  tensionsCaption_html: string;

  atThisDraw: string;
  wholeDraw: string;
  shot: string;
  publishedVsModelled: string;

  drawForce: string;
  storedEnergy: string;
  stringTension: string;
  cableTension: string;
  camRotation: string;
  limbDeflection: string;
  stringArm: string;
  cableArm: string;
  peak: string;
  holding: string;
  letOff: string;
  storageEff: string;
  arrowSpeed: string;
  arrowEnergy: string;
  efficiency: string;
  timeToExit: string;

  shotCaveat_html: string;
  published: string;
  modelled: string;
  iboSpeed: string;
  notPublished: string;
  presetDisclaimer_html: string; // uses {camName}
  provisionalLabel: string;
  guessedNotPublished: string;
  iboGapCaveat: string;
  pranaNoSpeed: string;
  source: string;

  errorTitle: string;
  errorBody: string;

  /** Translations for the assumed-field slugs (axleToAxle, braceHeight, …). */
  fieldNames: Record<string, string>;
  /** Per-bow provisional notes, keyed by catalog id. Falls back to the catalog's own English. */
  bowNotes: Record<string, string>;
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    title: "Compound bow physics",
    sub_html:
      "An interactive model for understanding how a compound bow works. Pick a cam or a real bow, set the geometry, then draw it with the slider and watch how the draw force, stored energy, and let-off change through the shot.",
    banner_html:
      "<strong>This is a vibe-coded learning tool — every number is an estimate.</strong> It is a simplified model built for intuition, not a measurement tool. Manufacturers don't publish cam profiles or limb data, so the cam shapes and many values here are guessed or fitted, and the model itself can simply be wrong. <strong>Do not use it to compare real bows or make a buying decision.</strong> The named bows are rough reconstructions, not the real thing.",

    bow: "Bow",
    bowLabel: "Bow",
    custom: "Custom",
    realBows: "Real bows (approximate)",
    provisionalSuffix: " — provisional",
    camLabel: "Cam",
    reconstructedSuffix: " (reconstructed)",
    reconstructedHint: "This bow's reconstructed cam. Pick an archetype to override it.",

    peakWeight: "Peak weight",
    drawLength: "Draw length",
    drawLengthHint: "Set by where the draw stop catches the cam, exactly as a rotating module does.",
    axleToAxle: "Axle to axle",
    braceHeight: "Brace height",
    limbPreload: "Limb preload",
    limbPreloadHint: "Limb bolt. Sets how steeply force ramps off brace — the cam plays no part in that.",
    arrowMass: "Arrow mass",

    camTracks: "Cam tracks",
    momentArms: "Moment arms",
    brace: "brace",
    fullDraw: "full draw",
    atTheWall: " — at the wall",
    upperCam: "Upper cam",

    drawForceCurve: "Draw-force curve",
    drawLengthAxis: "Draw length (in)",
    forceAxis: "Force (lb)",
    energyAxis: "Energy (ft·lb)",
    drawForceCaption_html:
      "The shaded area is the stored energy — force integrated over the stroke. Let-off is the drop from the peak to the wall. A cam that holds the peak longer stores more from the same peak weight.",
    tensionsCamRatio: "Tensions and cam ratio",
    tensionAxis: "Tension (lb)",
    tensionsCaption_html:
      "The cam is a variable-ratio gearbox. Draw force scales as τ<sub>limb</sub> · h<sub>cable</sub> / h<sub>string</sub>; when that ratio collapses near full draw, so does the force in your fingers. That is all let-off is.",

    atThisDraw: "At this draw",
    wholeDraw: "Whole draw",
    shot: "Shot",
    publishedVsModelled: "Published vs modelled",

    drawForce: "Draw force",
    storedEnergy: "Stored energy",
    stringTension: "String tension",
    cableTension: "Cable tension",
    camRotation: "Cam rotation",
    limbDeflection: "Limb deflection",
    stringArm: "String arm",
    cableArm: "Cable arm",
    peak: "Peak",
    holding: "Holding",
    letOff: "Let-off",
    storageEff: "Storage eff.",
    arrowSpeed: "Arrow speed",
    arrowEnergy: "Arrow energy",
    efficiency: "Efficiency",
    timeToExit: "Time to exit",

    shotCaveat_html:
      "Exit speed follows from energy alone: an inextensible string brings the limbs to rest exactly as it straightens, so limb mass does not enter it. The modelled losses are the string's own mass and an empirical 8% for hysteresis and friction.",
    published: "Published",
    modelled: "Modelled",
    iboSpeed: "IBO speed",
    notPublished: "not published",
    presetDisclaimer_html:
      "<strong>These presets are approximate.</strong> Manufacturers publish geometry and let-off; they never publish cam profiles, because that is the proprietary part. Each preset pairs the bow's published geometry with a cam whose let-off knob was solved to reproduce its published let-off — one number, one parameter. The cam drawn on screen is a plausible stand-in, <em>not</em> the real {camName}. Use these to feel how a bow behaves, not to spec parts or settle an argument.",
    provisionalLabel: "Provisional.",
    guessedNotPublished: "Guessed, not published:",
    iboGapCaveat:
      "The residual IBO gap (~15% low) is the model's, not the bow's. Published IBO figures are best-case and independent chronograph tests run 10-20 fps under them; the rest is the quasi-static model storing a little less energy than a real limb. ",
    pranaNoSpeed: "Prana publishes no speed rating, so there is nothing to compare the modelled figure against. ",
    source: "Source",

    errorTitle: "This bow cannot be built",
    errorBody:
      "Usually the cam runs out of string track before reaching the requested draw length. Try a shorter draw, or a cam with a larger string groove.",

    fieldNames: {
      axleToAxle: "axle-to-axle",
      braceHeight: "brace height",
      letOff: "let-off",
      drawRange: "draw range",
      iboSpeed: "IBO speed",
      peakWeight: "peak weight",
    },
    bowNotes: {},
  },

  es: {
    title: "Física del arco compuesto",
    sub_html:
      "Un modelo interactivo para entender cómo funciona un arco compuesto. Elegí una leva o un arco real, ajustá la geometría y abrí el arco con el control para ver cómo cambian la fuerza de apertura, la energía almacenada y el let-off a lo largo del disparo.",
    banner_html:
      "<strong>Esto es una herramienta de aprendizaje — cada número es una estimación.</strong> Es un modelo simplificado para entender la intuición, no una herramienta de medición. Los fabricantes no publican los perfiles de leva ni los datos de las palas, así que las formas de leva y muchos valores acá están adivinados o ajustados, y el modelo mismo puede estar equivocado. <strong>No lo uses para comparar arcos reales ni para decidir una compra.</strong> Los arcos con nombre son reconstrucciones aproximadas, no el arco real.",

    bow: "Arco",
    bowLabel: "Arco",
    custom: "Personalizado",
    realBows: "Arcos reales (aproximados)",
    provisionalSuffix: " — provisional",
    camLabel: "Leva",
    reconstructedSuffix: " (reconstruida)",
    reconstructedHint: "La leva reconstruida de este arco. Elegí un arquetipo para reemplazarla.",

    peakWeight: "Potencia pico",
    drawLength: "Apertura",
    drawLengthHint: "Definida por dónde el tope de apertura frena la leva, igual que un módulo giratorio.",
    axleToAxle: "Entre ejes",
    braceHeight: "Brace height",
    limbPreload: "Precarga de pala",
    limbPreloadHint: "Bulón de pala. Fija qué tan rápido sube la fuerza desde el brace — la leva no interviene.",
    arrowMass: "Masa de flecha",

    camTracks: "Pistas de leva",
    momentArms: "Brazos de palanca",
    brace: "brace",
    fullDraw: "apertura máx.",
    atTheWall: " — en el tope",
    upperCam: "Leva superior",

    drawForceCurve: "Curva de fuerza",
    drawLengthAxis: "Apertura (pulg)",
    forceAxis: "Fuerza (lb)",
    energyAxis: "Energía (ft·lb)",
    drawForceCaption_html:
      "El área sombreada es la energía almacenada — la fuerza integrada sobre el recorrido. El let-off es la caída del pico al tope. Una leva que sostiene el pico más tiempo almacena más con la misma potencia pico.",
    tensionsCamRatio: "Tensiones y relación de leva",
    tensionAxis: "Tensión (lb)",
    tensionsCaption_html:
      "La leva es una caja de cambios de relación variable. La fuerza escala como τ<sub>pala</sub> · h<sub>cable</sub> / h<sub>cuerda</sub>; cuando esa relación colapsa cerca de la apertura máxima, también lo hace la fuerza en tus dedos. Eso es todo el let-off.",

    atThisDraw: "En esta apertura",
    wholeDraw: "Apertura completa",
    shot: "Disparo",
    publishedVsModelled: "Publicado vs modelado",

    drawForce: "Fuerza",
    storedEnergy: "Energía almacenada",
    stringTension: "Tensión de cuerda",
    cableTension: "Tensión de cable",
    camRotation: "Rotación de leva",
    limbDeflection: "Flexión de pala",
    stringArm: "Brazo de cuerda",
    cableArm: "Brazo de cable",
    peak: "Pico",
    holding: "Sostén",
    letOff: "Let-off",
    storageEff: "Efic. almac.",
    arrowSpeed: "Velocidad de flecha",
    arrowEnergy: "Energía de flecha",
    efficiency: "Eficiencia",
    timeToExit: "Tiempo de salida",

    shotCaveat_html:
      "La velocidad de salida sale solo de la energía: una cuerda inextensible frena las palas justo cuando se endereza, así que la masa de las palas no entra. Las pérdidas modeladas son la masa de la propia cuerda y un 8% empírico por histéresis y fricción.",
    published: "Publicado",
    modelled: "Modelado",
    iboSpeed: "Velocidad IBO",
    notPublished: "no publicada",
    presetDisclaimer_html:
      "<strong>Estos presets son aproximados.</strong> Los fabricantes publican geometría y let-off; nunca publican los perfiles de leva, porque son la parte propietaria. Cada preset combina la geometría publicada del arco con una leva cuyo parámetro de let-off se resolvió para reproducir el let-off publicado — un número, un parámetro. La leva dibujada es un sustituto plausible, <em>no</em> la {camName} real. Usalos para sentir cómo se comporta un arco, no para especificar piezas ni zanjar una discusión.",
    provisionalLabel: "Provisional.",
    guessedNotPublished: "Adivinado, no publicado:",
    iboGapCaveat:
      "La diferencia de IBO que queda (~15% por debajo) es del modelo, no del arco. Las cifras IBO publicadas son el mejor caso y las pruebas de cronógrafo independientes dan 10-20 fps por debajo; el resto es que el modelo cuasiestático almacena algo menos de energía que una pala real. ",
    pranaNoSpeed: "Prana no publica velocidad, así que no hay con qué comparar la cifra modelada. ",
    source: "Fuente",

    errorTitle: "No se puede construir este arco",
    errorBody:
      "Normalmente la leva se queda sin pista de cuerda antes de llegar a la apertura pedida. Probá una apertura menor, o una leva con mayor radio de cuerda.",

    fieldNames: {
      axleToAxle: "distancia entre ejes",
      braceHeight: "brace height",
      letOff: "let-off",
      drawRange: "rango de apertura",
      iboSpeed: "velocidad IBO",
      peakWeight: "potencia pico",
    },
    bowNotes: {
      "prana-millenium-hunter":
        'Prana publica potencia (50-70 lb), largo total 112 cm (44") y materiales, y nada más. La distancia entre ejes se estima apenas por debajo del largo total publicado; el brace height y el let-off son valores típicos de poleas redondas. Dueños y vendedores confirman poleas excéntricas redondas de gran diámetro. Medí el tuyo y estos valores se vuelven reales.',
    },
  },
};
