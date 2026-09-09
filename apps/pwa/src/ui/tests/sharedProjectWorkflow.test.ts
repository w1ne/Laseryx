import { describe, expect, it } from "vitest";
import { regenerateEnclosureWorkspace, type EnclosureWorkspace } from "../../core/enclosure/workspace";
import { packParts } from "../../core/layout/pack";
import { renderEnclosureWorkspace } from "../../core/enclosure/render";
import { decodeSharedProjectHash, encodeSharedProject } from "../../io/shareCapsule";

describe("shared enclosure workflow", () => {
  it("round-trips the editable box, sheet arrangement, and cutting settings", () => {
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "source", name: "Control panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .15, fingerTarget: 8 } }, coupon: {} };
    const generated = regenerateEnclosureWorkspace(base);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const sheetLayout = packParts(generated.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height })), { sheetSize: { width: 500, height: 500 }, margin: 5, gap: 3 });
    const workspace = { ...generated.workspace, sheetLayout };
    const document = renderEnclosureWorkspace({ version: 1, units: "mm", layers: [], objects: [] }, workspace);
    const camSettings = { operations: [{ id: "cut", name: "Cut", mode: "line" as const, speed: 900, power: 80, passes: 1 }] };
    const decoded = decodeSharedProjectHash(encodeSharedProject({ version: 1, document, camSettings }));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.payload.document.enclosureWorkspace).toEqual(workspace);
    expect(decoded.payload.camSettings).toEqual(camSettings);
    expect(decoded.payload.document.objects.some(({ kind }) => kind === "image")).toBe(false);
  });
});
