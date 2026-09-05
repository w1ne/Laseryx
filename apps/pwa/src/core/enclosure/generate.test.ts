import { describe, expect, it } from "vitest";
import { createComponentInstance, type ComponentPreset } from "../components/types";
import type { PanelDesign } from "../panel/types";
import { chooseOddFingerCount, generateEnclosure } from "./generate";
import { hasSelfIntersection } from "./joints";

const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function sourcePanel(): PanelDesign {
  const display: ComponentPreset = { id: "display", name: "Display", kind: "rectangle", dimensions: { width: 44, height: 24 } };
  const button: ComponentPreset = { id: "button", name: "Button", kind: "circle", dimensions: { diameter: 8 } };
  return {
    id: "designed-front", name: "Designed front", width: 160, height: 100, transform: { ...identity, e: 50, f: 20 },
    components: [
      createComponentInstance(display, "display-1", { ...identity, e: 45, f: 30 }),
      createComponentInstance(button, "button-1", { ...identity, e: 115, f: 50 })
    ]
  };
}

describe("enclosure generation", () => {
  it("chooses symmetric odd finger counts", () => {
    expect(chooseOddFingerCount(95, 8) % 2).toBe(1);
    expect(chooseOddFingerCount(10, 8)).toBe(3);
  });

  it("turns the designed panel into one of six stable box faces without moving its cutouts", () => {
    const result = generateEnclosure(sourcePanel(), { frontHeight: 35, rearHeight: 65, thickness: 3, clearance: 0.15, fingerTarget: 8 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.enclosure.panels.map(({ id }) => id)).toEqual(["source-panel", "rear", "left", "right", "base", "service-panel"]);
    const source = result.enclosure.panels[0];
    expect(source).toMatchObject({ width: 160, height: 100, transform: { ...identity, e: 50, f: 20 } });
    expect(source.paths).toHaveLength(3);
    expect(source.paths[1]).toEqual({ closed: true, points: [{ x: 23, y: 18 }, { x: 67, y: 18 }, { x: 67, y: 42 }, { x: 23, y: 42 }] });
    expect(result.enclosure.panels.slice(1).every(({ paths }) => paths.length === 1)).toBe(true);
    expect(result.enclosure.input.depth).toBeCloseTo(Math.sqrt(100 ** 2 - 30 ** 2));
    expect(result.enclosure.panels.find(({ id }) => id === "service-panel")?.removable).toBe(true);
  });

  it("rejects an impossible slope", () => {
    const result = generateEnclosure(sourcePanel(), { frontHeight: 10, rearHeight: 110, thickness: 3, clearance: 0.15, fingerTarget: 8 });
    expect(result).toMatchObject({ ok: false, issues: [{ code: "impossible-slope" }] });
  });

  it("supports a source panel sloping toward a shorter rear without negative local geometry", () => {
    const result = generateEnclosure(sourcePanel(), { frontHeight: 65, rearHeight: 35, thickness: 3, clearance: 0.15, fingerTarget: 8 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const left = result.enclosure.panels.find(({ id }) => id === "left")!;
    expect(left.height).toBe(65);
    expect(Math.min(...left.paths[0].points.map(({ y }) => y))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...left.paths[0].points.map(({ y }) => y))).toBe(65);
  });

  it("exposes all twelve adjacency pairs on their two owning panels", () => {
    const result = generateEnclosure(sourcePanel(), { frontHeight: 35, rearHeight: 65, thickness: 3, clearance: 0.15, fingerTarget: 8 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Set(result.enclosure.joints.map(({ pairId }) => pairId)).size).toBe(12);
    expect(result.enclosure.panels.every(({ joints }) => joints.length === 4)).toBe(true);
  });

  it.each([["frontHeight", 0], ["rearHeight", Number.NaN], ["thickness", -1], ["clearance", -0.1], ["fingerTarget", 0]])("validates %s", (key, value) => {
    const result = generateEnclosure(sourcePanel(), { frontHeight: 35, rearHeight: 65, thickness: 3, clearance: 0.15, fingerTarget: 8, [key]: value });
    expect(result.ok).toBe(false);
  });

  it("applies clearance to mating paths while preserving paired topology and nominal dimensions", () => {
    const parameters = { frontHeight: 35, rearHeight: 65, thickness: 3, fingerTarget: 8 };
    const exact = generateEnclosure(sourcePanel(), { ...parameters, clearance: 0 });
    const cleared = generateEnclosure(sourcePanel(), { ...parameters, clearance: 0.2 });
    expect(exact.ok && cleared.ok).toBe(true);
    if (!exact.ok || !cleared.ok) return;
    expect(cleared.enclosure.panels.map(({ width, height }) => ({ width, height }))).toEqual(exact.enclosure.panels.map(({ width, height }) => ({ width, height })));
    expect(cleared.enclosure.panels[0].paths[0].points).not.toEqual(exact.enclosure.panels[0].paths[0].points);
    for (const pairId of new Set(cleared.enclosure.joints.map(({ pairId }) => pairId))) {
      const pair = cleared.enclosure.joints.filter((joint) => joint.pairId === pairId);
      expect(pair[0].nominalLength).toBe(pair[1].nominalLength);
      expect(pair[0].segmentCount).toBe(pair[1].segmentCount);
    }
  });

  it("rejects thickness that can make a face outline self-intersect", () => {
    const source = { ...sourcePanel(), width: 40, height: 30, components: [] };
    expect(generateEnclosure(source, { frontHeight: 30, rearHeight: 30, thickness: 20, clearance: 0, fingerTarget: 5 })).toMatchObject({ ok: false, issues: [{ code: "joint-geometry-infeasible" }] });
  });

  it("accepts thickness strictly below the conservative eighth-span boundary", () => {
    const source = { ...sourcePanel(), width: 40, height: 30, components: [] };
    expect(generateEnclosure(source, { frontHeight: 30, rearHeight: 30, thickness: 3.7, clearance: 0, fingerTarget: 5 }).ok).toBe(true);
    expect(generateEnclosure(source, { frontHeight: 30, rearHeight: 30, thickness: 3.75, clearance: 0, fingerTarget: 5 })).toMatchObject({ ok: false, issues: [{ code: "joint-geometry-infeasible" }] });
  });

  it("emits only simple closed outlines for accepted geometry", () => {
    const result = generateEnclosure(sourcePanel(), { frontHeight: 35, rearHeight: 65, thickness: 3, clearance: 0.2, fingerTarget: 8 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.enclosure.panels.every(({ paths }) => paths[0].closed && !hasSelfIntersection(paths[0]))).toBe(true);
  });
});
