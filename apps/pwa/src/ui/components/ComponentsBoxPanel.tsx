import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentPreset } from "../../core/components/types";
import type { PanelDesign } from "../../core/panel/types";
import { addComponentInstance, createInstanceFromPreset, regenerateEnclosureWorkspace, removeComponentInstance, updateComponentInstance, type EnclosureWorkspace } from "../../core/enclosure/workspace";
import { EXAMPLE_COMPONENT_PRESETS } from "../../core/components/examples";
import type { ComponentInstance } from "../../core/components/types";
import { validatePanel } from "../../core/panel/validate";
import { generateFitCoupon } from "../../core/enclosure/coupon";
import { preflightEnclosure } from "../../core/enclosure/preflight";
import { packParts } from "../../core/layout/pack";
import type { Document, MachineProfile, Transform } from "../../core/model";
import { renderEnclosureWorkspace } from "../../core/enclosure/render";
import { componentPresetRepo } from "../../io/componentPresetRepo";
import { BoxDialog, boxPackingIssue, type BoxSettings } from "./BoxDialog";
import { ComponentEditor } from "./ComponentEditor";
import { validateMechanics } from "../../core/components/mechanics";

export type ComponentsBoxPanelProps = {
  document: Document;
  /** Legacy standalone integration. Store-backed callers should use onWorkspaceChange. */
  onDocumentChange?: (document: Document) => void;
  onWorkspaceChange?: (workspace: EnclosureWorkspace) => void;
  machineProfile?: Pick<MachineProfile, "bedMm">;
};
const identity: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
export function ComponentsBoxPanel({ document, onDocumentChange, onWorkspaceChange, machineProfile }: ComponentsBoxPanelProps) {
  const [open, setOpen] = useState(true), [editor, setEditor] = useState<"component" | "panel" | "box" | null>(null), [selectedInstanceId, setSelectedInstanceId] = useState<string>();
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
  const preflight = useMemo(() => workspace?.enclosure.result ? preflightEnclosure({ workspace, document, stockWidth: workspace.packing?.sheetSize.width, stockHeight: workspace.packing?.sheetSize.height, machineProfile }) : undefined, [workspace, document, machineProfile]);
  useEffect(() => { void componentPresetRepo.list().then(setRepoPresets).catch(() => setMessage("Saved components could not be loaded.")); }, []);
  const saveWorkspace = (next: EnclosureWorkspace, base = latestDocument.current) => {
    if (onWorkspaceChange) onWorkspaceChange(next);
    else onDocumentChange?.(renderEnclosureWorkspace(base, next));
  };
  const savePanel = (width: number, height: number, x: number, y: number) => {
    const panel: PanelDesign = { id: workspace?.sourcePanel.id ?? "source-panel-design", name: "Control panel", width, height, components: workspace?.sourcePanel.components ?? [], transform: { ...(workspace?.sourcePanel.transform ?? identity), e: x, f: y } };
    saveWorkspace(workspace ? { ...workspace, sourcePanel: panel, enclosure: { ...workspace.enclosure, result: undefined }, sheetLayout: undefined } : {
      version: 1, presets: [], sourcePanel: panel, enclosure: { id: "enclosure-main", revision: 0, parameters: { frontHeight: 35, rearHeight: 65, thickness: 3, clearance: .15, fingerTarget: 8 } }, coupon: {}, packing: { sheetSize: { width: 210, height: 148 }, orientation: "landscape", margin: 5, gap: 3 }
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
    const packingIssue = boxPackingIssue(settings, workspace.sourcePanel.width, workspace.sourcePanel.height);
    if (packingIssue) { setMessage(packingIssue.message); return; }
    const candidate = { ...workspace, enclosure: { ...workspace.enclosure, parameters: { frontHeight: settings.frontHeight, rearHeight: settings.rearHeight, thickness: settings.thickness, clearance: settings.clearance, fingerTarget: settings.fingerTarget } }, coupon: settings.includeCoupon ? { selectedClearance: settings.clearance } : {}, packing: { sheetSize: { width: settings.sheetWidth, height: settings.sheetHeight }, orientation: settings.orientation, margin: settings.margin, gap: settings.gap } };
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
    const packing = workspace.packing ?? { sheetSize: { width: 210, height: 148 }, orientation: "landscape" as const, margin: 5, gap: 3 };
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
      {workspace && !workspace.enclosure.result && <><p className="components-box__hint">Panel position · {workspace.sourcePanel.transform.e}, {workspace.sourcePanel.transform.f} mm</p><div className="components-box__instances">{workspace.sourcePanel.components.map((instance) => <button type="button" key={instance.id} onClick={() => setSelectedInstanceId(instance.id)}>Edit {instance.name}</button>)}</div></>}
      {workspace?.enclosure.result && <p className="components-box__hint">Six faces · {workspace.sheetLayout ? `${workspace.sheetLayout.sheets.length} sheet(s)` : "ready to arrange"}</p>}
      {preflight && <div role="status" aria-label="Fabrication readiness" className="components-box__message">
        <strong>{preflight.ready ? "Ready to cut." : "Not ready to cut."}</strong>
        {!preflight.ready && <span> {preflight.issues.map(({ message }) => message).join(" ")}</span>}
      </div>}
      {workspace?.coupon.selectedClearance !== undefined && <p className="components-box__hint">Optional fit coupon included; test it first when using unfamiliar stock.</p>}
      {editor === "component" && <ComponentEditor saving={savingComponent} onSave={saveComponent} onCancel={() => setEditor(null)} />}
      {editor === "panel" && <PanelForm initial={workspace?.sourcePanel} onSave={savePanel} onCancel={() => setEditor(null)} />}
      {selectedInstanceId && workspace && <InstanceEditor panel={workspace.sourcePanel} instance={workspace.sourcePanel.components.find(({ id }) => id === selectedInstanceId)!} onSave={(changes) => { const panel = updateComponentInstance(workspace.sourcePanel, selectedInstanceId, changes); const issues = validatePanel(panel); if (issues.length) { setMessage(issues.map(({ message }) => message).join(" ")); return false; } saveWorkspace({ ...workspace, sourcePanel: panel, enclosure: { ...workspace.enclosure, result: undefined }, sheetLayout: undefined }); setSelectedInstanceId(undefined); return true; }} onDelete={() => { saveWorkspace({ ...workspace, sourcePanel: removeComponentInstance(workspace.sourcePanel, selectedInstanceId), enclosure: { ...workspace.enclosure, result: undefined }, sheetLayout: undefined }); setSelectedInstanceId(undefined); }} onCancel={() => setSelectedInstanceId(undefined)} />}
      {editor === "box" && workspace && <BoxDialog panelHeight={workspace.sourcePanel.height} panelWidth={workspace.sourcePanel.width} initial={{ ...workspace.enclosure.parameters, sheetWidth: workspace.packing?.sheetSize.width ?? 210, sheetHeight: workspace.packing?.sheetSize.height ?? 148, orientation: workspace.packing?.orientation ?? "landscape", margin: workspace.packing?.margin ?? 5, gap: workspace.packing?.gap ?? 3, includeCoupon: workspace.coupon.selectedClearance !== undefined }} onConfirm={makeBox} onCancel={() => setEditor(null)} />}
      {presets.length > 0 && <details className="components-box__examples"><summary>Saved presets</summary>{presets.map((preset) => <button type="button" key={preset.id} disabled={!workspace} onClick={() => placePreset(preset, false)}>Add {preset.name}</button>)}</details>}
      <details className="components-box__examples"><summary>Example presets</summary>{EXAMPLE_COMPONENT_PRESETS.map((preset) => <button type="button" aria-label={preset.name} key={preset.id} disabled={!workspace} onClick={() => placePreset(structuredClone(preset) as ComponentPreset, false)}>{preset.name} <small>{preset.mechanics?.missing?.length ? "Measurements required" : preset.mechanics?.confidence === "nominal" ? "Nominal" : preset.mechanics?.confidence === "verified" ? "Verified" : "Editable"}</small></button>)}</details>
      {message && <p role="status" className="components-box__message">{message}</p>}
    </div>}
  </section>;
}

function PanelForm({ initial, onSave, onCancel }: { initial?: PanelDesign; onSave: (width: number, height: number, x: number, y: number) => void; onCancel: () => void }) {
  const [width, setWidth] = useState(initial?.width ?? 160), [height, setHeight] = useState(initial?.height ?? 100), [x, setX] = useState(initial?.transform.e ?? 0), [y, setY] = useState(initial?.transform.f ?? 0);
  const error = [width, height].every((value) => Number.isFinite(value) && value > 0) && [x, y].every(Number.isFinite) ? "" : "Panel dimensions must be greater than zero and all values must be finite.";
  return <div className="components-box__editor" role="dialog" aria-label={initial ? "Edit panel" : "Create panel"}><div className="components-box__grid">
    <label>Panel width<input aria-label="Panel width" type="number" min="1" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>
    <label>Panel height<input aria-label="Panel height" type="number" min="1" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>
    <label>Panel X<input aria-label="Panel X" type="number" value={x} onChange={(event) => setX(Number(event.target.value))} /></label><label>Panel Y<input aria-label="Panel Y" type="number" value={y} onChange={(event) => setY(Number(event.target.value))} /></label>
  </div>{error && <p role="alert" className="components-box__error">{error}</p>}<div className="components-box__editor-actions"><button type="button" disabled={!!error} onClick={() => onSave(width, height, x, y)}>Save panel</button><button type="button" onClick={onCancel}>Cancel</button></div></div>;
}

function InstanceEditor({ panel, instance, onSave, onDelete, onCancel }: { panel: PanelDesign; instance: ComponentInstance; onSave: (changes: Partial<Omit<ComponentInstance, "id" | "kind">>) => boolean; onDelete: () => void; onCancel: () => void }) {
  const [dimensions, setDimensions] = useState<Record<string, number>>({ ...instance.dimensions }), [x, setX] = useState(instance.transform.e), [y, setY] = useState(instance.transform.f);
  const [bodyWidth, setBodyWidth] = useState(instance.mechanics?.body?.width?.toString() ?? ""), [bodyHeight, setBodyHeight] = useState(instance.mechanics?.body?.height?.toString() ?? ""), [bodyDepth, setBodyDepth] = useState(instance.mechanics?.body?.depth?.toString() ?? ""), [missing, setMissing] = useState(instance.mechanics?.missing?.join(", ") ?? ""), [holes, setHoles] = useState(instance.mechanics?.mountingHoles?.map(({ x, y, diameter }) => `${x},${y},${diameter}`).join(";") ?? "");
  const [acoustic, setAcoustic] = useState(instance.mechanics?.acousticHole ? `${instance.mechanics.acousticHole.x},${instance.mechanics.acousticHole.y},${instance.mechanics.acousticHole.diameter}` : ""), [protrusion, setProtrusion] = useState(instance.mechanics?.frontProtrusion?.toString() ?? ""), [notes, setNotes] = useState(instance.mechanics?.warnings?.join(" ") ?? ""), [sourceUrl, setSourceUrl] = useState(instance.source?.url ?? ""), [sourceType, setSourceType] = useState(instance.source?.sourceType ?? "measured");
  const holeRows = holes.trim() ? holes.split(";").map((row) => row.split(",").map(Number)) : [];
  const acousticValues = acoustic.trim() ? acoustic.split(",").map(Number) : [];
  const parsedHoles = holeRows.map(([holeX, holeY, diameter]) => ({ x: holeX, y: holeY, diameter }));
  const bodyEntered = [bodyWidth, bodyHeight, bodyDepth].some(Boolean);
  const mechanics = instance.mechanics ? { ...instance.mechanics, ...(bodyEntered ? { body: { width: Number(bodyWidth), height: Number(bodyHeight), ...(bodyDepth ? { depth: Number(bodyDepth) } : {}) } } : { body: undefined }), mountingHoles: parsedHoles, ...(acousticValues.length === 3 ? { acousticHole: { x: acousticValues[0], y: acousticValues[1], diameter: acousticValues[2] } } : { acousticHole: undefined }), ...(protrusion ? { frontProtrusion: Number(protrusion) } : { frontProtrusion: undefined }), missing: missing.split(",").map((item) => item.trim()).filter(Boolean), warnings: notes.trim() ? [notes.trim()] : [] } : undefined;
  const source = sourceUrl.trim() ? { ...instance.source, url: sourceUrl.trim(), sourceType } : instance.source;
  const changes = { dimensions, transform: { ...instance.transform, e: x, f: y }, mechanics, source } as Partial<Omit<ComponentInstance, "id" | "kind">>;
  let error = "";
  try {
    if (holeRows.some((row) => row.length !== 3)) throw new Error("Mounting holes must use exactly x,y,diameter.");
    if (acousticValues.length && acousticValues.length !== 3) throw new Error("Acoustic hole must use exactly x,y,diameter.");
    error = [...validatePanel(updateComponentInstance(panel, instance.id, changes)).map(({ message }) => message), ...validateMechanics(mechanics)].join(" ");
  } catch (cause) { error = cause instanceof Error ? cause.message : "Component values are invalid."; }
  const field = (key: string, label: string) => <label>{label}<input aria-label={label} type="number" value={dimensions[key]} onChange={(event) => setDimensions({ ...dimensions, [key]: Number(event.target.value) })} /></label>;
  return <div role="dialog" aria-label={`Edit ${instance.name}`} className="components-box__editor"><strong>{instance.name}</strong>
    {instance.kind === "circle" && field("diameter", "Component diameter")}{instance.kind === "slot" && <>{field("length", "Component length")}{field("width", "Component width")}</>}{(instance.kind === "rectangle" || instance.kind === "rounded-rectangle") && <>{field("width", "Component width")}{field("height", "Component height")}</>}{instance.kind === "rounded-rectangle" && field("cornerRadius", "Component corner radius")}{instance.kind === "button-row" && <>{field("count", "Button count")}{field("diameter", "Component diameter")}{field("pitch", "Component pitch")}</>}
    <label>Component X<input aria-label="Component X" type="number" value={x} onChange={(event) => setX(Number(event.target.value))} /></label><label>Component Y<input aria-label="Component Y" type="number" value={y} onChange={(event) => setY(Number(event.target.value))} /></label>
    {instance.mechanics && <details><summary>Mechanical details</summary><div className="components-box__grid"><label>Body width<input aria-label="Instance body width" type="number" min="0.01" value={bodyWidth} onChange={(event) => setBodyWidth(event.target.value)} /></label><label>Body height<input aria-label="Instance body height" type="number" min="0.01" value={bodyHeight} onChange={(event) => setBodyHeight(event.target.value)} /></label><label>Body depth<input aria-label="Instance body depth" type="number" min="0.01" value={bodyDepth} onChange={(event) => setBodyDepth(event.target.value)} /></label><label>Mounting holes<input aria-label="Instance mounting holes" value={holes} onChange={(event) => setHoles(event.target.value)} /></label><label>Acoustic hole<input aria-label="Instance acoustic hole" value={acoustic} onChange={(event) => setAcoustic(event.target.value)} /></label><label>Front protrusion<input aria-label="Instance front protrusion" type="number" min="0" value={protrusion} onChange={(event) => setProtrusion(event.target.value)} /></label><label>Missing measurements<input aria-label="Instance missing measurements" value={missing} onChange={(event) => setMissing(event.target.value)} /></label><label>Source URL<input aria-label="Instance source URL" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label><label>Source type<select aria-label="Instance source type" value={sourceType} onChange={(event) => setSourceType(event.target.value as typeof sourceType)}><option value="measured">Measured</option><option value="vendor">Vendor</option><option value="datasheet">Datasheet</option></select></label><label>Mechanical notes<input aria-label="Instance mechanical notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></label></div></details>}
    {error && <p role="alert" className="components-box__error">{error}</p>}<div className="components-box__editor-actions"><button type="button" disabled={!!error} onClick={() => onSave(changes)}>Save instance</button><button type="button" onClick={onDelete}>Delete instance</button><button type="button" onClick={onCancel}>Cancel</button></div></div>;
}
