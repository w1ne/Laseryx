import { useState } from "react";
import type { EnclosureParameters } from "../../core/enclosure/types";

export type BoxSettings = EnclosureParameters & { depth: number; sheetWidth: number; sheetHeight: number; orientation: "landscape" | "portrait"; margin: number; gap: number; includeCoupon: boolean };
export type BoxDialogProps = { panelHeight: number; initial?: Partial<BoxSettings>; onConfirm: (settings: BoxSettings) => void; onCancel: () => void };

export function BoxDialog({ panelHeight, initial, onConfirm, onCancel }: BoxDialogProps) {
  const [value, setValue] = useState<BoxSettings>({ depth: 0, frontHeight: 35, rearHeight: 65, thickness: 3, clearance: .15, fingerTarget: 8, sheetWidth: 210, sheetHeight: 148, orientation: "landscape", margin: 5, gap: 2, includeCoupon: false, ...initial });
  const delta = Math.abs(value.rearHeight - value.frontHeight);
  const depth = delta < panelHeight ? Math.round(Math.sqrt(panelHeight ** 2 - delta ** 2) * 1000) / 1000 : 0;
  const numeric = [panelHeight, value.frontHeight, value.rearHeight, value.thickness, value.fingerTarget, value.sheetWidth, value.sheetHeight];
  let error = "";
  if (!numeric.every((number) => Number.isFinite(number) && number > 0) || !Number.isFinite(value.clearance) || value.clearance < 0 || !Number.isFinite(value.margin) || value.margin < 0 || !Number.isFinite(value.gap) || value.gap < 0) error = "Box dimensions must be finite; sizes must be positive and clearance, margin, and gap cannot be negative.";
  else if (delta >= panelHeight) error = "Height difference must be less than the panel height.";
  const field = (key: keyof BoxSettings, label: string, step = 1) => <label>{label}<input aria-label={label} type="number" min="0" step={step} value={value[key] as number} onChange={(event) => setValue({ ...value, [key]: Number(event.target.value) })} /></label>;
  return <div className="components-box__editor" role="dialog" aria-label="Make box">
    <div className="components-box__grid"><label>Depth<input aria-label="Depth" type="number" readOnly value={depth} title="Derived from the panel height and front/rear heights" /></label>{field("frontHeight", "Front height")}{field("rearHeight", "Rear height")}</div>
    <details><summary>Advanced</summary><div className="components-box__grid">
      {field("thickness", "Stock thickness", .1)}{field("clearance", "Fit clearance", .05)}{field("fingerTarget", "Finger target", .5)}
      {field("sheetWidth", "Sheet width")}{field("sheetHeight", "Sheet height")}{field("margin", "Sheet margin", .5)}{field("gap", "Part gap", .5)}
      <label>Sheet orientation<select aria-label="Sheet orientation" value={value.orientation} onChange={(event) => setValue({ ...value, orientation: event.target.value as BoxSettings["orientation"] })}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>
      <label className="components-box__check"><input type="checkbox" checked={value.includeCoupon} onChange={(event) => setValue({ ...value, includeCoupon: event.target.checked })} /> Include fit coupon</label>
    </div></details>
    {error && <p role="alert" className="components-box__error">{error}</p>}
    <div className="components-box__editor-actions"><button type="button" disabled={!!error} onClick={() => onConfirm({ ...value, depth })}>Generate box</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </div>;
}
