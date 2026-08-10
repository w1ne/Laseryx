import { describe, expect, it } from "vitest";
import {
  describeConstraint,
  listAllConstraints,
  listConstraintsForEntities
} from "./constraintDisplay";
import { addConstraint, drawLine, emptySketch } from "./index";

describe("constraintDisplay", () => {
  it("lists and describes horizontal + length on a line", () => {
    let s = emptySketch();
    const d = drawLine(s, { x: 0, y: 0 }, { x: 40, y: 0 });
    s = d.sketch;
    s = addConstraint(s, { type: "horizontal", lineId: d.line.id }).sketch;
    s = addConstraint(s, {
      type: "length",
      lineId: d.line.id,
      value: { kind: "literal", value: 40 }
    }).sketch;

    const all = listAllConstraints(s);
    expect(all.length).toBe(2);
    expect(all.some((c) => c.glyph === "H")).toBe(true);
    expect(all.some((c) => c.glyph === "L")).toBe(true);

    const forLine = listConstraintsForEntities(s, [d.line.id]);
    expect(forLine.length).toBe(2);
    expect(describeConstraint(s, s.constraints[all[0].id]!)).toBeTruthy();
  });
});
