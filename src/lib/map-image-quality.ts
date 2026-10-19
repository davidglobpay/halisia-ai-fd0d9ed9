/** Reject near-uniform tile placeholders before adding markers or attribution.
 * This is a conservative availability check, not verification of map contents.
 * Uniform water or desert may also be withheld rather than presented as evidence.
 */
export function hasMapDetail(pixels: Uint8ClampedArray): boolean {
  if (pixels.length < 16 || pixels.length % 4 !== 0) return false;
  let min = 255,
    max = 0,
    visible = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 240) continue;
    const light = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    min = Math.min(min, light);
    max = Math.max(max, light);
    visible++;
  }
  return visible >= (pixels.length / 4) * 0.95 && max - min > 12;
}
