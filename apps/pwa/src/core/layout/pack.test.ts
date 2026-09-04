import { describe, expect, it } from "vitest";
import { packParts } from "./pack";

describe("packParts", () => {
  it("packs without overlap and reports overflow deterministically", () => {
    const parts = [
      { id: "a", width: 160, height: 65 }, { id: "b", width: 160, height: 35 },
      { id: "c", width: 95, height: 65 }, { id: "d", width: 95, height: 65 }
    ];
    const first = packParts(parts, { width: 210, height: 148, margin: 5, gap: 3, allowRotation: true });
    const second = packParts(parts, { width: 210, height: 148, margin: 5, gap: 3, allowRotation: true });
    expect(first).toEqual(second);
    expect(first.sheets.length).toBeGreaterThan(1);
    expect(first.overflow).toEqual([]);
  });

  it("does not mutate source dimensions", () => {
    const part = { id: "wide", width: 205, height: 140 };
    packParts([part], { width: 210, height: 148, margin: 5, gap: 3, allowRotation: true });
    expect(part).toEqual({ id: "wide", width: 205, height: 140 });
  });
});
