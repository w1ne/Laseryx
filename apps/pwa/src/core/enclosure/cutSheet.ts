import type { Document, MachineProfile } from "../model";
import { preflightEnclosure } from "./preflight";

/** Convert one physical sheet from the overview canvas into machine-local geometry. */
export function prepareCutSheet(document: Document, machine: MachineProfile, sheetId?: string): Document {
  const workspace = document.enclosureWorkspace;
  if (!workspace) return document;
  const preflight = preflightEnclosure({ workspace, document, machineProfile: machine });
  if (!preflight.ready) throw new Error(preflight.issues.filter(issue => issue.severity === "error").map(issue => issue.message).join(" "));
  const layout = workspace.sheetLayout!;
  const sheet = layout.sheets.find(item => item.id === (sheetId ?? (layout.sheets.length === 1 ? layout.sheets[0].id : undefined)));
  if (!sheet) throw new Error("Select one physical sheet before generating G-code.");
  const prefix = `components-box:${workspace.enclosure.id}:`;
  const partPrefixes = layout.placements.filter(item => item.sheetId === sheet.id).map(item => item.partId === "fit-coupon" ? `${prefix}coupon:` : `${prefix}face:${item.partId}:`);
  const objects = document.objects.filter(object => !object.construction && partPrefixes.some(part => object.id.startsWith(part))).map(object => ({ ...object, transform: { ...object.transform, e: object.transform.e - sheet.x, f: object.transform.f - sheet.y } }));
  return { ...document, objects, groups: [], sketch: undefined, enclosureWorkspace: undefined };
}
