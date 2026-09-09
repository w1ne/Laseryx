import { describe, expect, it } from "vitest";
import { placeHardwareModule } from "./place";

describe("placeHardwareModule", () => {
  it("creates editable display and control cutouts", () => {
    const display = placeHardwareModule("100.491.54", { x: 10, y: 20 });
    expect(display.ok && display.part.paths[0].points[0]).toEqual({ x: -21.86, y: -11.8475 });
    expect(display.ok && display.part.parameters.cutoutWidth).toBe(43.72);
    const encoder = placeHardwareModule("100.355.72", { x: 0, y: 0 });
    expect(encoder.ok && encoder.part.paths[0].points).toHaveLength(32);
    const slider = placeHardwareModule("100.321.00", { x: 0, y: 0 });
    expect(slider.ok && slider.part.parameters.travel).toBe(60);
  });

  it("supports overrides without changing catalog defaults", () => {
    const placed = placeHardwareModule("100.355.72", { x: 1, y: 2 }, { cutoutDiameter: 6.4 }, "encoder-2");
    expect(placed.ok && placed.part.parameters.cutoutDiameter).toBe(6.4);
    expect(placed.ok && placed.part.id).toBe("encoder-2");
  });

  it("places the measured four-button openings without overrides", () => {
    const buttons = placeHardwareModule("100.519.82", { x: 0, y: 0 });
    expect(buttons.ok).toBe(true);
    expect(buttons.ok && buttons.part.paths).toHaveLength(8);
    expect(buttons.ok && buttons.part.paths.slice(0, 4).map((path) => path.points[0].x)).toEqual([-25.25, -4.25, 15.75, 36.75]);
  });
});
