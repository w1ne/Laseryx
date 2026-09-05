import { describe, expect, it } from "vitest";
import { createComponentInstance, type ComponentPreset } from "../components/types";
import { expandPanel } from "./expand";
import type { PanelDesign } from "./types";

const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function examplePanel(): PanelDesign {
  const display: ComponentPreset = {
    id: "display-preset", name: "Display", kind: "rectangle", dimensions: { width: 44, height: 24 }
  };
  const button: ComponentPreset = {
    id: "button-preset", name: "Button", kind: "circle", dimensions: { diameter: 7 }
  };
  return {
    id: "front-panel",
    name: "Front panel",
    width: 160,
    height: 100,
    transform: identity,
    components: [
      createComponentInstance(display, "display-1", { ...identity, e: 40, f: 30 }),
      createComponentInstance(button, "button-1", { ...identity, e: 110, f: 45 })
    ]
  };
}

describe("expandPanel", () => {
  it("returns one local panel outline and translated owned cutouts", () => {
    const expanded = expandPanel(examplePanel());

    expect(expanded.outline).toEqual({
      closed: true,
      points: [{ x: 0, y: 0 }, { x: 160, y: 0 }, { x: 160, y: 100 }, { x: 0, y: 100 }]
    });
    expect(expanded.cutouts.map(({ componentId }) => componentId)).toEqual(["display-1", "button-1"]);
    expect(expanded.cutouts.map(({ path }) => path).every(({ closed }) => closed)).toBe(true);

    const displayPoints = expanded.cutouts[0].path.points;
    expect(Math.min(...displayPoints.map(({ x }) => x))).toBe(18);
    expect(Math.max(...displayPoints.map(({ x }) => x))).toBe(62);
    expect(Math.min(...displayPoints.map(({ y }) => y))).toBe(18);
    expect(Math.max(...displayPoints.map(({ y }) => y))).toBe(42);

    const buttonPoints = expanded.cutouts[1].path.points;
    expect(Math.min(...buttonPoints.map(({ x }) => x))).toBeCloseTo(106.5);
    expect(Math.max(...buttonPoints.map(({ x }) => x))).toBeCloseTo(113.5);
  });

  it("keeps all expanded paths panel-local when only the canvas transform moves", () => {
    const panel = examplePanel();
    const before = expandPanel(panel);
    panel.transform = { ...identity, e: 275, f: 80 };
    const after = expandPanel(panel);

    expect(after.outline).toEqual(before.outline);
    expect(after.cutouts).toEqual(before.cutouts);
    expect(after.transform).toEqual({ ...identity, e: 275, f: 80 });
  });

  it("owns copied component dimensions independently of later preset edits", () => {
    const preset: ComponentPreset = {
      id: "display-preset", name: "Display", kind: "rectangle", dimensions: { width: 44, height: 24 }
    };
    const instance = createComponentInstance(preset, "display-1", { ...identity, e: 40, f: 30 });
    const panel: PanelDesign = {
      id: "panel", name: "Panel", width: 160, height: 100, transform: identity, components: [instance]
    };
    preset.dimensions.width = 120;

    const points = expandPanel(panel).cutouts[0].path.points;
    expect(Math.max(...points.map(({ x }) => x)) - Math.min(...points.map(({ x }) => x))).toBe(44);
  });
});
