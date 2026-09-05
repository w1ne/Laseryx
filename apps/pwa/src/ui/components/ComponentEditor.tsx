import { useState } from "react";
import type { ComponentKind, ComponentPreset } from "../../core/components/types";

export type ComponentEditorProps = { onSave: (preset: ComponentPreset) => void; onCancel: () => void; saving?: boolean };

const defaults = {
  circle: { diameter: 10 }, slot: { length: 20, width: 6 }, rectangle: { width: 20, height: 12 },
  "rounded-rectangle": { width: 20, height: 12, cornerRadius: 2 }, "button-row": { count: 4, diameter: 8, pitch: 12 }
} satisfies Record<ComponentKind, ComponentPreset["dimensions"]>;

export function ComponentEditor({ onSave, onCancel, saving = false }: ComponentEditorProps) {
  const [name, setName] = useState("Component");
  const [kind, setKind] = useState<ComponentKind>("circle");
  const [dimensions, setDimensions] = useState<Record<string, number>>({ ...defaults.circle });
  const [body, setBody] = useState({ width: "", height: "", depth: "" });
  const [confidence, setConfidence] = useState<"verified" | "measured" | "nominal" | "required">("measured");
  const [missing, setMissing] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState<"vendor" | "datasheet" | "measured">("measured");
  const [mountingHoles, setMountingHoles] = useState("");
  const [acousticHole, setAcousticHole] = useState("");
  const [frontProtrusion, setFrontProtrusion] = useState("");
  const [notes, setNotes] = useState("");
  const changeKind = (next: ComponentKind) => { setKind(next); setDimensions({ ...defaults[next] }); };
  const positive = (key: string) => Number.isFinite(dimensions[key]) && dimensions[key] > 0;
  let error = "";
  if (!name.trim()) error = "Enter a component name.";
  else if (kind === "circle" && !positive("diameter")) error = "Diameter must be greater than zero.";
  else if (kind === "slot" && (!positive("length") || !positive("width") || dimensions.length < dimensions.width)) error = "Slot length and width must be positive, and length must be at least its width.";
  else if (kind === "rectangle" && (!positive("width") || !positive("height"))) error = "Width and height must be greater than zero.";
  else if (kind === "rounded-rectangle" && (!positive("width") || !positive("height") || !positive("cornerRadius") || dimensions.cornerRadius > Math.min(dimensions.width, dimensions.height) / 2)) error = "Use positive dimensions and a corner radius no larger than half the shortest side.";
  else if (kind === "button-row" && (!Number.isInteger(dimensions.count) || dimensions.count < 1 || !positive("diameter") || !positive("pitch") || dimensions.pitch < dimensions.diameter)) error = "Use a whole button count, positive sizes, and pitch at least as large as diameter.";
  else {
    const bodyValues = Object.values(body);
    const entered = bodyValues.filter((value) => value !== "").length;
    if (entered > 0 && entered < 3) error = "Enter all three body dimensions or leave them blank.";
    else if (entered === 3 && bodyValues.some((value) => !Number.isFinite(Number(value)) || Number(value) <= 0)) error = "Body dimensions must be greater than zero.";
    const holeRows = mountingHoles.trim() ? mountingHoles.split(";").map((row) => row.split(",").map(Number)) : [];
    const acoustic = acousticHole.trim() ? acousticHole.split(",").map(Number) : [];
    if (!error && holeRows.some((row) => row.length !== 3 || row.some((value) => !Number.isFinite(value)) || row[2] <= 0)) error = "Mounting holes must use x,y,diameter rows separated by semicolons.";
    else if (!error && acoustic.length && (acoustic.length !== 3 || acoustic.some((value) => !Number.isFinite(value)) || acoustic[2] <= 0)) error = "Acoustic hole must use x,y,diameter.";
    else if (!error && frontProtrusion !== "" && (!Number.isFinite(Number(frontProtrusion)) || Number(frontProtrusion) < 0)) error = "Front protrusion cannot be negative.";
  }
  const field = (key: string, label: string, step = 1) => <label>{label}<input aria-label={label} type="number" min={key === "count" ? 1 : 0.01} step={step} value={dimensions[key]} onChange={(event) => setDimensions({ ...dimensions, [key]: Number(event.target.value) })} /></label>;
  const save = () => {
    const bodyComplete = body.width !== "" && body.height !== "" && body.depth !== "";
    const holes = mountingHoles.trim() ? mountingHoles.split(";").map((row) => { const [x, y, diameter] = row.split(",").map(Number); return { x, y, diameter }; }) : [];
    const acoustic = acousticHole.trim() ? acousticHole.split(",").map(Number) : [];
    const hasMechanics = bodyComplete || missing.trim() || holes.length || acoustic.length || frontProtrusion !== "" || notes.trim();
    const mechanics = hasMechanics ? { confidence, ...(bodyComplete ? { body: { width: Number(body.width), height: Number(body.height), depth: Number(body.depth) } } : {}), ...(holes.length ? { mountingHoles: holes } : {}), ...(acoustic.length === 3 ? { acousticHole: { x: acoustic[0], y: acoustic[1], diameter: acoustic[2] } } : {}), ...(frontProtrusion !== "" ? { frontProtrusion: Number(frontProtrusion) } : {}), ...(missing.trim() ? { missing: missing.split(",").map((item) => item.trim()).filter(Boolean) } : {}), ...(notes.trim() ? { warnings: [notes.trim()] } : {}) } : undefined;
    const preset = { id: `component-${Date.now().toString(36)}`, name: name.trim() || "Component", kind, dimensions, ...(mechanics ? { mechanics } : {}), ...(sourceUrl.trim() ? { source: { url: sourceUrl.trim(), sourceType } } : {}) } as ComponentPreset;
    onSave(preset);
  };
  return <div className="components-box__editor" role="group" aria-label="Component editor">
    <label>Name<input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Kind<select aria-label="Kind" value={kind} onChange={(event) => changeKind(event.target.value as ComponentKind)}>
      <option value="circle">Circle</option><option value="slot">Slot</option><option value="rectangle">Rectangle</option>
      <option value="rounded-rectangle">Rounded rectangle</option><option value="button-row">Button row</option>
    </select></label>
    {kind === "circle" && field("diameter", "Diameter", .1)}
    {kind === "slot" && <>{field("length", "Length", .1)}{field("width", "Width", .1)}</>}
    {kind === "rectangle" && <>{field("width", "Width", .1)}{field("height", "Height", .1)}</>}
    {kind === "rounded-rectangle" && <>{field("width", "Width", .1)}{field("height", "Height", .1)}{field("cornerRadius", "Corner radius", .1)}</>}
    {kind === "button-row" && <>{field("count", "Button count")}{field("diameter", "Diameter", .1)}{field("pitch", "Pitch", .1)}</>}
    <details><summary>Mechanical details</summary><div className="components-box__grid">
      <label>Body width<input aria-label="Body width" type="number" min="0.01" step="0.1" value={body.width} onChange={(event) => setBody({ ...body, width: event.target.value })} /></label>
      <label>Body height<input aria-label="Body height" type="number" min="0.01" step="0.1" value={body.height} onChange={(event) => setBody({ ...body, height: event.target.value })} /></label>
      <label>Body depth<input aria-label="Body depth" type="number" min="0.01" step="0.1" value={body.depth} onChange={(event) => setBody({ ...body, depth: event.target.value })} /></label>
      <label>Confidence<select aria-label="Confidence" value={confidence} onChange={(event) => setConfidence(event.target.value as typeof confidence)}><option value="measured">Measured</option><option value="verified">Verified source</option><option value="nominal">Nominal</option><option value="required">Measurements required</option></select></label>
      <label>Missing measurements<input aria-label="Missing measurements" value={missing} placeholder="Comma separated" onChange={(event) => setMissing(event.target.value)} /></label>
      <label>Mounting holes<input aria-label="Mounting holes" value={mountingHoles} placeholder="x,y,diameter; x,y,diameter" onChange={(event) => setMountingHoles(event.target.value)} /></label>
      <label>Acoustic hole<input aria-label="Acoustic hole" value={acousticHole} placeholder="x,y,diameter" onChange={(event) => setAcousticHole(event.target.value)} /></label>
      <label>Front protrusion<input aria-label="Front protrusion" type="number" min="0" step="0.1" value={frontProtrusion} onChange={(event) => setFrontProtrusion(event.target.value)} /></label>
      <label>Source URL<input aria-label="Source URL" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label>
      <label>Source type<select aria-label="Source type" value={sourceType} onChange={(event) => setSourceType(event.target.value as typeof sourceType)}><option value="measured">Measured</option><option value="vendor">Vendor</option><option value="datasheet">Datasheet</option></select></label>
      <label>Mechanical notes<input aria-label="Mechanical notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    </div></details>
    {error && <p role="alert" className="components-box__error">{error}</p>}
    <div className="components-box__editor-actions"><button type="button" disabled={!!error || saving} onClick={save}>{saving ? "Saving…" : "Save component"}</button><button type="button" disabled={saving} onClick={onCancel}>Cancel</button></div>
  </div>;
}
