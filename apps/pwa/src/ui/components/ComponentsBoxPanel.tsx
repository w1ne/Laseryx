import { useEffect, useState } from "react";
import type { ComponentPreset } from "../../core/components/types";
import { expandPanel } from "../../core/panel/expand";
import type { PanelDesign } from "../../core/panel/types";
import { addComponentInstance, createInstanceFromPreset, regenerateEnclosureWorkspace, type EnclosureWorkspace } from "../../core/enclosure/workspace";
import { generateFitCoupon } from "../../core/enclosure/coupon";
import { packParts } from "../../core/layout/pack";
import { expandSheetBoundaries } from "../../core/layout/sheets";
import type { Document, PathObj, Transform } from "../../core/model";
import { componentPresetRepo } from "../../io/componentPresetRepo";
import { BoxDialog, type BoxSettings } from "./BoxDialog";
import { ComponentEditor } from "./ComponentEditor";

export type ComponentsBoxPanelProps = { document: Document; onDocumentChange: (document: Document) => void };
const identity: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const examples: ComponentPreset[] = [
  { id: "example-mount-hole", name: "Mounting hole", kind: "circle", dimensions: { diameter: 4 } },
  { id: "example-cable-slot", name: "Cable slot", kind: "slot", dimensions: { length: 18, width: 6 } }
];
const generatedId = (id: string) => id.startsWith("components-box:");

function withLayers(document: Document) {
  const layers = [...document.layers];
  if (!layers.some(({ id }) => id === "layer-components-box")) layers.push({ id: "layer-components-box", name: "Components & Box", visible: true, locked: false });
  if (!layers.some(({ id }) => id === "layer-components-box-sheets")) layers.push({ id: "layer-components-box-sheets", name: "Sheet boundaries", visible: true, locked: false });
  return layers;
}

function pathObject(id: string, name: string, points: PathObj["points"], transform: Transform, construction = false): PathObj {
  return { kind: "path", id, layerId: construction ? "layer-components-box-sheets" : "layer-components-box", closed: true, points, transform, name, ...(construction ? { construction: true } : {}) };
}

export function renderEnclosureWorkspace(document: Document, workspace: EnclosureWorkspace): Document {
  const objects = document.objects.filter(({ id }) => !generatedId(id));
  const groups = (document.groups ?? []).filter(({ id }) => !generatedId(id));
  if (!workspace.enclosure.result) {
    const expansion = expandPanel(workspace.sourcePanel);
    const members: string[] = [];
    const outlineId = `components-box:panel:${workspace.sourcePanel.id}:outline`;
    objects.push(pathObject(outlineId, `${workspace.sourcePanel.name} outline`, expansion.outline.points, expansion.transform)); members.push(outlineId);
    expansion.cutouts.forEach((cutout, index) => { const id = `components-box:panel:${workspace.sourcePanel.id}:cutout:${cutout.componentId}:${index}`; objects.push(pathObject(id, cutout.componentName, cutout.path.points, expansion.transform)); members.push(id); });
    if (members.length === 1) {
      const anchorId = `components-box:panel:${workspace.sourcePanel.id}:anchor`;
      objects.push(pathObject(anchorId, `${workspace.sourcePanel.name} anchor`, [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], expansion.transform, true));
      members.push(anchorId);
    }
    groups.push({ id: `components-box:panel:${workspace.sourcePanel.id}`, name: workspace.sourcePanel.name, memberIds: members });
  } else {
    const layout = workspace.sheetLayout;
    const placements = new Map(layout?.placements.map((placement) => [placement.partId, placement]));
    const sheets = new Map(layout?.sheets.map((sheet) => [sheet.id, sheet]));
    workspace.enclosure.result.panels.forEach((panel, panelIndex) => {
      const placement = placements.get(panel.id);
      const sheet = placement ? sheets.get(placement.sheetId) : undefined;
      const transform: Transform = placement && sheet ? (placement.rotation === 90
        ? { a: 0, b: 1, c: -1, d: 0, e: sheet.x + placement.x + panel.height, f: sheet.y + placement.y }
        : { ...identity, e: sheet.x + placement.x, f: sheet.y + placement.y }) : { ...identity, e: (panelIndex % 2) * 175, f: Math.floor(panelIndex / 2) * 120 };
      const members = panel.paths.map((path, index) => {
        const id = `components-box:${workspace.enclosure.id}:face:${panel.id}:${index}`;
        objects.push(pathObject(id, index ? `${panel.name} cutout` : panel.name, path.points, transform)); return id;
      });
      if (members.length === 1) {
        const anchorId = `components-box:${workspace.enclosure.id}:face:${panel.id}:anchor`;
        objects.push(pathObject(anchorId, `${panel.name} anchor`, [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], transform, true));
        members.push(anchorId);
      }
      groups.push({ id: `components-box:${workspace.enclosure.id}:face:${panel.id}`, name: panel.name, memberIds: members });
    });
    if (layout) {
      const boundaries = expandSheetBoundaries(layout.sheets, "layer-components-box-sheets").map((boundary) => ({ ...boundary, id: `components-box:${workspace.enclosure.id}:${boundary.id}` }));
      objects.push(...boundaries);
      boundaries.forEach((boundary) => {
        const sheetId = boundary.id.split(":").at(-1);
        const anchorId = `components-box:${workspace.enclosure.id}:sheet:${sheetId}:anchor`;
        objects.push(pathObject(anchorId, `${boundary.name} anchor`, [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], boundary.transform, true));
        groups.push({ id: `components-box:${workspace.enclosure.id}:sheet:${sheetId}`, name: boundary.name ?? "Sheet", memberIds: [boundary.id, anchorId] });
      });
    }
    if (workspace.coupon.selectedClearance !== undefined) {
      const coupon = generateFitCoupon({ thickness: workspace.enclosure.parameters.thickness, clearance: workspace.coupon.selectedClearance });
      const placement = placements.get(coupon.id), sheet = placement ? sheets.get(placement.sheetId) : undefined;
      if ((placement && sheet) || !layout) {
        const transform: Transform = placement && sheet && placement.rotation === 90
          ? { a: 0, b: 1, c: -1, d: 0, e: sheet.x + placement.x + coupon.bounds.height, f: sheet.y + placement.y }
          : placement && sheet ? { ...identity, e: sheet.x + placement.x, f: sheet.y + placement.y }
            : { ...identity, e: 350, f: 360 };
        const members = coupon.paths.map((path, index) => {
          const id = `components-box:${workspace.enclosure.id}:coupon:${index}`;
          objects.push(pathObject(id, index === 0 ? "Fit coupon" : `Fit slot ${coupon.labels[index - 1]}`, path.points, transform)); return id;
        });
        groups.push({ id: `components-box:${workspace.enclosure.id}:coupon`, name: "Fit coupon", memberIds: members });
      }
    }
  }
  return { ...document, layers: withLayers(document), objects, groups, enclosureWorkspace: workspace };
}

export function ComponentsBoxPanel({ document, onDocumentChange }: ComponentsBoxPanelProps) {
  const [open, setOpen] = useState(true), [editor, setEditor] = useState<"component" | "panel" | "box" | null>(null);
  const [presets, setPresets] = useState<ComponentPreset[]>(document.enclosureWorkspace?.presets ?? []);
  const [boxSettings, setBoxSettings] = useState<BoxSettings | undefined>();
  const [message, setMessage] = useState("");
  const workspace = document.enclosureWorkspace;
  useEffect(() => { void componentPresetRepo.list().then(setPresets).catch(() => setMessage("Saved components could not be loaded.")); }, []);
  const saveWorkspace = (next: EnclosureWorkspace) => onDocumentChange(renderEnclosureWorkspace(document, next));
  const savePanel = (width: number, height: number) => {
    const panel: PanelDesign = { id: workspace?.sourcePanel.id ?? "source-panel-design", name: "Control panel", width, height, components: workspace?.sourcePanel.components ?? [], transform: identity };
    saveWorkspace(workspace ? { ...workspace, sourcePanel: panel, enclosure: { ...workspace.enclosure, result: undefined }, sheetLayout: undefined } : {
      version: 1, presets: [], sourcePanel: panel, enclosure: { id: "enclosure-main", revision: 0, parameters: { frontHeight: 35, rearHeight: 65, thickness: 3, clearance: .15, fingerTarget: 8 } }, coupon: { confirmed: false }
    }); setEditor(null); setMessage(`Panel ready · ${width} × ${height} mm`);
  };
  const placePreset = (preset: ComponentPreset, persist: boolean) => {
    if (!workspace) return;
    const copyNumber = workspace.sourcePanel.components.length + 1;
    const x = Math.min(workspace.sourcePanel.width - 10, 25 + (copyNumber - 1) * 15);
    const y = Math.min(workspace.sourcePanel.height - 10, 25 + (copyNumber - 1) * 10);
    const panel = addComponentInstance(workspace.sourcePanel, createInstanceFromPreset(preset, `${preset.id}-instance-${Date.now().toString(36)}`, { ...identity, e: x, f: y }));
    const projectPresets = workspace.presets.some(({ id }) => id === preset.id) ? workspace.presets : [...workspace.presets, preset];
    if (persist) setPresets((items) => [...items, preset]);
    saveWorkspace({ ...workspace, presets: projectPresets, sourcePanel: panel, enclosure: { ...workspace.enclosure, result: undefined }, sheetLayout: undefined });
    setEditor(null); setMessage(`${preset.name} added to the panel.`);
  };
  const saveComponent = async (preset: ComponentPreset) => {
    if (!workspace) return;
    try {
      await componentPresetRepo.create(preset);
      placePreset(preset, true);
    } catch { setMessage("That component could not be saved. Choose a different name and try again."); }
  };
  const makeBox = (settings: BoxSettings) => {
    if (!workspace) return;
    const candidate = { ...workspace, enclosure: { ...workspace.enclosure, parameters: { frontHeight: settings.frontHeight, rearHeight: settings.rearHeight, thickness: settings.thickness, clearance: settings.clearance, fingerTarget: settings.fingerTarget } }, coupon: { confirmed: false, ...(settings.includeCoupon ? { selectedClearance: settings.clearance } : {}) }, sheetLayout: undefined };
    const result = regenerateEnclosureWorkspace(candidate);
    if (!result.ok) { setMessage(result.issues.map(({ message }) => message).join(" ")); return; }
    setBoxSettings(settings); saveWorkspace(result.workspace); setEditor(null); setMessage("Six box faces generated. Arrange them when ready.");
  };
  const arrange = () => {
    if (!workspace?.enclosure.result) return;
    const parts = workspace.enclosure.result.panels.map(({ id, width, height }) => ({ id, width, height }));
    if (workspace.coupon.selectedClearance !== undefined) {
      const coupon = generateFitCoupon({ thickness: workspace.enclosure.parameters.thickness, clearance: workspace.coupon.selectedClearance });
      parts.push({ id: coupon.id, ...coupon.bounds });
    }
    const layout = packParts(parts, { sheetSize: { width: boxSettings?.sheetWidth ?? 210, height: boxSettings?.sheetHeight ?? 148 }, orientation: "landscape", margin: boxSettings?.margin ?? 5, gap: boxSettings?.gap ?? 2 });
    saveWorkspace({ ...workspace, sheetLayout: layout });
    setMessage(layout.unplacedPartIds.length ? `${layout.unplacedPartIds.length} face(s) do not fit the selected sheets.` : `${layout.sheets.length} sheet(s) arranged.`);
  };
  return <section className="components-box">
    <button type="button" className="components-box__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>Components &amp; Box</button>
    {open && <div className="components-box__body">
      <div className="components-box__actions">
        <button data-testid="workflow-action" type="button" disabled={!workspace} className={workspace && !workspace.sourcePanel.components.length ? "is-next" : ""} onClick={() => setEditor("component")}>Add component</button>
        <button data-testid="workflow-action" type="button" className={!workspace ? "is-next" : ""} onClick={() => setEditor("panel")}>{workspace ? "Edit panel" : "Create panel"}</button>
        <button data-testid="workflow-action" type="button" disabled={!workspace} className={workspace?.sourcePanel.components.length && !workspace.enclosure.result ? "is-next" : ""} onClick={() => setEditor("box")}>Make box</button>
        <button data-testid="workflow-action" type="button" disabled={!workspace?.enclosure.result} className={workspace?.enclosure.result && !workspace.sheetLayout ? "is-next" : ""} onClick={arrange}>Arrange sheets</button>
      </div>
      {!workspace?.enclosure.result && <p className="components-box__hint">{workspace ? `${workspace.sourcePanel.name} · ${workspace.sourcePanel.width} × ${workspace.sourcePanel.height} mm · ${workspace.sourcePanel.components.length} component(s)` : "Create a panel to begin."}</p>}
      {!workspace?.enclosure.result && <p className="components-box__hint">Make a box before arranging sheets.</p>}
      {workspace?.enclosure.result && <p className="components-box__hint">Six faces · {workspace.sheetLayout ? `${workspace.sheetLayout.sheets.length} sheet(s)` : "ready to arrange"}</p>}
      {editor === "component" && <ComponentEditor onSave={saveComponent} onCancel={() => setEditor(null)} />}
      {editor === "panel" && <PanelForm initial={workspace?.sourcePanel} onSave={savePanel} onCancel={() => setEditor(null)} />}
      {editor === "box" && workspace && <BoxDialog panelHeight={workspace.sourcePanel.height} onConfirm={makeBox} onCancel={() => setEditor(null)} />}
      {presets.length > 0 && <details className="components-box__examples"><summary>Saved presets</summary>{presets.map((preset) => <button type="button" key={preset.id} disabled={!workspace} onClick={() => placePreset(preset, false)}>Add {preset.name}</button>)}</details>}
      <details className="components-box__examples"><summary>Example presets</summary>{examples.map((preset) => <button type="button" key={preset.id} disabled={!workspace} onClick={() => void saveComponent({ ...preset, id: `${preset.id}-${Date.now().toString(36)}` })}>{preset.name}</button>)}</details>
      {message && <p role="status" className="components-box__message">{message}</p>}
    </div>}
  </section>;
}

function PanelForm({ initial, onSave, onCancel }: { initial?: PanelDesign; onSave: (width: number, height: number) => void; onCancel: () => void }) {
  const [width, setWidth] = useState(initial?.width ?? 160), [height, setHeight] = useState(initial?.height ?? 100);
  const error = [width, height].every((value) => Number.isFinite(value) && value > 0) ? "" : "Panel dimensions must be greater than zero and finite.";
  return <div className="components-box__editor" role="dialog" aria-label={initial ? "Edit panel" : "Create panel"}><div className="components-box__grid">
    <label>Panel width<input aria-label="Panel width" type="number" min="1" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>
    <label>Panel height<input aria-label="Panel height" type="number" min="1" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>
  </div>{error && <p role="alert" className="components-box__error">{error}</p>}<div className="components-box__editor-actions"><button type="button" disabled={!!error} onClick={() => onSave(width, height)}>Save panel</button><button type="button" onClick={onCancel}>Cancel</button></div></div>;
}
