# File: docs/interfaces.md

# Interfaces (UI <-> Worker, and GRBL Driver)

1) Worker protocol (postMessage)

Envelope
- Request: { id: string, type: string, payload: any }
- Response: { id: string, type: string, payload: any, error?: { code: string, message: string } }

Rules
- All payloads must be structured-clone compatible (JSON + arrays + typed arrays).
- No DOM objects, no functions, no class instances.

Worker message types (Milestone 0)
A) worker.ping (implemented now)
- req payload: {}
- res payload: { value: "pong" }

Worker message types (Milestone 1+)
B) core.camPlan
- req payload: { document: Document, cam: CamSettings, images?: Map<string, ImageData> }
- res payload: { plan: CamPlan, preview: PreviewGeom, warnings: string[] }

C) core.emitGcode
- req payload: { plan: CamPlan, cam: CamSettings, machine: MachineProfile, dialect: GcodeDialect, images?: Map<string, ImageData> }
- res payload: { gcode: string, stats: JobStats }

Optional convenience for MVP (reduce messages)
D) core.generateGcode
- req payload: { document: Document, cam: CamSettings, machine: MachineProfile, dialect: GcodeDialect, images?: Map<string, ImageData> }
- res payload: { gcode: string, preview: PreviewGeom, stats: JobStats, warnings: string[] }

Source of truth for the worker envelope in code:
- apps/pwa/src/shared/workerProtocol.ts

Core data types live in:
- apps/pwa/src/core/model.ts

2) Core data types (MVP)

Document
- {
  version: number,
  units: "mm",
  layers: Layer[],
  objects: Obj[]
}

Layer
- { id: string, name: string, visible: boolean, locked: boolean, operationId?: string }

Obj (union)
- PathObj:
  - { kind:"path", id, layerId, closed:boolean, transform: Transform, points: Point[] }
- ShapeObj (optional):
  - { kind:"shape", id, layerId, transform: Transform, shape: { type:"rect", ... } }
- ImageObj:
  - { kind:"image", id, layerId, transform: Transform, width: number, height: number, src: string }

Point
- { x:number, y:number }

Transform (2D affine)
- { a:number, b:number, c:number, d:number, e:number, f:number }

CamSettings
- {
  operations: Operation[],
  global?: { curveToleranceMm?: number }
}

Operation (MVP only vector)
- { id:string, type:"vectorCut"|"vectorEngrave"|"rasterEngrave", speedMmMin:number, powerPct:number, passes:number,
    order:"insideOut"|"shortestTravel" }

MachineProfile (GRBL-oriented)
- {
  bedMm: { w:number, h:number },
  origin: "frontLeft"|"frontRight"|"rearLeft"|"rearRight",
  sRange: { min:number, max:number },          // e.g. 0..1000
  laserMode: "M3"|"M4",
  preamble?: string[],
  postamble?: string[]
}

GcodeDialect
- {
  newline: "\n" | "\r\n",
  useG0ForTravel: boolean,
  powerCommand: "S",                 // GRBL-style
  enableLaser: "M3"|"M4",
  disableLaser: "M5"
}

CamPlan (neutral)
- { ops: PlannedOp[] }

PlannedOp
- { opId:string, kind:"vector", paths: PolylinePath[] }

PolylinePath
- { points: Point[], closed:boolean }

PreviewGeom
- { bbox:{minX:number,minY:number,maxX:number,maxY:number}, vector: PolylinePath[] }

JobStats
- { estTimeS:number, travelMm:number, markMm:number, segments:number }

3) GRBL Driver (UI-side, src/io)

Interface (TypeScript)
- connect(): Promise<void>             // uses navigator.serial.requestPort
- disconnect(): Promise<void>
- isConnected(): boolean
- getStatus(): Promise<StatusSnapshot>
- sendLine(line: string): Promise<Ack>
- streamJob(gcode: string, mode: "ack" | "buffered"): StreamHandle
- abort(): Promise<void>
- pause(): Promise<void>
- resume(): Promise<void>

StatusSnapshot (minimal)
- { state:"IDLE"|"RUN"|"HOLD"|"ALARM"|"UNKNOWN", wpos?:{x,y,z}, mpos?:{x,y,z} }

Ack
- { ok:boolean, error?:string, lines?:string[] } // lines are any responses before ok/error

StreamHandle
- { done: Promise<void>, abort(): Promise<void> }

Streaming modes
- ack: strict line-by-line wait for ok/error.
- buffered: reserved for later; keep the enum now so UI doesn’t change later.

Implementation reference:
- apps/pwa/src/io/grblDriver.ts
