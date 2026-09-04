import { describe, expect, it } from "vitest";
import { generateFitCoupon } from "./coupon";

describe("fit coupon", () => {
  it("generates five labeled clearances inside 80 by 30 mm", () => {
    const coupon = generateFitCoupon({ thickness: 3, clearance: 0.15 });
    expect(coupon.options).toEqual([0.05, 0.1, 0.15, 0.2, 0.25]);
    expect(coupon.bounds).toEqual({ width: 80, height: 30 });
    expect(coupon.labels).toHaveLength(5);
    expect(coupon.paths).toHaveLength(6);
  });
});
