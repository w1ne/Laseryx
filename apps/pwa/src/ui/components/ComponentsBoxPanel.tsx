import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentPreset } from "../../core/components/types";
import type { PanelDesign } from "../../core/panel/types";
import { addComponentInstance, createInstanceFromPreset, regenerateEnclosureWorkspace, type EnclosureWorkspace } from "../../core/enclosure/workspace";
import { generateFitCoupon } from "../../core/enclosure/coupon";
import { preflightEnclosure } from "../../core/enclosure/preflight";
import { packParts } from "../../core/layout/pack";
import type { Document, MachineProfile, Transform } from "../../core/model";
import { renderEnclosureWorkspace } from "../../core/enclosure/render";
import { componentPresetRepo } from "../../io/componentPresetRepo";
import { BoxDialog, type BoxSettings } from "./BoxDialog";
import { ComponentEditor } from "./ComponentEditor";

export type ComponentsBoxPanelProps = {
  document: Document;
  /** Legacy standalone integration. Store-backed callers should use onWorkspaceChange. */
  onDocumentChange?: (document: Document) => void;
  onWorkspaceChange?: (workspace: EnclosureWorkspace) => void;
  machineProfile?: Pick<MachineProfile, "bedMm">;
};
const identity: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const examples: ComponentPreset[] = [
  { id: "example-mount-hole", name: "Mounting hole", kind: "circle", dimensions: { diameter: 4 } },
  { id: "example-cable-slot", name: "Cable slot", kind: "slot", dimensions: { length: 18, width: 6 } }
];
export function ComponentsBoxPanel({ document, onDocumentChange, onWorkspaceChange, machineProfile }: ComponentsBoxPanelProps) {
  const [open, setOpen] = useState(true), [editor, setEditor] = useState<"component" | "panel" | "box" | null>(null);
  const [repoPresets, setRepoPresets] = useState<ComponentPreset[]>([]);
  const [savingComponent, setSavingComponent] = useState(false);
  const [message, setMessage] = useState("");
  const workspace = document.enclosureWorkspace;
  const latestDocument = useRef(document), savePending = useRef(false);
  latestDocument.current = document;
  const presets = useMemo(() => {
    const merged = new Map(repoPresets.map((preset) => [preset.id, preset]));
    for (const preset of workspace?.presets ?? []) merged.set(preset.id, preset);
    return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }, [repoPresets, workspace?.presets]);
  const preflight = useMemo(() => workspace?.enclosure.result ? preflightEnclosure({ workspace, stockWidth: workspace.packing?.sheetSize.width, stockHeight: workspace.packing?.sheetSize.height, machineProfile }) : undefined, [workspace, machineProfile]);
  useEffect(() => { void componentPresetRepo.list().then(setRepoPresets).catch(() => setMessage("Saved components could not be loaded.")); }, []);
  const saveWorkspace = (next: EnclosureWorkspace, base = latestDocument.current) => {
    if (onWorkspaceChange) onWorkspaceChange(next);
    else onDocumentChange?.(renderEnclosureWorkspace(base, next));
  };
  const savePanel = (width: number, height: number) => {
    const panel: PanelDesign = { id: workspace?.sourcePanel.id ?? "source-panel-design", name: "Control panel", width, height, components: workspace?.sourcePanel.components ?? [], transform: identity };
    saveWorkspace(workspace ? { ...workspace, sourcePanel: panel, enclosure: { ...workspace.enclosure, result: undefined }, sheetLayout: undefined } : {
      version: 1, presets: [], sourcePanel: panel, enclosure: { id: "enclosure-main", revision: 0, parameters: { frontHeight: 35, rearHeight: 65, thickness: 3, clearance: .15, fingerTarget: 8 } }, coupon: { confirmed: false }
    }); setEditor(null); setMessage(`Panel ready · ${width} × ${height} mm`);
  };
  const placePreset = (preset: ComponentPreset, persist: boolean) => {
    const base = latestDocument.current, current = base.enclosureWorkspace;
    if (!current) return;
    const copyNumber = current.sourcePanel.components.length + 1;
    const x = Math.min(current.sourcePanel.width - 10, 25 + (copyNumber - 1) * 15);
    const y = Math.min(current.sourcePanel.height - 10, 25 + (copyNumber - 1) * 10);
    const panel = addComponentInstance(current.sourcePanel, createInstanceFromPreset(preset, `${preset.id}-instance-${Date.now().toString(36)}`, { ...identity, e: x, f: y }));
    const projectPresets = current.presets.some(({ id }) => id === preset.id) ? current.presets : [...current.presets, preset];
    if (persist) setRepoPresets((items) => items.some(({ id }) => id === preset.id) ? items : [...items, preset]);
    saveWorkspace({ ...current, presets: projectPresets, sourcePanel: panel, enclosure: { ...current.enclosure, result: undefined }, sheetLayout: undefined }, base);
    setEditor(null); setMessage(`${preset.name} added to the panel.`);
  };
  const saveComponent = async (preset: ComponentPreset) => {
    if (!latestDocument.current.enclosureWorkspace || savePending.current) return;
    savePending.current = true; setSavingComponent(true);
    try {
      await componentPresetRepo.create(preset);
      placePreset(preset, true);
    } catch { setMessage("That component could not be saved. Choose a different name and try again."); }
    finally { savePending.current = false; setSavingComponent(false); }
  };
  const makeBox = (settings: BoxSettings) => {
    if (!workspace) return;
    const candidate = { ...workspace, enclosure: { ...workspace.enclosure, parameters: { frontHeight: settings.frontHeight, rearHeight: settings.rearHeight, thickness: settings.thickness, clearance: settings.clearance, fingerTarget: settings.fingerTarget } }, coupon: { confirmed: false, ...(settings.includeCoupon ? { selectedClearance: settings.clearance } : {}) }, packing: { sheetSize: { width: settings.sheetWidth, height: settings.sheetHeight }, orientation: settings.orientation, margin: settings.margin, gap: settings.gap }, sheetLayout: undefined };
    const result = regenerateEnclosureWorkspace(candidate);
    if (!result.ok) { setMessage(result.issues.map(({ message }) => message).join(" ")); return; }
    saveWorkspace(result.workspace); setEditor(null); setMessage("Six box faces generated. Arrange them when ready.");
  };
  const arrange = () => {
    if (!workspace?.enclosure.result) return;
    const parts = workspace.enclosure.result.panels.map(({ id, width, height }) => ({ id, width, height }));
    if (workspace.coupon.selectedClearance !== undefined) {
      const coupon = generateFitCoupon({ thickness: workspace.enclosure.parameters.thickness, clearance: workspace.coupon.selectedClearance });
      parts.push({ id: coupon.id, ...coupon.bounds });
    }
    const packing = workspace.packing ?? { sheetSize: { width: 210, height: 148 }, orientation: "landscape" as const, margin: 5, gap: 2 };
    const layout = packParts(parts, packing);
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
      {preflight && <div role="status" aria-label="Fabrication readiness" className="components-box__message">
        <strong>{preflight.ready ? "Ready to cut." : "Not ready to cut."}</strong>
        {!preflight.ready && <span> {preflight.issues.map(({ message }) => message).join(" ")}</span>}
      </div>}
      {workspace?.coupon.selectedClearance !== undefined && !workspace.coupon.confirmed && <button type="button" onClick={() => saveWorkspace({ ...workspace, coupon: { ...workspace.coupon, confirmed: true } })}>Confirm fit coupon</button>}
      {editor === "component" && <ComponentEditor saving={savingComponent} onSave={saveComponent} onCancel={() => setEditor(null)} />}
      {editor === "panel" && <PanelForm initial={workspace?.sourcePanel} onSave={savePanel} onCancel={() => setEditor(null)} />}
      {editor === "box" && workspace && <BoxDialog panelHeight={workspace.sourcePanel.height} initial={{ ...workspace.enclosure.parameters, sheetWidth: workspace.packing?.sheetSize.width ?? 210, sheetHeight: workspace.packing?.sheetSize.height ?? 148, orientation: workspace.packing?.orientation ?? "landscape", margin: workspace.packing?.margin ?? 5, gap: workspace.packing?.gap ?? 2, includeCoupon: workspace.coupon.selectedClearance !== undefined }} onConfirm={makeBox} onCancel={() => setEditor(null)} />}
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
