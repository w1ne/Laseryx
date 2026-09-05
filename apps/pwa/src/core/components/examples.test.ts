import { describe, expect, it } from "vitest";
import { HESTORE_COMPONENTS, getExampleComponentPresetBySku } from "./examples";

describe("HESTORE component library", () => {
  it("covers all seven purchased SKUs", () => {
    expect(HESTORE_COMPONENTS.map(({ sku }) => sku)).toEqual([
      "100.491.54", "100.357.19", "100.431.82", "100.355.72", "100.220.17", "100.321.00", "100.519.82"
    ]);
  });

  it("keeps traceable confidence and missing measurements", () => {
    expect(getExampleComponentPresetBySku("100.491.54")).toMatchObject({ mechanics: { confidence: "verified", body: { width: 62, height: 29 } } });
    expect(getExampleComponentPresetBySku("100.491.54")?.mechanics?.missing).toContain("body depth");
    expect(HESTORE_COMPONENTS.find(({ sku }) => sku === "100.519.82")).toMatchObject({ mechanics: { confidence: "required", missing: expect.arrayContaining(["button diameter", "button pitch"]) } });
    expect(HESTORE_COMPONENTS.find(({ sku }) => sku === "100.357.19")?.preset).toBeUndefined();
  });
});
