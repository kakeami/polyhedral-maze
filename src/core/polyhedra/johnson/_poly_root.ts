/**
 * Newton's method for a polynomial root, starting from `x0` and constrained
 * to a small `bracket` half-width as a sanity guard. Coefficients are listed
 * highest degree first: `[a_n, a_{n-1}, ..., a_1, a_0]`.
 *
 * Used by Sporadic Johnson solids (J85, J86, J88-J90), whose vertex geometry
 * is parameterized by a single positive root of a polynomial given on
 * Wikipedia along with its approximate decimal value. The decimal value is
 * the seed; we converge to machine precision.
 */
export function newtonPolyRoot(
  coefs: number[],
  x0: number,
  bracket = 0.05,
  tol = 1e-14,
  maxIter = 200,
): number {
  const n = coefs.length - 1;
  const f = (x: number): number => {
    let v = coefs[0]!;
    for (let i = 1; i <= n; i++) v = v * x + coefs[i]!;
    return v;
  };
  const fp = (x: number): number => {
    let v = coefs[0]! * n;
    for (let i = 1; i < n; i++) v = v * x + coefs[i]! * (n - i);
    return v;
  };
  let x = x0;
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x);
    const fpx = fp(x);
    if (fpx === 0) break;
    const step = fx / fpx;
    const next = x - step;
    if (Math.abs(next - x0) > bracket) {
      throw new Error(
        `newtonPolyRoot: iterate ${next} left bracket [${x0 - bracket}, ${x0 + bracket}]`,
      );
    }
    x = next;
    if (Math.abs(step) < tol) break;
  }
  return x;
}
