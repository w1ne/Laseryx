import { diagnostic } from "./responses";
import type { AgentDiagnostic, AgentJobInput } from "./types";

type ValidationResult =
  | { ok: true; job: AgentJobInput; diagnostics: AgentDiagnostic[] }
  | { ok: false; job: null; diagnostics: AgentDiagnostic[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function validateJob(input: unknown): ValidationResult {
  const diagnostics: AgentDiagnostic[] = [];

  if (!isObject(input)) {
    return {
      ok: false,
      job: null,
      diagnostics: [diagnostic("INVALID_INPUT", "error", "Input must be a JSON object")]
    };
  }

  if (!isObject(input.document)) {
    diagnostics.push(diagnostic("INVALID_INPUT", "error", "Missing document"));
  }
  if (!isObject(input.camSettings)) {
    diagnostics.push(diagnostic("INVALID_INPUT", "error", "Missing camSettings"));
  }
  if (!isObject(input.machineProfile)) {
    diagnostics.push(diagnostic("INVALID_INPUT", "error", "Missing machineProfile"));
  }

  const machine = isObject(input.machineProfile) ? input.machineProfile : null;
  const bed = machine && isObject(machine.bedMm) ? machine.bedMm : null;
  if (machine && (!bed || !hasPositiveNumber(bed.w) || !hasPositiveNumber(bed.h))) {
    diagnostics.push(diagnostic("INVALID_MACHINE", "error", "Machine bed dimensions must be positive"));
  }

  const document = isObject(input.document) ? input.document : null;
  if (document && !Array.isArray(document.layers)) {
    diagnostics.push(diagnostic("INVALID_DOCUMENT", "error", "Document layers must be an array"));
  }
  if (document && !Array.isArray(document.objects)) {
    diagnostics.push(diagnostic("INVALID_DOCUMENT", "error", "Document objects must be an array"));
  }

  const camSettings = isObject(input.camSettings) ? input.camSettings : null;
  if (camSettings && !Array.isArray(camSettings.operations)) {
    diagnostics.push(diagnostic("INVALID_CAM", "error", "CAM operations must be an array"));
  }

  if (diagnostics.some((item) => item.severity === "error")) {
    return { ok: false, job: null, diagnostics };
  }

  return {
    ok: true,
    job: input as AgentJobInput,
    diagnostics
  };
}
