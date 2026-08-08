import { describe, it, expect } from "vitest";
import { searchTemplates } from "./search";
import { TEMPLATE_LIBRARY } from "./library";

describe("sketch library", () => {
  it("has rect, circle, line, import — no separate construction tool", () => {
    expect(TEMPLATE_LIBRARY.map((t) => t.id).sort()).toEqual(
      ["circle", "import", "line", "rect"].sort()
    );
    expect(TEMPLATE_LIBRARY.some((t) => t.id === "construction")).toBe(false);
  });

  it("empty query returns four tools", () => {
    expect(searchTemplates("")).toHaveLength(4);
  });
});
