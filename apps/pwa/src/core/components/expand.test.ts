import { describe, expect, it } from "vitest";
import { expandComponent } from "./expand";
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
});
