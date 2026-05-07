import type { AgentCommand, AgentDiagnostic, AgentResponse } from "./types";

export function diagnostic(
  code: string,
  severity: AgentDiagnostic["severity"],
  message: string,
  path?: string
): AgentDiagnostic {
  return path ? { code, severity, message, path } : { code, severity, message };
}

export function okResponse<T>(
  command: AgentCommand,
  data: T,
  diagnostics: AgentDiagnostic[] = []
): AgentResponse<T> {
  return {
    ok: true,
    command,
    data,
    warnings: diagnostics.filter((item) => item.severity === "warning"),
    errors: diagnostics.filter((item) => item.severity === "error")
  };
}

export function errorResponse<T>(
  command: AgentCommand,
  diagnostics: AgentDiagnostic[]
): AgentResponse<T> {
  return {
    ok: false,
    command,
    data: null,
    warnings: diagnostics.filter((item) => item.severity === "warning"),
    errors: diagnostics.filter((item) => item.severity === "error")
  };
}
