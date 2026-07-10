/**
 * Illinois-method root find on a bracketing interval.
 *
 * This sits in the innermost loop of the simulator: the draw curve solves two root-finds per
 * sample, and each evaluation walks a spline and finds a tangent, which is itself a root-find.
 * Bisection needs ~40 evaluations for the tolerance we want; Illinois converges superlinearly
 * and typically wants ~10. The functions here — cable length against limb deflection, string
 * length against nock position, the tangency condition — are smooth and monotone across their
 * brackets, which is exactly where it does well.
 */
export function illinois(f: (x: number) => number, lo: number, hi: number, xtol = 1e-11): number {
  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) throw new Error(`Root not bracketed on [${lo}, ${hi}]: f = ${fa}, ${fb}`);

  let c = a;
  let side = 0;
  for (let i = 0; i < 60; i++) {
    c = (fb * a - fa * b) / (fb - fa);
    if (Math.abs(b - a) < xtol) break;
    const fc = f(c);
    if (fc === 0) return c;
    if (fb * fc < 0) {
      a = b;
      fa = fb;
      side = 0;
    } else if (side === 1) {
      // The same endpoint has been retained twice: halve its value so the secant stops creeping
      // in from one side, which is the whole point of Illinois over plain regula falsi.
      fa *= 0.5;
    } else {
      side = 1;
    }
    b = c;
    fb = fc;
  }
  return c;
}
