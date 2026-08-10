import { describe, it, expect } from "vitest";
import { searchTemplates } from "./search";
import { TEMPLATE_LIBRARY } from "./library";

describe("sketch library", () => {
  it("includes slot and round-rect patterns", () => {
    const ids = TEMPLATE_LIBRARY.map((t) => t.id);
    expect(ids).toContain("slot");
    expect(ids).toContain("round-rect");
    expect(ids).toContain("rect");
    expect(ids).toContain("circle");
  });

  it("search finds slot", () => {
    expect(searchTemplates("slot oblong").some((t) => t.id === "slot")).toBe(true);
  });
});
