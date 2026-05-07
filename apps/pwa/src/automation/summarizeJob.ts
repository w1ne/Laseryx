import type { AgentJobInput, JobSummary } from "./types";

export function summarizeJob(job: AgentJobInput): JobSummary {
  const objectsByKind = { shape: 0, path: 0, image: 0 };
  for (const obj of job.document.objects) {
    objectsByKind[obj.kind] += 1;
  }

  return {
    document: {
      version: job.document.version,
      units: job.document.units,
      layerCount: job.document.layers.length,
      objectCount: job.document.objects.length,
      objectsByKind,
      visibleLayerCount: job.document.layers.filter((layer) => layer.visible).length
    },
    cam: {
      operationCount: job.camSettings.operations.length,
      operations: job.camSettings.operations.map((operation) => ({
        id: operation.id,
        name: operation.name,
        mode: operation.mode,
        speed: operation.speed,
        power: operation.power,
        passes: operation.passes
      })),
      optimizePaths: job.camSettings.optimizePaths !== false
    },
    machine: {
      id: job.machineProfile.id,
      name: job.machineProfile.name,
      bedMm: job.machineProfile.bedMm,
      origin: job.machineProfile.origin,
      laserMode: job.machineProfile.laserMode,
      baudRate: job.machineProfile.baudRate
    }
  };
}
