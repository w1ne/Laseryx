import type { PolylinePath } from "../model";

export function generateFitCoupon(input: { thickness: number; clearance: number }) {
  const options = [0.05, 0.1, 0.15, 0.2, 0.25];
  const outer: PolylinePath = { closed: true, points: [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 30 }, { x: 0, y: 30 }] };
  const slots = options.map((clearance, index): PolylinePath => {
    const width = input.thickness + clearance;
    const x = 8 + index * 15;
    return { closed: true, points: [{ x: x - width / 2, y: 0 }, { x: x + width / 2, y: 0 }, { x: x + width / 2, y: 14 }, { x: x - width / 2, y: 14 }] };
  });
  return { id: "fit-coupon", bounds: { width: 80, height: 30 }, recommendedClearance: input.clearance, options, labels: options.map((value) => `${value.toFixed(2)} mm`), paths: [outer, ...slots] };
}
