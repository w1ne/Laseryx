import { describe, expect, it } from "vitest";
import { componentReadiness, validateMechanics } from "./mechanics";
import { createComponentInstance, type ComponentPreset } from "./types";

const preset = (): ComponentPreset => ({
  id: "display", name: "Display", kind: "rectangle", dimensions: { width: 40, height: 20 },
  mechanics: {
    confidence: "required",
    body: { width: 60, height: 30, depth: 8 },
    mountingHoles: [{ x: -25, y: 0, diameter: 3 }],
    missing: ["right mounting hole"]
  }
});

describe("component mechanics", () => {
  it("reports missing required mechanical measurements", () => {
    expect(componentReadiness(preset())).toEqual({ ready: false, missing: ["right mounting hole"], warnings: [] });
  });

  it("deep copies mechanics into component instances", () => {
    const definition = preset();
    const instance = createComponentInstance(definition, "display-1");
    instance.mechanics!.mountingHoles![0].diameter = 9;
    expect(definition.mechanics!.mountingHoles![0].diameter).toBe(3);
  });

  it("rejects invalid mechanical dimensions", () => {
    expect(validateMechanics({ confidence: "measured", body: { width: 20, height: 10, depth: -1 } })).toContain("Body depth must be positive.");
    expect(validateMechanics({ confidence: "measured", mountingHoles: [{ x: Infinity, y: 0, diameter: 3 }] })).toContain("Mounting hole position must be finite.");
  });
});
