import { useState } from "react";
import type { EnclosureParameters } from "../../core/enclosure/types";

export type BoxSettings = EnclosureParameters & { depth: number; sheetWidth: number; sheetHeight: number; margin: number; gap: number; includeCoupon: boolean };
export type BoxDialogProps = { initial?: Partial<BoxSettings>; onConfirm: (settings: BoxSettings) => void; onCancel: () => void };

export function BoxDialog({ initial, onConfirm, onCancel }: BoxDialogProps) {
  const [value, setValue] = useState<BoxSettings>({ depth: 95, frontHeight: 35, rearHeight: 65, thickness: 3, clearance: .15, fingerTarget: 8, sheetWidth: 210, sheetHeight: 148, margin: 5, gap: 2, includeCoupon: false, ...initial });
  const field = (key: keyof BoxSettings, label: string, step = 1) => <label>{label}<input aria-label={label} type="number" min="0" step={step} value={value[key] as number} onChange={(event) => setValue({ ...value, [key]: Number(event.target.value) })} /></label>;
  return <div className="components-box__editor" role="dialog" aria-label="Make box">
    <div className="components-box__grid">{field("depth", "Depth")}{field("frontHeight", "Front height")}{field("rearHeight", "Rear height")}</div>
    <details><summary>Advanced</summary><div className="components-box__grid">
      {field("thickness", "Stock thickness", .1)}{field("clearance", "Fit clearance", .05)}{field("fingerTarget", "Finger target", .5)}
      {field("sheetWidth", "Sheet width")}{field("sheetHeight", "Sheet height")}{field("margin", "Sheet margin", .5)}{field("gap", "Part gap", .5)}
      <label className="components-box__check"><input type="checkbox" checked={value.includeCoupon} onChange={(event) => setValue({ ...value, includeCoupon: event.target.checked })} /> Include fit coupon</label>
    </div></details>
    <div className="components-box__editor-actions"><button type="button" onClick={() => onConfirm(value)}>Generate box</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </div>;
}
