import type { Point, Transform } from "../model";
import { expandPanel } from "../panel/expand";
import type { PanelDesign } from "../panel/types";
import { createMatingJointPair, chooseJointSegmentCount, fingerJointPolygon, hasSelfIntersection } from "./joints";
import type { EdgeJoint, EnclosureGenerationResult, EnclosureInput, EnclosurePanel, EnclosurePanelId, EnclosureParameters, GeneratedEnclosure } from "./types";

const identity: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
export function chooseOddFingerCount(length: number, targetWidth: number): number {
  return Math.max(3, chooseJointSegmentCount(length, Math.max(targetWidth, 0.1)));
}

const pairSpecs = (width: number, slope: number, depth: number, front: number, rear: number): Array<[string, string, number]> => [
  ["source-panel-top", "rear-top", width], ["source-panel-right", "right-top", slope], ["source-panel-bottom", "service-panel-top", width], ["source-panel-left", "left-top", slope],
  ["rear-right", "right-right", rear], ["rear-bottom", "base-top", width], ["rear-left", "left-left", rear], ["base-right", "right-bottom", depth],
  ["base-bottom", "service-panel-bottom", width], ["base-left", "left-bottom", depth], ["service-panel-right", "right-left", front], ["service-panel-left", "left-right", front]
];

function validate(source: PanelDesign, parameters: EnclosureParameters) {
  const issues: Extract<EnclosureGenerationResult, { ok: false }>["issues"] = [];
  for (const [field, value] of Object.entries({ width: source.width, slopedLength: source.height, ...parameters })) {
    const valid = field === "clearance" ? Number.isFinite(value) && value >= 0 : Number.isFinite(value) && value > 0;
    if (!valid) issues.push({ code: "invalid-dimension", field, message: `${field} must be ${field === "clearance" ? "non-negative" : "positive"} and finite` });
  }
  const delta = Math.abs(parameters.rearHeight - parameters.frontHeight);
  if (Number.isFinite(source.height) && Number.isFinite(delta) && delta >= source.height) issues.push({ code: "impossible-slope", message: "Height delta must be shorter than the designed panel's sloped length" });
  return issues;
}

function generateFromPanel(source: PanelDesign, parameters: EnclosureParameters): EnclosureGenerationResult {
  const issues = validate(source, parameters);
  if (issues.length) return { ok: false, issues };
  const delta = parameters.rearHeight - parameters.frontHeight;
  const depth = Math.sqrt(source.height ** 2 - delta ** 2);
  const joints: EdgeJoint[] = [];
  for (const [first, second, length] of pairSpecs(source.width, source.height, depth, parameters.frontHeight, parameters.rearHeight)) {
    const pair = createMatingJointPair(first, second, length, parameters.thickness, parameters.clearance, parameters.fingerTarget);
    if (!pair.ok) issues.push(pair.issue); else joints.push(...pair.joints);
  }
  if (issues.length) return { ok: false, issues };
  const minimumFaceSpan = Math.min(source.width, source.height, depth, parameters.frontHeight, parameters.rearHeight);
  const minimumFingerWidth = Math.min(...joints.map((joint) => joint.nominalLength / joint.segmentCount));
  if (8 * parameters.thickness >= minimumFaceSpan || parameters.clearance >= minimumFingerWidth) {
    return { ok: false, issues: [{ code: "joint-geometry-infeasible", message: "Stock thickness or clearance is too large for a simple finger-jointed outline" }] };
  }
  const expanded = expandPanel(source);
  const byPanel = (id: EnclosurePanelId) => joints.filter((joint) => joint.panelId === id);
  const makePanel = (id: EnclosurePanelId, name: string, width: number, height: number, vertices: Point[], transform: Transform, removable = false, cutouts = expanded.cutouts.map(({ path }) => path)): EnclosurePanel => {
    const panelJoints = byPanel(id);
    const order = ["top", "right", "bottom", "left"];
    const ordered = order.map((edge) => panelJoints.find((joint) => joint.edge === edge)!);
    return { id, name, width, height, transform: { ...transform }, removable, joints: panelJoints, paths: [fingerJointPolygon(vertices, ordered.map((joint) => joint.segmentCount), parameters.thickness, ordered.map((joint) => joint.phase), ordered.map((joint) => joint.matingOffset)), ...cutouts], fingerCount: ordered[0].segmentCount, edgePattern: { horizontal: ordered[0].segmentCount, vertical: ordered[1].segmentCount, phase: ordered[0].phase } };
  };
  const rect = (w: number, h: number): Point[] => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  const sideHeight = Math.max(parameters.frontHeight, parameters.rearHeight);
  const side: Point[] = [{ x: 0, y: sideHeight - parameters.frontHeight }, { x: depth, y: sideHeight - parameters.rearHeight }, { x: depth, y: sideHeight }, { x: 0, y: sideHeight }];
  const panels = [
    makePanel("source-panel", source.name, source.width, source.height, rect(source.width, source.height), source.transform),
    makePanel("rear", "Rear panel", source.width, parameters.rearHeight, rect(source.width, parameters.rearHeight), identity, false, []),
    makePanel("left", "Left side", depth, sideHeight, side, identity, false, []),
    makePanel("right", "Right side", depth, sideHeight, side, identity, false, []),
    makePanel("base", "Base", source.width, depth, rect(source.width, depth), identity, false, []),
    makePanel("service-panel", "Service panel", source.width, parameters.frontHeight, rect(source.width, parameters.frontHeight), identity, true, [])
  ];
  if (panels.some(({ paths }) => hasSelfIntersection(paths[0]))) {
    return { ok: false, issues: [{ code: "joint-geometry-infeasible", message: "Finger joints create a self-intersecting face outline" }] };
  }
  const input: EnclosureInput = { width: source.width, depth, ...parameters };
  return { ok: true, issues: [], enclosure: { input, slopeDegrees: Math.atan2(delta, depth) * 180 / Math.PI, panels, joints } };
}

export function generateEnclosure(source: PanelDesign, parameters: EnclosureParameters): EnclosureGenerationResult;
export function generateEnclosure(input: EnclosureInput): GeneratedEnclosure;
export function generateEnclosure(sourceOrInput: PanelDesign | EnclosureInput, parameters?: EnclosureParameters): EnclosureGenerationResult | GeneratedEnclosure {
  if (parameters) return generateFromPanel(sourceOrInput as PanelDesign, parameters);
  const input = sourceOrInput as EnclosureInput;
  const source: PanelDesign = { id: "legacy-source", name: "Front control panel", width: input.width, height: Math.hypot(input.depth, input.rearHeight - input.frontHeight), components: [], transform: identity };
  const result = generateFromPanel(source, input);
  if (!result.ok) throw new Error(result.issues.map(({ message }) => message).join("; "));
  return result.enclosure;
}
