import { describe, it, expect } from "vitest";
import { searchTemplates } from "./search";
import { TEMPLATE_LIBRARY } from "./library";

describe("searchTemplates", () => {
  it("returns all templates for empty query", () => {
    expect(searchTemplates("").length).toBe(TEMPLATE_LIBRARY.length);
  });

  it("finds the single hole template", () => {
    const hits = searchTemplates("hole");
    expect(hits.some((t) => t.id === "hole")).toBe(true);
    expect(hits.filter((t) => t.category === "hole")).toHaveLength(1);
  });

  it("filters by category", () => {
    const holes = searchTemplates("", { category: "hole" });
    expect(holes).toHaveLength(1);
    expect(holes[0].id).toBe("hole");
  });

  it("returns empty for nonsense", () => {
    expect(searchTemplates("xyzzy-not-a-template")).toEqual([]);
  });
});
