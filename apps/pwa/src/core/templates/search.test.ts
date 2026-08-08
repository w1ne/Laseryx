import { describe, it, expect } from "vitest";
import { searchTemplates } from "./search";
import { TEMPLATE_LIBRARY } from "./library";

describe("searchTemplates", () => {
  it("returns all templates for empty query", () => {
    expect(searchTemplates("").length).toBe(TEMPLATE_LIBRARY.length);
  });

  it("finds M3 hole by size tag", () => {
    const hits = searchTemplates("m3");
    expect(hits.some((t) => t.id === "hole-m3")).toBe(true);
    expect(hits.every((t) => t.name.toLowerCase().includes("m3") || t.tags.includes("m3"))).toBe(true);
  });

  it("finds display by keyword", () => {
    const hits = searchTemplates("display tft");
    expect(hits.some((t) => t.id === "cutout-display-28")).toBe(true);
  });

  it("filters by category", () => {
    const holes = searchTemplates("", { category: "hole" });
    expect(holes.length).toBeGreaterThan(0);
    expect(holes.every((t) => t.category === "hole")).toBe(true);
  });

  it("returns empty for nonsense", () => {
    expect(searchTemplates("xyzzy-not-a-template")).toEqual([]);
  });
});
