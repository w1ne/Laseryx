import { useState } from "react";
import type { PathObj } from "../../core/model";
import { HACKATHON_KIT } from "../../core/hardware/catalog";
import { placeHardwareModule } from "../../core/hardware/place";
import { generateEnclosure } from "../../core/enclosure/generate";
import { generateFitCoupon } from "../../core/enclosure/coupon";
import { packParts } from "../../core/layout/pack";
import { preflightEnclosure } from "../../core/enclosure/preflight";

type DraftPath = Omit<PathObj, "id" | "layerId">;
export type HackathonEnclosurePanelProps = { addPaths: (paths: DraftPath[]) => void };

export function HackathonEnclosurePanel({ addPaths }: HackathonEnclosurePanelProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sheetCount, setSheetCount] = useState<number | null>(null);
  const [couponConfirmed, setCouponConfirmed] = useState(false);
  const [overflow, setOverflow] = useState<string[]>([]);
  const [buttonDimensions, setButtonDimensions] = useState({ buttonDiameter: 0, buttonPitch: 0 });
  const [settings, setSettings] = useState({ width: 160, depth: 95, frontHeight: 35, rearHeight: 65, thickness: 3, clearance: 0.15, fingerTarget: 8 });

  const place = (sku: string) => {
    const result = placeHardwareModule(sku, { x: 0, y: 0 }, sku === "100.519.82" ? buttonDimensions : {});
    if (!result.ok) { setMessage(result.message); return; }
    addPaths(result.part.paths.map((path, index) => ({ kind: "path", closed: path.closed, points: path.points, transform: { a: 1, b: 0, c: 0, d: 1, e: 20, f: 20 }, name: `${result.part.name}${index ? ` ${index + 1}` : ""}` })));
    setMessage(`${result.part.name} placed. Select it to position and edit it.`);
  };

  const generate = () => {
    const enclosure = generateEnclosure(settings);
    const coupon = generateFitCoupon(settings);
    const packed = packParts([...enclosure.panels.map((p) => ({ id: p.id, width: p.width, height: p.height })), { id: coupon.id, ...coupon.bounds }], { width: 210, height: 148, margin: 5, gap: 3, allowRotation: true });
    const placements = new Map(packed.sheets.flatMap((sheet, sheetIndex) => sheet.placements.map((p) => [p.id, { ...p, sheetIndex }] as const)));
    addPaths(enclosure.panels.flatMap((panel) => panel.paths.map((path) => {
      const p = placements.get(panel.id);
      return { kind: "path" as const, closed: path.closed, points: path.points, transform: { a: 1, b: 0, c: 0, d: 1, e: (p?.x ?? 0) + (p?.sheetIndex ?? 0) * 220, f: p?.y ?? 0 }, name: panel.name };
    })).concat(coupon.paths.map((path, index) => {
      const p = placements.get(coupon.id);
      return { kind: "path" as const, closed: path.closed, points: path.points, transform: { a: 1, b: 0, c: 0, d: 1, e: (p?.x ?? 0) + (p?.sheetIndex ?? 0) * 220, f: p?.y ?? 0 }, name: index === 0 ? "Fit coupon" : `Fit slot ${coupon.labels[index - 1]}` };
    })));
    setSheetCount(packed.sheets.length);
    setOverflow(packed.overflow.map((part) => part.id));
    setMessage(packed.overflow.length ? `${packed.overflow.length} part(s) do not fit A5.` : "Enclosure and fit coupon generated. Run Operations preflight before cutting.");
  };

  const numberField = (key: keyof typeof settings, label: string, step = 1) => <label className="hack-kit__field">{label}<input type="number" min="0.01" step={step} value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })} /></label>;
  const preflight = preflightEnclosure({ thickness: settings.thickness, couponConfirmed, unknownMeasurements: [], overflowPartIds: overflow, overlappingPartIds: [] });

  return <section className="hack-kit">
    <button type="button" className="hack-kit__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>⚡ Hackathon enclosure</button>
    {open && <div className="hack-kit__body">
      <p className="hack-kit__intro">Your HESTORE kit · editable millimetres</p>
      {HACKATHON_KIT.map((module) => <div className="hack-kit__part" key={module.sku}>
        <div><strong>{module.partNumber}</strong><small>{module.sku} · {module.name}</small></div>
        <button type="button" disabled={module.mounting === "internal"} onClick={() => place(module.sku)} aria-label={`Place ${module.name}`}>{module.mounting === "internal" ? "Internal" : "Place"}</button>
      </div>)}
      <div className="hack-kit__grid">
        <label className="hack-kit__field">Button Ø (measure)<input aria-label="Button diameter" type="number" min="0" step="0.1" value={buttonDimensions.buttonDiameter} onChange={(e) => setButtonDimensions({ ...buttonDimensions, buttonDiameter: Number(e.target.value) })} /></label>
        <label className="hack-kit__field">Button pitch (measure)<input aria-label="Button pitch" type="number" min="0" step="0.1" value={buttonDimensions.buttonPitch} onChange={(e) => setButtonDimensions({ ...buttonDimensions, buttonPitch: Number(e.target.value) })} /></label>
      </div>
      <h3>Box wizard</h3>
      <div className="hack-kit__grid">{numberField("width", "Width")}{numberField("depth", "Depth")}{numberField("frontHeight", "Front height")}{numberField("rearHeight", "Rear height")}{numberField("thickness", "Stock", 0.1)}{numberField("clearance", "Fit clearance", 0.05)}</div>
      <button type="button" className="hack-kit__generate" onClick={generate}>Generate enclosure + A5 layout</button>
      {sheetCount !== null && <p><strong>{sheetCount} A5 sheets required</strong></p>}
      {sheetCount !== null && <label className="hack-kit__confirm"><input type="checkbox" checked={couponConfirmed} onChange={(e) => setCouponConfirmed(e.target.checked)} /> I cut the coupon and confirmed the selected fit</label>}
      {sheetCount !== null && <p className={preflight.ready ? "hack-kit__ready" : "hack-kit__blocked"}>{preflight.ready ? "✓ Geometry preflight ready" : `Preflight: ${preflight.issues.map((issue) => issue.message).join(" ")}`}</p>}
      {message && <p role="alert" className="hack-kit__message">{message}</p>}
    </div>}
  </section>;
}
