import { describe, expect, it } from "vitest";
import { HESTORE_COMPONENTS, getExampleComponentPresetBySku } from "./examples";

describe("HESTORE component library", () => {
  it("includes the display's four automatic mounting holes", () => {
    expect(getExampleComponentPresetBySku("100.491.54")?.mechanics?.mountingHoles).toEqual([
      { x: -28.95, y: -12.9, diameter: 2 },
      { x: 28.95, y: -12.9, diameter: 2 },
      { x: -28.95, y: 12.9, diameter: 2 },
      { x: 28.95, y: 12.9, diameter: 2 }
    ]);
  });

  it("uses the verified slider opening and chassis mounting pattern", () => {
    expect(getExampleComponentPresetBySku("100.321.00")).toMatchObject({
      kind: "slot",
      dimensions: { length: 60, width: 2 },
      mechanics: {
        confidence: "verified",
        mountingHoles: [
          { x: -40, y: 0, diameter: 3.2 },
          { x: 40, y: 0, diameter: 3.2 }
        ]
      }
    });
  });

  it("uses the measured four-button board and button centres", () => {
    expect(getExampleComponentPresetBySku("100.519.82")).toMatchObject({
      kind: "button-row",
      dimensions: {
        count: 4,
        diameter: 12,
        centers: [
          { x: -31.25, y: 0 },
          { x: -10.25, y: 0 },
          { x: 9.75, y: 0 },
          { x: 30.75, y: 0 }
        ]
      },
      mechanics: {
        confidence: "measured",
        body: { width: 86.5, height: 20 },
        mountingHoles: [
          { x: -41.25, y: -8, diameter: 3.5 },
          { x: 41.25, y: -8, diameter: 3.5 },
          { x: -41.25, y: 8, diameter: 3.5 },
          { x: 41.25, y: 8, diameter: 3.5 }
        ]
      }
    });
  });

  it("covers all seven purchased SKUs", () => {
    expect(HESTORE_COMPONENTS.map(({ sku }) => sku)).toEqual([
      "100.491.54", "100.357.19", "100.431.82", "100.355.72", "100.220.17", "100.321.00", "100.519.82"
    ]);
  });

  it("keeps traceable confidence and missing measurements", () => {
    expect(getExampleComponentPresetBySku("100.491.54")).toMatchObject({ mechanics: { confidence: "verified", body: { width: 62, height: 29 } } });
    expect(getExampleComponentPresetBySku("100.491.54")?.mechanics?.missing).toContain("body depth");
    expect(HESTORE_COMPONENTS.find(({ sku }) => sku === "100.519.82")).toMatchObject({ mechanics: { confidence: "measured" } });
    expect(HESTORE_COMPONENTS.find(({ sku }) => sku === "100.519.82")?.mechanics.missing).toBeUndefined();
    expect(HESTORE_COMPONENTS.find(({ sku }) => sku === "100.357.19")?.preset).toBeUndefined();
  });
});
