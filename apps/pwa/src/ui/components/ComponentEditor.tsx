import { useState } from "react";
import type { ComponentKind, ComponentPreset } from "../../core/components/types";

export type ComponentEditorProps = { onSave: (preset: ComponentPreset) => void; onCancel: () => void };

const defaults = {
  circle: { diameter: 10 }, slot: { length: 20, width: 6 }, rectangle: { width: 20, height: 12 },
  "rounded-rectangle": { width: 20, height: 12, cornerRadius: 2 }, "button-row": { count: 4, diameter: 8, pitch: 12 }
} satisfies Record<ComponentKind, ComponentPreset["dimensions"]>;

export function ComponentEditor({ onSave, onCancel }: ComponentEditorProps) {
  const [name, setName] = useState("Component");
  const [kind, setKind] = useState<ComponentKind>("circle");
  const [dimensions, setDimensions] = useState<Record<string, number>>({ ...defaults.circle });
  const changeKind = (next: ComponentKind) => { setKind(next); setDimensions({ ...defaults[next] }); };
  const positive = (key: string) => Number.isFinite(dimensions[key]) && dimensions[key] > 0;
  let error = "";
  if (!name.trim()) error = "Enter a component name.";
  else if (kind === "circle" && !positive("diameter")) error = "Diameter must be greater than zero.";
  else if (kind === "slot" && (!positive("length") || !positive("width") || dimensions.length < dimensions.width)) error = "Slot length and width must be positive, and length must be at least its width.";
  else if (kind === "rectangle" && (!positive("width") || !positive("height"))) error = "Width and height must be greater than zero.";
  else if (kind === "rounded-rectangle" && (!positive("width") || !positive("height") || !positive("cornerRadius") || dimensions.cornerRadius > Math.min(dimensions.width, dimensions.height) / 2)) error = "Use positive dimensions and a corner radius no larger than half the shortest side.";
  else if (kind === "button-row" && (!Number.isInteger(dimensions.count) || dimensions.count < 1 || !positive("diameter") || !positive("pitch") || dimensions.pitch < dimensions.diameter)) error = "Use a whole button count, positive sizes, and pitch at least as large as diameter.";
  const field = (key: string, label: string, step = 1) => <label>{label}<input aria-label={label} type="number" min={key === "count" ? 1 : 0.01} step={step} value={dimensions[key]} onChange={(event) => setDimensions({ ...dimensions, [key]: Number(event.target.value) })} /></label>;
  const save = () => {
    const preset = { id: `component-${Date.now().toString(36)}`, name: name.trim() || "Component", kind, dimensions } as ComponentPreset;
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
    {error && <p role="alert" className="components-box__error">{error}</p>}
    <div className="components-box__editor-actions"><button type="button" disabled={!!error} onClick={save}>Save component</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </div>;
}
