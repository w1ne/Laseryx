import { describe, expect, it } from "vitest";
import { createComponentInstance, type ComponentPreset } from "../components/types";
import type { Transform } from "../model";
import type { PanelDesign } from "./types";
import { validatePanel } from "./validate";

const identity: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const preset = <T extends ComponentPreset>(value: T): T => value;

function panel(components: PanelDesign["components"] = []): PanelDesign {
  return { id: "panel-1", name: "Control panel", width: 160, height: 100, transform: identity, components };
}

describe("validatePanel", () => {
  it.each([[0, 100, "width"], [160, -1, "height"], [Number.NaN, 100, "width"], [160, Infinity, "height"]])(
    "blocks a panel with invalid dimensions (%s x %s)",
    (width, height, dimension) => {
      const issues = validatePanel({ ...panel(), width: width as number, height: height as number });
      expect(issues).toContainEqual(expect.objectContaining({
        code: `panel-${dimension}-invalid`, severity: "error", panelId: "panel-1", panelName: "Control panel"
      }));
    }
  );

  it("propagates invalid dimensions with component identity", () => {
    const component = createComponentInstance(preset({
      id: "slot", name: "USB slot", kind: "slot", dimensions: { length: 2, width: 4 }
    }), "usb-1", { ...identity, e: 50, f: 50 });

    expect(validatePanel(panel([component]))).toContainEqual(expect.objectContaining({
      code: "component-dimensions-invalid",
      severity: "error",
      componentIds: ["usb-1"],
      componentNames: ["USB slot"],
      message: expect.stringContaining("USB slot")
    }));
  });

  it("blocks a rotated cutout that crosses the usable panel boundary", () => {
    const angle = Math.PI / 4;
    const component = createComponentInstance(preset({
      id: "rect", name: "Rotated display", kind: "rectangle", dimensions: { width: 20, height: 10 }
    }), "display-1", {
      a: Math.cos(angle), b: Math.sin(angle), c: -Math.sin(angle), d: Math.cos(angle), e: 5, f: 50
    });

    expect(validatePanel(panel([component]))).toContainEqual(expect.objectContaining({
      code: "cutout-outside-panel", severity: "error", componentIds: ["display-1"]
    }));
  });

  it("includes secondary mounting holes in panel bounds", () => {
    const component = createComponentInstance(preset({ id: "display", name: "Display", kind: "rectangle", dimensions: { width: 20, height: 10 }, mechanics: { confidence: "measured", mountingHoles: [{ x: -20, y: 0, diameter: 4 }] } }), "display-1", { ...identity, e: 20, f: 50 });
    expect(validatePanel(panel([component]))).toContainEqual(expect.objectContaining({ code: "cutout-outside-panel", componentIds: ["display-1"] }));
  });

  it("rejects malformed in-memory mechanical geometry", () => {
    const component = createComponentInstance(preset({ id: "bad", name: "Unsafe module", kind: "circle", dimensions: { diameter: 5 }, mechanics: { confidence: "measured", mountingHoles: [{ x: Number.NaN, y: 0, diameter: 3 }] } }), "bad-1", { ...identity, e: 40, f: 40 });
    expect(validatePanel(panel([component]))).toContainEqual(expect.objectContaining({ code: "component-dimensions-invalid", componentIds: ["bad-1"], message: expect.stringMatching(/mounting hole position/i) }));
  });

  it("blocks when transformed cutout bounds overlap and names both components", () => {
    const circle = preset({ id: "circle", name: "Button", kind: "circle", dimensions: { diameter: 10 } });
    const first = createComponentInstance(circle, "button-a", { ...identity, e: 40, f: 40 });
    const second = createComponentInstance(circle, "button-b", { ...identity, e: 47, f: 40 });

    expect(validatePanel(panel([first, second]))).toContainEqual(expect.objectContaining({
      code: "cutout-bounds-overlap",
      severity: "error",
      componentIds: ["button-a", "button-b"],
      message: expect.stringMatching(/bounds overlap/i)
    }));
  });

  it("uses primitive bounds that catch a rotated circle between tessellation samples", () => {
    const angle = Math.PI / 32;
    const component = createComponentInstance(preset({
      id: "large-circle", name: "Large dial", kind: "circle", dimensions: { diameter: 100 }
    }), "dial-1", {
      a: Math.cos(angle), b: Math.sin(angle), c: -Math.sin(angle), d: Math.cos(angle), e: 49.9, f: 60
    });

    expect(validatePanel({ ...panel([component]), width: 200, height: 120 })).toContainEqual(expect.objectContaining({
      code: "cutout-outside-panel", severity: "error", componentIds: ["dial-1"]
    }));
  });

  it.each([
    ["a", Number.NaN],
    ["b", Infinity],
    ["c", Number.NEGATIVE_INFINITY],
    ["d", Number.NaN],
    ["e", Infinity],
    ["f", Number.NEGATIVE_INFINITY]
  ] as const)("rejects a non-finite component transform coefficient %s", (coefficient, value) => {
    const component = createComponentInstance(preset({
      id: "circle", name: "Unsafe button", kind: "circle", dimensions: { diameter: 8 }
    }), "unsafe-1", { ...identity, [coefficient]: value });

    expect(validatePanel(panel([component]))).toContainEqual(expect.objectContaining({
      code: "component-transform-invalid",
      severity: "error",
      componentIds: ["unsafe-1"],
      componentNames: ["Unsafe button"],
      message: expect.stringContaining(coefficient)
    }));
  });

  it("accepts a finite affine component transform with shear and scale", () => {
    const component = createComponentInstance(preset({
      id: "rect", name: "Skewed display", kind: "rectangle", dimensions: { width: 20, height: 10 }
    }), "display-1", { a: 1.2, b: 0.15, c: 0.25, d: 0.9, e: 80, f: 50 });

    expect(validatePanel(panel([component]))).toEqual([]);
  });

  it.each([
    preset({ id: "circle", name: "Circle", kind: "circle", dimensions: { diameter: 8 } }),
    preset({ id: "slot", name: "Slot", kind: "slot", dimensions: { length: 20, width: 6 } }),
    preset({ id: "rectangle", name: "Rectangle", kind: "rectangle", dimensions: { width: 20, height: 10 } }),
    preset({ id: "rounded", name: "Rounded", kind: "rounded-rectangle", dimensions: { width: 20, height: 10, cornerRadius: 2 } }),
    preset({ id: "buttons", name: "Buttons", kind: "button-row", dimensions: { count: 3, diameter: 6, pitch: 10 } })
  ])("accepts a contained, rotated $kind cutout", (componentPreset) => {
    const angle = Math.PI / 6;
    const component = createComponentInstance(componentPreset, `${componentPreset.id}-1`, {
      a: Math.cos(angle), b: Math.sin(angle), c: -Math.sin(angle), d: Math.cos(angle), e: 80, f: 50
    });
    expect(validatePanel(panel([component]))).toEqual([]);
  });

  it("accepts valid separated cutouts", () => {
    const circle = preset({ id: "circle", name: "Button", kind: "circle", dimensions: { diameter: 7 } });
    expect(validatePanel(panel([
      createComponentInstance(circle, "left", { ...identity, e: 25, f: 25 }),
      createComponentInstance(circle, "right", { ...identity, e: 135, f: 75 })
    ]))).toEqual([]);
  });
});
