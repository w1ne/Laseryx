import { describe, expect, it } from "vitest";
import { shouldShowConstraintToolbar } from "./ConstraintToolbar";

describe("shouldShowConstraintToolbar", () => {
  it("only shows controls for a selected sketch entity", () => {
    expect(shouldShowConstraintToolbar(undefined, [])).toBe(false);
    expect(shouldShowConstraintToolbar("plain-object", [])).toBe(false);
    expect(shouldShowConstraintToolbar(undefined, ["plain-object", "sketch:entity:line-1"])).toBe(true);
  });
});
