import { describe, it, expect } from "vitest";
import { searchTemplates } from "./search";
import { TEMPLATE_LIBRARY } from "./library";

describe("searchTemplates", () => {
  it("has five simple shapes", () => {
    expect(TEMPLATE_LIBRARY).toHaveLength(5);
  });

  it("returns all for empty query", () => {
    expect(searchTemplates("")).toHaveLength(5);
  });

  it("finds hole", () => {
    expect(searchTemplates("hole").map((t) => t.id)).toEqual(["hole"]);
  });

  it("finds rect by box", () => {
    expect(searchTemplates("box").some((t) => t.id === "rect")).toBe(true);
  });
});
