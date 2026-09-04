import { describe, expect, it } from "vitest";
import { chooseOddFingerCount, generateEnclosure } from "./generate";

describe("enclosure generation", () => {
  it("chooses symmetric odd finger counts", () => {
    expect(chooseOddFingerCount(95, 8) % 2).toBe(1);
    expect(chooseOddFingerCount(10, 8)).toBe(3);
  });

  it("creates a six-panel sloped press-fit enclosure", () => {
    const enclosure = generateEnclosure({ width: 160, depth: 95, frontHeight: 35, rearHeight: 65, thickness: 3, clearance: 0.15, fingerTarget: 8 });
    expect(enclosure.panels.map((panel) => panel.id)).toEqual(["front", "rear", "left", "right", "base", "service-lid"]);
    expect(enclosure.slopeDegrees).toBeGreaterThan(17);
    expect(enclosure.slopeDegrees).toBeLessThan(18);
    expect(enclosure.panels.every((panel) => panel.paths[0].closed)).toBe(true);
    expect(enclosure.panels.every((panel) => panel.paths[0].points.length > 12)).toBe(true);
    expect(enclosure.panels.find((panel) => panel.id === "front")?.edgePattern.horizontal).toBe(
      enclosure.panels.find((panel) => panel.id === "rear")?.edgePattern.horizontal
    );
    expect(enclosure.panels.find((panel) => panel.id === "service-lid")?.removable).toBe(true);
  });
});
