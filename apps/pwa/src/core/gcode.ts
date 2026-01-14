import type {
  CamPlan,
  CamSettings,
  Document,
  GcodeDialect,
  JobStats,
  MachineProfile,
  PolylinePath,
  PreviewGeom
} from "./model";
import { distance } from "./geom";
import { planCam } from "./cam";

export type EmitResult = {
  gcode: string;
  stats: JobStats;
};

export type GenerateResult = {
  gcode: string;
  preview: PreviewGeom;
  stats: JobStats;
  warnings: string[];
};

export function emitGcode(
  plan: CamPlan,
  cam: CamSettings,
  machine: MachineProfile,
  dialect: GcodeDialect
): EmitResult {
  const lines: string[] = [];
  const opMap = new Map(cam.operations.map((op) => [op.id, op]));

  if (machine.preamble) {
    lines.push(...machine.preamble);
  }

  let current = { x: 0, y: 0 };
  let travelMm = 0;
  let markMm = 0;
  let estTimeS = 0;
  let segments = 0;

  for (const planned of plan.ops) {
    const op = opMap.get(planned.opId);
    if (!op) {
      continue;
    }

    const speed = op.speedMmMin;
    const feed = formatFeed(speed);
    const power = mapPower(op.powerPct, machine);
    const passes = Math.max(0, Math.floor(op.passes));

    for (let pass = 0; pass < passes; pass += 1) {
      for (const path of planned.paths) {
        if (path.points.length < 2) {
          continue;
        }

        const start = path.points[0];
        travelMm += distance(current, start);
        lines.push(formatTravel(start, feed, dialect));
        current = { ...start };

        lines.push(`${dialect.enableLaser} ${dialect.powerCommand}${power}`);

        const result = emitPath(path, feed, speed);
        lines.push(...result.lines);
        markMm += result.markMm;
        estTimeS += result.timeS;
        segments += result.segments;
        current = result.end;

        lines.push(dialect.disableLaser);
      }
    }
  }

  if (machine.postamble) {
    lines.push(...machine.postamble);
  }

  return {
    gcode: lines.join(dialect.newline),
    stats: {
      estTimeS,
      travelMm,
      markMm,
      segments
    }
  };
}

export function generateGcode(
  document: Document,
  cam: CamSettings,
  machine: MachineProfile,
  dialect: GcodeDialect
): GenerateResult {
  const { plan, preview, warnings } = planCam(document, cam);
  const { gcode, stats } = emitGcode(plan, cam, machine, dialect);

  return { gcode, preview, stats, warnings };
}

function formatTravel(point: { x: number; y: number }, feed: string, dialect: GcodeDialect): string {
  const cmd = dialect.useG0ForTravel ? "G0" : "G1";
  const coord = `${formatAxis("X", point.x)} ${formatAxis("Y", point.y)}`;
  if (dialect.useG0ForTravel) {
    return `${cmd} ${coord}`;
  }
  return `${cmd} ${coord} ${feed}`;
}

type EmitPathResult = {
  lines: string[];
  markMm: number;
  timeS: number;
  segments: number;
  end: { x: number; y: number };
};

function emitPath(path: PolylinePath, feed: string, speed: number): EmitPathResult {
  const lines: string[] = [];
  let markMm = 0;
  let timeS = 0;
  let segments = 0;

  let previous = path.points[0];
  for (let i = 1; i < path.points.length; i += 1) {
    const point = path.points[i];
    const distanceMm = distance(previous, point);
    const line = `G1 ${formatAxis("X", point.x)} ${formatAxis("Y", point.y)} ${feed}`;
    lines.push(line);
    markMm += distanceMm;
    timeS += speed > 0 ? (distanceMm / speed) * 60 : 0;
    segments += 1;
    previous = point;
  }

  if (path.closed) {
    const start = path.points[0];
    if (start.x !== previous.x || start.y !== previous.y) {
      const distanceMm = distance(previous, start);
      const line = `G1 ${formatAxis("X", start.x)} ${formatAxis("Y", start.y)} ${feed}`;
      lines.push(line);
      markMm += distanceMm;
      timeS += speed > 0 ? (distanceMm / speed) * 60 : 0;
      segments += 1;
      previous = start;
    }
  }

  return { lines, markMm, timeS, segments, end: previous };
}

function mapPower(powerPct: number, machine: MachineProfile): number {
  const range = machine.sRange.max - machine.sRange.min;
  const clamped = Math.min(100, Math.max(0, powerPct));
  return Math.round(machine.sRange.min + (range * clamped) / 100);
}

function formatAxis(axis: "X" | "Y", value: number): string {
  return `${axis}${formatNumber(value)}`;
}

function formatNumber(value: number): string {
  const normalized = Math.abs(value) < 0.0005 ? 0 : value;
  return normalized.toFixed(3);
}

function formatFeed(speedMmMin: number): string {
  const feed = Math.round(speedMmMin);
  return `F${feed}`;
}
