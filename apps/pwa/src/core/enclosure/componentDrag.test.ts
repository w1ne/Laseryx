import { describe, expect, it } from "vitest";
import type { EnclosureWorkspace } from "./workspace";
import { componentTransformForRenderedDrag, createComponentDragSession } from "./componentDrag";
import { renderEnclosureWorkspace } from "./render";

const workspace = (): EnclosureWorkspace => ({
  version: 1,
  presets: [],
  sourcePanel: {
    id: "panel",
    name: "Panel",
    width: 100,
    height: 60,
    transform: { a: 1, b: 0, c: 0, d: 1, e: 12, f: 8 },
    components: [{ id: "knob-1", presetId: "knob", name: "Knob", kind: "circle", dimensions: { diameter: 10 }, transform: { a: 1, b: 0, c: 0, d: 1, e: 20, f: 20 } }]
  },
  enclosure: { id: "box", revision: 0, parameters: { frontHeight: 35, rearHeight: 65, thickness: 3, clearance: .15, fingerTarget: 8 } },
  coupon: {}
});

describe("componentTransformForRenderedDrag", () => {
  it("applies a freehand rendered delta to the source component", () => {
    expect(componentTransformForRenderedDrag(workspace(), "components-box:panel:panel:cutout:knob-1:0", { a: 1, b: 0, c: 0, d: 1, e: 12, f: 8 }, { a: 1, b: 0, c: 0, d: 1, e: 34, f: 19 }))
      .toEqual({ componentId: "knob-1", transform: { a: 1, b: 0, c: 0, d: 1, e: 42, f: 31 } });
  });

  it("clamps the complete primary opening inside every panel edge", () => {
    expect(componentTransformForRenderedDrag(workspace(), "components-box:panel:panel:cutout:knob-1:0", { a: 1, b: 0, c: 0, d: 1, e: 12, f: 8 }, { a: 1, b: 0, c: 0, d: 1, e: -12, f: 68 })?.transform)
      .toMatchObject({ e: 5, f: 55 });
  });

  it("ignores outlines and generated box faces", () => {
    const transform = { a: 1, b: 0, c: 0, d: 1, e: 12, f: 8 };
    expect(componentTransformForRenderedDrag(workspace(), "components-box:panel:panel:outline", transform, transform)).toBeUndefined();
    expect(componentTransformForRenderedDrag(workspace(), "components-box:box:face:source-panel:1", transform, transform)).toBeUndefined();
  });

  it("keeps repeated absolute pointer moves relative to the drag start", () => {
    const ws = workspace();
    const document = renderEnclosureWorkspace({ version: 1, units: "mm", layers: [], objects: [] }, ws);
    const session = createComponentDragSession(document, "components-box:panel:panel:cutout:knob-1:0");
    expect(session?.resolve({ a: 1, b: 0, c: 0, d: 1, e: 13, f: 8 }).transform.e).toBe(21);
    expect(session?.resolve({ a: 1, b: 0, c: 0, d: 1, e: 14, f: 8 }).transform.e).toBe(22);
  });
});
