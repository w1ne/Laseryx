import { describe, expect, it } from "vitest";
import { HACKATHON_KIT, getHardwareModule } from "./catalog";

describe("hackathon hardware catalog", () => {
  it("contains exactly the purchased HESTORE kit", () => {
    expect(HACKATHON_KIT.map((item) => item.sku)).toEqual([
      "100.491.54", "100.357.19", "100.431.82", "100.355.72",
      "100.220.17", "100.321.00", "100.519.82"
    ]);
  });

  it("keeps verified mounting dimensions editable", () => {
    expect(getHardwareModule("100.491.54")?.dimensions).toMatchObject({
      boardWidth: 62, boardHeight: 29, cutoutWidth: 43.72, cutoutHeight: 23.695
    });
    expect(getHardwareModule("100.355.72")).toMatchObject({ confidence: "measure", dimensions: { cutoutDiameter: 7 } });
    expect(getHardwareModule("100.220.17")?.dimensions.cutoutDiameter).toBe(6);
    expect(getHardwareModule("100.321.00")?.dimensions).toMatchObject({
      bodyWidth: 88, bodyHeight: 12.5, travel: 60, slotWidth: 2
    });
    expect(getHardwareModule("100.321.00")?.confidence).toBe("verified");
    expect(getHardwareModule("100.519.82")?.dimensions).toMatchObject({
      bodyWidth: 86.5, bodyHeight: 20, buttonDiameter: 12, buttonPitch: 20.5
    });
  });

  it("does not invent dimensions and marks internal modules", () => {
    expect(getHardwareModule("100.519.82")?.requiresMeasurement).toBe(true);
    expect(getHardwareModule("100.431.82")?.mounting).toBe("internal");
    expect(getHardwareModule("100.357.19")?.mounting).toBe("internal");
  });
});
