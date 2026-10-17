/** Only observe content below the initial viewport; never re-hide restored content. */
export function shouldReveal(top: number, viewportHeight: number) {
  return (
    Number.isFinite(top) &&
    Number.isFinite(viewportHeight) &&
    viewportHeight > 0 &&
    top >= viewportHeight
  );
}
