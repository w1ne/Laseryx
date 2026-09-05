import { expandPanel } from "../panel/expand";
import { expandSheetBoundaries } from "../layout/sheets";
import type { Document, PathObj, Transform } from "../model";
import { generateFitCoupon } from "./coupon";
import type { EnclosureWorkspace } from "./workspace";

const identity: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const generatedId = (id: string) => id.startsWith("components-box:");
const pathObject = (id: string, name: string, points: PathObj["points"], transform: Transform, construction = false): PathObj => ({ kind: "path", id, layerId: construction ? "layer-components-box-sheets" : "layer-components-box", closed: true, points, transform, name, ...(construction ? { construction: true } : {}) });

/** Derive workflow-owned geometry while preserving every unrelated document field/object. */
export function renderEnclosureWorkspace(document: Document, workspace: EnclosureWorkspace): Document {
  const objects = document.objects.filter(({ id }) => !generatedId(id));
  const groups = (document.groups ?? []).filter(({ id }) => !generatedId(id));
  const layers = [...document.layers];
  if (!layers.some(({ id }) => id === "layer-components-box")) layers.push({ id: "layer-components-box", name: "Components & Box", visible: true, locked: false });
  const sheetLayer = layers.findIndex(({ id }) => id === "layer-components-box-sheets");
  if (sheetLayer < 0) layers.push({ id: "layer-components-box-sheets", name: "Sheet boundaries", visible: true, locked: true });
  else layers[sheetLayer] = { ...layers[sheetLayer], locked: true };
  if (!workspace.enclosure.result) {
    const expansion = expandPanel(workspace.sourcePanel), members: string[] = [];
    const outlineId = `components-box:panel:${workspace.sourcePanel.id}:outline`;
    objects.push(pathObject(outlineId, `${workspace.sourcePanel.name} outline`, expansion.outline.points, expansion.transform)); members.push(outlineId);
    expansion.cutouts.forEach((cutout, index) => { const id = `components-box:panel:${workspace.sourcePanel.id}:cutout:${cutout.componentId}:${index}`; objects.push(pathObject(id, cutout.componentName, cutout.path.points, expansion.transform)); members.push(id); });
    if (members.length === 1) { const anchorId = `components-box:panel:${workspace.sourcePanel.id}:anchor`; objects.push(pathObject(anchorId, `${workspace.sourcePanel.name} anchor`, [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], expansion.transform, true)); members.push(anchorId); }
    groups.push({ id: `components-box:panel:${workspace.sourcePanel.id}`, name: workspace.sourcePanel.name, memberIds: members });
  } else {
    const layout = workspace.sheetLayout;
    const sourceCutoutNames = expandPanel(workspace.sourcePanel).cutouts.map(({ componentName }) => componentName);
    const placements = new Map(layout?.placements.map((p) => [p.partId, p]));
    const sheets = new Map(layout?.sheets.map((s) => [s.id, s]));
    workspace.enclosure.result.panels.forEach((panel, panelIndex) => {
      const placement = placements.get(panel.id), sheet = placement ? sheets.get(placement.sheetId) : undefined;
      const transform: Transform = placement && sheet ? (placement.rotation === 90 ? { a: 0, b: 1, c: -1, d: 0, e: sheet.x + placement.x + panel.height, f: sheet.y + placement.y } : { ...identity, e: sheet.x + placement.x, f: sheet.y + placement.y }) : { ...identity, e: (panelIndex % 2) * 175, f: Math.floor(panelIndex / 2) * 120 };
      const members = panel.paths.map((path, index) => { const id = `components-box:${workspace.enclosure.id}:face:${panel.id}:${index}`; const name = index === 0 ? panel.name : panel.id === "source-panel" ? (sourceCutoutNames[index - 1] ?? `${panel.name} cutout`) : `${panel.name} cutout`; objects.push(pathObject(id, name, path.points, transform)); return id; });
      if (members.length === 1) { const anchorId = `components-box:${workspace.enclosure.id}:face:${panel.id}:anchor`; objects.push(pathObject(anchorId, `${panel.name} anchor`, [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], transform, true)); members.push(anchorId); }
      groups.push({ id: `components-box:${workspace.enclosure.id}:face:${panel.id}`, name: panel.name, memberIds: members });
    });
    if (layout) {
      const boundaries = expandSheetBoundaries(layout.sheets, "layer-components-box-sheets").map((b) => ({ ...b, id: `components-box:${workspace.enclosure.id}:${b.id}` }));
      objects.push(...boundaries);
      boundaries.forEach((boundary) => { const sheetId = boundary.id.split(":").at(-1); const anchorId = `components-box:${workspace.enclosure.id}:sheet:${sheetId}:anchor`; objects.push(pathObject(anchorId, `${boundary.name} anchor`, [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], boundary.transform, true)); groups.push({ id: `components-box:${workspace.enclosure.id}:sheet:${sheetId}`, name: boundary.name ?? "Sheet", memberIds: [boundary.id, anchorId] }); });
    }
    if (workspace.coupon.selectedClearance !== undefined) {
      const coupon = generateFitCoupon({ thickness: workspace.enclosure.parameters.thickness, clearance: workspace.coupon.selectedClearance });
      const placement = placements.get(coupon.id), sheet = placement ? sheets.get(placement.sheetId) : undefined;
      if ((placement && sheet) || !layout) {
        const transform: Transform = placement && sheet && placement.rotation === 90 ? { a: 0, b: 1, c: -1, d: 0, e: sheet.x + placement.x + coupon.bounds.height, f: sheet.y + placement.y } : placement && sheet ? { ...identity, e: sheet.x + placement.x, f: sheet.y + placement.y } : { ...identity, e: 350, f: 360 };
        const members = coupon.paths.map((path, index) => { const id = `components-box:${workspace.enclosure.id}:coupon:${index}`; objects.push(pathObject(id, index ? `Fit slot ${coupon.labels[index - 1]}` : "Fit coupon", path.points, transform)); return id; });
        groups.push({ id: `components-box:${workspace.enclosure.id}:coupon`, name: "Fit coupon", memberIds: members });
      }
    }
  }
  return { ...document, layers, objects, groups, enclosureWorkspace: workspace };
}
