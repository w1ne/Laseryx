import { describe, expect, it } from "vitest";
import { preflightEnclosure } from "./preflight";

describe("preflightEnclosure", () => {
  it("blocks unknown measurements, overflow, and invalid stock", () => {
    const result = preflightEnclosure({ thickness: 0, couponConfirmed: false, unknownMeasurements: ["TACTS-12MOD-4CH"], overflowPartIds: ["front"], overlappingPartIds: [] });
    expect(result.ready).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["INVALID_STOCK", "MEASURE_REQUIRED", "OUTSIDE_SHEET", "COUPON_UNCONFIRMED"]));
  });

  it("is ready after measurement, packing, and coupon confirmation", () => {
    expect(preflightEnclosure({ thickness: 3, couponConfirmed: true, unknownMeasurements: [], overflowPartIds: [], overlappingPartIds: [] })).toEqual({ ready: true, issues: [] });
  });
});
