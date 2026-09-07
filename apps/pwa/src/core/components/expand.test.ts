import { describe, expect, it } from "vitest";
import { expandComponent } from "./expand";
import { getExampleComponentPresetBySku } from "./examples";
import { createComponentInstance, type ComponentPreset } from "./types";

const preset = <T extends ComponentPreset>(value: T): T => value;

describe("expandComponent", () => {
  it.each([
    preset({ id: "circle", name: "Circle", kind: "circle", dimensions: { diameter: 8 } }),
    preset({ id: "slot", name: "Slot", kind: "slot", dimensions: { length: 60, width: 4 } }),
    preset({ id: "rectangle", name: "Rectangle", kind: "rectangle", dimensions: { width: 44, height: 24 } }),
    preset({ id: "rounded", name: "Rounded rectangle", kind: "rounded-rectangle", dimensions: { width: 44, height: 24, cornerRadius: 3 } }),
    preset({ id: "buttons", name: "Buttons", kind: "button-row", dimensions: { count: 4, diameter: 10, pitch: 15 } })
  ])("returns closed local paths for $kind", (componentPreset) => {
    const paths = expandComponent(createComponentInstance(componentPreset, `${componentPreset.id}-1`));

    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((path) => path.closed)).toBe(true);
  });

  it("creates four circles using dimensions copied into the instance", () => {
    const componentPreset = preset({
      id: "four-buttons",
      name: "Four buttons",
      kind: "button-row",
      dimensions: { count: 4, diameter: 10, pitch: 15 }
    });
    const instance = createComponentInstance(componentPreset, "buttons-1");
    componentPreset.dimensions.diameter = 99;
    componentPreset.dimensions.pitch = 99;

    const paths = expandComponent(instance);

    expect(paths).toHaveLength(4);
    expect(paths.map((path) => path.points[0].x)).toEqual([-17.5, -2.5, 12.5, 27.5]);
    expect(paths.every((path) => path.points[0].y === 0)).toBe(true);
    expect(instance.dimensions).toEqual({ count: 4, diameter: 10, pitch: 15 });
  });

  it("keeps a valid slot centered on the local origin", () => {
    const instance = createComponentInstance(preset({
      id: "slot", name: "Slot", kind: "slot", dimensions: { length: 10, width: 4 }
    }), "slot-1");

    const [{ points }] = expandComponent(instance);
    const xs = points.map(({ x }) => x);
    const ys = points.map(({ y }) => y);

    expect(Math.min(...xs)).toBeCloseTo(-5);
    expect(Math.max(...xs)).toBeCloseTo(5);
    expect(Math.min(...ys)).toBeCloseTo(-2);
    expect(Math.max(...ys)).toBeCloseTo(2);
  });

  it("adds preset mounting and acoustic holes after the primary opening", () => {
    const instance = createComponentInstance(preset({
      id: "microphone", name: "Microphone", kind: "circle", dimensions: { diameter: 4 },
      mechanics: { confidence: "measured", mountingHoles: [{ x: -10, y: 0, diameter: 3 }], acousticHole: { x: 2, y: 4, diameter: 2 } }
    }), "microphone-1");
    const paths = expandComponent(instance);
    expect(paths).toHaveLength(3);
  });

  it("rejects a slot whose length is smaller than its width", () => {
    const instance = createComponentInstance(preset({
      id: "slot", name: "Slot", kind: "slot", dimensions: { length: 2, width: 4 }
    }), "slot-1");

    expect(() => expandComponent(instance)).toThrowError("Slot length must be greater than or equal to width");
  });

  it.each([
    preset({ id: "circle", name: "Circle", kind: "circle", dimensions: { diameter: -1 } }),
    preset({ id: "rectangle", name: "Rectangle", kind: "rectangle", dimensions: { width: 4, height: 0 } }),
    preset({ id: "buttons", name: "Buttons", kind: "button-row", dimensions: { count: 0, diameter: 4, pitch: 8 } })
  ])("rejects non-positive $kind dimensions", (componentPreset) => {
    expect(() => expandComponent(createComponentInstance(componentPreset, "invalid")))
      .toThrowError(/must be (a positive integer|positive)/);
  });
});

describe("example component presets", () => {
  it("does not let a mutated lookup result corrupt later lookups", () => {
    const first = getExampleComponentPresetBySku("100.355.72");
    expect(first?.kind).toBe("circle");
    if (first?.kind === "circle") {
      first.dimensions.diameter = 99;
      if (first.source) first.source.vendor = "Changed";
    }

    expect(getExampleComponentPresetBySku("100.355.72")).toMatchObject({
      dimensions: { diameter: 7 },
      source: { vendor: "HESTORE" }
    });
  });
});
