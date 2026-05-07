import { generateGcode } from "../../core/gcode";
import type { GcodeDialect } from "../../core/model";
import { diagnostic, errorResponse, okResponse } from "../responses";
import { summarizeJob } from "../summarizeJob";
import type { AgentDiagnostic, AgentResponse, GenerateData } from "../types";
import { validateJob } from "../validateJob";

const DEFAULT_DIALECT: GcodeDialect = {
  newline: "\n",
  useG0ForTravel: true,
  powerCommand: "S",
  enableLaser: "M3",
  disableLaser: "M5"
};

export type GenerateCommandOptions = {
  includeGcode?: boolean;
  gcodePath?: string;
};

export function generateCommand(input: unknown, options: GenerateCommandOptions = {}): AgentResponse<GenerateData> {
  const validation = validateJob(input);
  if (!validation.ok) {
    return errorResponse("generate", validation.diagnostics);
  }

  try {
    const result = generateGcode(
      validation.job.document,
      validation.job.camSettings,
      validation.job.machineProfile,
      validation.job.dialect ?? DEFAULT_DIALECT
    );

    const diagnostics: AgentDiagnostic[] = [
      ...validation.diagnostics,
      ...result.warnings.map((message) => diagnostic("CAM_WARNING", "warning", message))
    ];

    return okResponse("generate", {
      summary: summarizeJob(validation.job),
      gcode: options.gcodePath && !options.includeGcode ? undefined : result.gcode,
      gcodePath: options.gcodePath,
      preview: result.preview,
      stats: result.stats
    }, diagnostics);
  } catch (error) {
    return errorResponse("generate", [
      diagnostic("GENERATION_FAILED", "error", error instanceof Error ? error.message : String(error))
    ]);
  }
}
