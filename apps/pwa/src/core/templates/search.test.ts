import { describe, it, expect } from "vitest";
import { searchTemplates } from "./search";
import { TEMPLATE_LIBRARY } from "./library";

describe("sketch library", () => {
  it("includes construction line tool", () => {
    expect(TEMPLATE_LIBRARY.map((t) => t.id).sort()).toEqual(
      ["circle", "construction", "import", "line", "rect"].sort()
    );
  });

  it("search finds construction guides", () => {
    const hits = searchTemplates("construction");
    expect(hits.some((t) => t.id === "construction")).toBe(true);
  });

  it("empty query returns all tools", () => {
    expect(searchTemplates("")).toHaveLength(5);
  });
});
