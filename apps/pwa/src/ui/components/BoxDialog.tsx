import { useState } from "react";
import type { EnclosureParameters } from "../../core/enclosure/types";
import { packParts } from "../../core/layout/pack";
import { generateFitCoupon } from "../../core/enclosure/coupon";

export type BoxSettings = EnclosureParameters & { depth: number; sheetWidth: number; sheetHeight: number; orientation: "landscape" | "portrait"; margin: number; gap: number; includeCoupon: boolean };
export type BoxDialogProps = { panelHeight: number; panelWidth?: number; initial?: Partial<BoxSettings>; onConfirm: (settings: BoxSettings) => void; onCancel: () => void };

export function BoxDialog({ panelHeight, panelWidth = 160, initial, onConfirm, onCancel }: BoxDialogProps) {
  const initialFront = initial?.frontHeight ?? 35, initialRear = initial?.rearHeight ?? 65;
  const initialDepth = Math.sqrt(Math.max(0, panelHeight ** 2 - (initialRear - initialFront) ** 2));
  const [value, setValue] = useState<BoxSettings>({ depth: Math.round(initialDepth * 1000) / 1000, frontHeight: initialFront, rearHeight: initialRear, thickness: 3, clearance: .15, fingerTarget: 8, sheetWidth: 210, sheetHeight: 148, orientation: "landscape", margin: 5, gap: 3, includeCoupon: false, ...initial });
  const delta = Math.abs(value.rearHeight - value.frontHeight);
  const requiredPanel = Math.hypot(value.depth, delta);
  const numeric = [panelHeight, value.depth, value.frontHeight, value.rearHeight, value.thickness, value.fingerTarget, value.sheetWidth, value.sheetHeight];
  let error = "";
  if (delta >= panelHeight) error = "Height difference must be less than the panel height.";
  else if (!numeric.every((number) => Number.isFinite(number) && number > 0) || !Number.isFinite(value.clearance) || value.clearance < 0 || !Number.isFinite(value.margin) || value.margin < 0 || !Number.isFinite(value.gap) || value.gap < 0) error = "Box dimensions must be finite; sizes must be positive and clearance, margin, and gap cannot be negative.";
  else if (Math.abs(requiredPanel - panelHeight) > .01) error = `Depth and heights require a ${requiredPanel.toFixed(2)} mm panel; adjust values or panel size.`;
  const parts = [{ id: "source", width: panelWidth, height: panelHeight }, { id: "rear", width: panelWidth, height: value.rearHeight }, { id: "left", width: value.depth, height: Math.max(value.frontHeight, value.rearHeight) }, { id: "right", width: value.depth, height: Math.max(value.frontHeight, value.rearHeight) }, { id: "base", width: panelWidth, height: value.depth }, { id: "service", width: panelWidth, height: value.frontHeight }];
  if (value.includeCoupon) { const coupon = generateFitCoupon(value); parts.push({ id: coupon.id, ...coupon.bounds }); }
  let estimatedSheets: number | undefined;
  try { estimatedSheets = packParts(parts, { sheetSize: { width: value.sheetWidth, height: value.sheetHeight }, orientation: value.orientation, margin: value.margin, gap: value.gap }).sheets.length; } catch { /* validation message covers invalid inputs */ }
  const field = (key: keyof BoxSettings, label: string, step = 1) => <label>{label}<input aria-label={label} type="number" min="0" step={step} value={value[key] as number} onChange={(event) => setValue({ ...value, [key]: Number(event.target.value) })} /></label>;
  return <div className="components-box__editor" role="dialog" aria-label="Make box">
    <div className="components-box__grid">{field("depth", "Depth", .1)}{field("frontHeight", "Front height")}{field("rearHeight", "Rear height")}</div>
    <details><summary>Advanced</summary><div className="components-box__grid">
      {field("thickness", "Stock thickness", .1)}{field("clearance", "Fit clearance", .05)}{field("fingerTarget", "Finger target", .5)}
      {field("sheetWidth", "Sheet width")}{field("sheetHeight", "Sheet height")}{field("margin", "Sheet margin", .5)}{field("gap", "Part gap", .5)}
      <label>Sheet orientation<select aria-label="Sheet orientation" value={value.orientation} onChange={(event) => setValue({ ...value, orientation: event.target.value as BoxSettings["orientation"] })}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>
      <label className="components-box__check"><input type="checkbox" checked={value.includeCoupon} onChange={(event) => setValue({ ...value, includeCoupon: event.target.checked })} /> Include fit coupon</label>
    </div></details>
    {error && <p role="alert" className="components-box__error">{error}</p>}
    {estimatedSheets !== undefined && <p className="components-box__hint">Estimated A5 sheets: {estimatedSheets}</p>}
    <div className="components-box__editor-actions"><button type="button" disabled={!!error} onClick={() => onConfirm(value)}>Generate box</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </div>;
}
