import { describe, it, expect } from "vitest";
import { searchTemplates } from "./search";
import { TEMPLATE_LIBRARY } from "./library";

describe("sketch library", () => {
  it("has rect, circle, import only", () => {
    expect(TEMPLATE_LIBRARY.map((t) => t.id).sort()).toEqual(["circle", "import", "rect"]);
  });

  it("search finds circle via hole", () => {
    expect(searchTemplates("hole").some((t) => t.id === "circle")).toBe(true);
  });

  it("empty query returns all three", () => {
    expect(searchTemplates("")).toHaveLength(3);
  });
});
