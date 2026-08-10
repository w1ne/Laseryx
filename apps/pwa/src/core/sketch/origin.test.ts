import { describe, expect, it } from "vitest";
import {
  ORIGIN_FIX_ID,
  ORIGIN_POINT_ID,
  emptySketch,
  ensureOrigin,
  ensureSketch
} from "./index";
import { machineWorldTransformForProfile } from "../../ui/components/preview/worldTransform";

describe("machine origin", () => {
  it("ensureSketch always pins origin at 0,0 with fix", () => {
    const s = ensureSketch(null);
    expect(s.points[ORIGIN_POINT_ID]).toEqual({ id: ORIGIN_POINT_ID, x: 0, y: 0 });
    expect(s.constraints[ORIGIN_FIX_ID]?.type).toBe("fix");
  });

  it("ensureOrigin re-pins drifted origin", () => {
    let s = emptySketch();
    s = {
      ...s,
      points: { [ORIGIN_POINT_ID]: { id: ORIGIN_POINT_ID, x: 5, y: 9 } }
    };
    s = ensureOrigin(s);
    expect(s.points[ORIGIN_POINT_ID].x).toBe(0);
    expect(s.points[ORIGIN_POINT_ID].y).toBe(0);
  });

  it("frontLeft world transform places origin at bottom-left of SVG", () => {
    const t = machineWorldTransformForProfile({ w: 400, h: 300 }, "frontLeft");
    // matrix(1 0 0 -1 0 300): (0,0) → (0,300) bottom-left in Y-down SVG
    expect(t).toBe("matrix(1 0 0 -1 0 300)");
  });
});
