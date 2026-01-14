import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CamSettings,
  Document,
  GcodeDialect,
  Layer,
  MachineProfile,
  Operation,
  ShapeObj
} from "../core/model";
import { IDENTITY_TRANSFORM } from "../core/geom";
import type { GrblDriver, StatusSnapshot } from "../io/grblDriver";
import { createWebSerialGrblDriver } from "../io/grblDriver";
import { createWorkerClient } from "./workerClient";
import "./app.css";

type ExportState = {
  status: "idle" | "working" | "done" | "error";
  message?: string;
};

type WorkerStatus = {
  ready: boolean;
  error?: string;
};

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

type MachineConnection = {
  status: ConnectionState;
  message?: string;
};

type StreamState = "idle" | "streaming" | "paused" | "done" | "error";

const DEFAULT_LAYER_ID = "layer-1";
const DEFAULT_OP_ID = "op-1";

function createDefaultDocument(): Document {
  return {
    version: 1,
    units: "mm",
    layers: [
      {
        id: DEFAULT_LAYER_ID,
        name: "Layer 1",
        visible: true,
        locked: false,
        operationId: DEFAULT_OP_ID
      }
    ],
    objects: [
      {
        kind: "shape",
        id: "rect-1",
        layerId: DEFAULT_LAYER_ID,
        transform: { ...IDENTITY_TRANSFORM, e: 20, f: 20 },
        shape: { type: "rect", width: 80, height: 50 }
      }
    ]
  };
}

function createDefaultCamSettings(): CamSettings {
  return {
    operations: [
      {
        id: DEFAULT_OP_ID,
        type: "vectorCut",
        speedMmMin: 1200,
        powerPct: 55,
        passes: 1,
        order: "insideOut"
      }
    ]
  };
}

function createDefaultMachineProfile(): MachineProfile {
  return {
    bedMm: { w: 300, h: 200 },
    origin: "frontLeft",
    sRange: { min: 0, max: 1000 },
    laserMode: "M4",
    preamble: ["G21", "G90"]
  };
}

function createDefaultDialect(): GcodeDialect {
  return {
    newline: "\n",
    useG0ForTravel: true,
    powerCommand: "S",
    enableLaser: "M4",
    disableLaser: "M5"
  };
}

function downloadGcode(filename: string, gcode: string) {
  const blob = new Blob([gcode], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function updateOperation(
  operations: Operation[],
  opId: string,
  updater: (op: Operation) => Operation
): Operation[] {
  return operations.map((op) => (op.id === opId ? updater(op) : op));
}

function updateLayer(layers: Layer[], layerId: string, updater: (layer: Layer) => Layer): Layer[] {
  return layers.map((layer) => (layer.id === layerId ? updater(layer) : layer));
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function formatPosition(position?: { x: number; y: number; z: number }) {
  if (!position) {
    return "n/a";
  }
  return `${formatNumber(position.x)}, ${formatNumber(position.y)}, ${formatNumber(position.z)}`;
}

export function App() {
  const initialDocument = useMemo(() => createDefaultDocument(), []);
  const [document, setDocument] = useState<Document>(initialDocument);
  const [camSettings, setCamSettings] = useState<CamSettings>(() => createDefaultCamSettings());
  const [machineProfile, setMachineProfile] = useState<MachineProfile>(() =>
    createDefaultMachineProfile()
  );
  const dialect = useMemo<GcodeDialect>(
    () => ({ ...createDefaultDialect(), enableLaser: machineProfile.laserMode }),
    [machineProfile.laserMode]
  );
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    initialDocument.objects[0]?.id ?? null
  );
  const [nextRectId, setNextRectId] = useState(2);
  const [exportState, setExportState] = useState<ExportState>({ status: "idle" });
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({ ready: false });
  const [latestGcode, setLatestGcode] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"design" | "machine">("design");
  const [machineConnection, setMachineConnection] = useState<MachineConnection>({
    status: "disconnected"
  });
  const [machineStatus, setMachineStatus] = useState<StatusSnapshot>({ state: "UNKNOWN" });
  const [machineMessage, setMachineMessage] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [streamMessage, setStreamMessage] = useState<string | null>(null);
  const [armLaser, setArmLaser] = useState(false);
  const [manualCommand, setManualCommand] = useState("$$");
  const [manualState, setManualState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [manualResponse, setManualResponse] = useState<string | null>(null);
  const clientRef = useRef<ReturnType<typeof createWorkerClient> | null>(null);
  const driverRef = useRef<GrblDriver | null>(null);
  const streamRef = useRef<ReturnType<GrblDriver["streamJob"]> | null>(null);
  const isExportDisabled = !workerStatus.ready || exportState.status === "working";
  const serialSupported = typeof navigator !== "undefined" && "serial" in navigator;

  useEffect(() => {
    const worker = new Worker(new URL("../worker/worker.ts", import.meta.url), {
      type: "module"
    });
    const client = createWorkerClient(worker);
    clientRef.current = client;

    client
      .ping()
      .then(() => {
        setWorkerStatus({ ready: true });
      })
      .catch((err) => {
        setWorkerStatus({ ready: false, error: err instanceof Error ? err.message : String(err) });
      });

    return () => {
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (machineConnection.status !== "connected") {
      return;
    }
    const driver = driverRef.current;
    if (!driver) {
      return;
    }

    let active = true;
    const pollStatus = async () => {
      try {
        const status = await driver.getStatus();
        if (active) {
          setMachineStatus(status);
        }
      } catch (error) {
        if (active) {
          setMachineMessage(error instanceof Error ? error.message : "Status poll failed");
        }
      }
    };

    pollStatus();
    const timer = window.setInterval(pollStatus, 1000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [machineConnection.status]);

  const selectedObject = document.objects.find((obj) => obj.id === selectedObjectId) ?? null;
  const rectangleObject =
    selectedObject && selectedObject.kind === "shape" && selectedObject.shape.type === "rect"
      ? selectedObject
      : null;

  const handleAddRectangle = () => {
    const id = `rect-${nextRectId}`;
    setNextRectId((value) => value + 1);
    const rect: ShapeObj = {
      kind: "shape",
      id,
      layerId: DEFAULT_LAYER_ID,
      transform: { ...IDENTITY_TRANSFORM, e: 40, f: 40 },
      shape: { type: "rect", width: 60, height: 40 }
    };
    setDocument((prev) => ({ ...prev, objects: [...prev.objects, rect] }));
    setSelectedObjectId(id);
  };

  const generateGcode = async () => {
    const client = clientRef.current;
    if (!client) {
      throw new Error("Worker not ready.");
    }
    const result = await client.generateGcode(document, camSettings, machineProfile, dialect);
    setLatestGcode(result.gcode);
    setWarnings(result.warnings);
    return result.gcode;
  };

  const handleExport = async () => {
    setExportState({ status: "working", message: "Generating G-code..." });
    try {
      const gcode = await generateGcode();
      downloadGcode("laser-job.gcode", gcode);
      setExportState({ status: "done", message: "Downloaded laser-job.gcode" });
    } catch (error) {
      setExportState({
        status: "error",
        message: error instanceof Error ? error.message : "Export failed"
      });
    }
  };

  const getDriver = () => {
    if (!driverRef.current) {
      driverRef.current = createWebSerialGrblDriver();
    }
    return driverRef.current;
  };

  const handleConnect = async () => {
    setMachineMessage(null);
    if (!serialSupported) {
      setMachineConnection({ status: "error", message: "Web Serial is not available." });
      return;
    }
    setMachineConnection({ status: "connecting" });
    try {
      const driver = getDriver();
      await driver.connect();
      setMachineConnection({ status: "connected" });
      const status = await driver.getStatus();
      setMachineStatus(status);
    } catch (error) {
      setMachineConnection({
        status: "error",
        message: error instanceof Error ? error.message : "Connection failed"
      });
    }
  };

  const handleDisconnect = async () => {
    setMachineMessage(null);
    if (driverRef.current) {
      await driverRef.current.disconnect();
    }
    setMachineConnection({ status: "disconnected" });
    setMachineStatus({ state: "UNKNOWN" });
    setStreamState("idle");
    setStreamMessage(null);
    setArmLaser(false);
    setManualState("idle");
    setManualResponse(null);
  };

  const handleStartJob = async () => {
    setStreamMessage(null);
    setMachineMessage(null);
    if (!armLaser) {
      setStreamState("error");
      setStreamMessage("Arm Laser before streaming.");
      return;
    }
    if (!workerStatus.ready) {
      setStreamState("error");
      setStreamMessage("Worker not ready.");
      return;
    }
    if (!driverRef.current || !driverRef.current.isConnected()) {
      setStreamState("error");
      setStreamMessage("Not connected to a controller.");
      return;
    }
    try {
      setStreamState("streaming");
      setStreamMessage("Generating G-code...");
      const gcode = await generateGcode();
      setStreamMessage("Streaming job (ack mode)...");
      const handle = driverRef.current.streamJob(gcode, "ack");
      streamRef.current = handle;
      await handle.done;
      setStreamState("done");
      setStreamMessage("Job complete.");
    } catch (error) {
      setStreamState("error");
      setStreamMessage(error instanceof Error ? error.message : "Streaming failed");
    } finally {
      streamRef.current = null;
    }
  };

  const handlePause = async () => {
    if (!driverRef.current) {
      return;
    }
    await driverRef.current.pause();
    setStreamState("paused");
    setStreamMessage("Job paused.");
  };

  const handleResume = async () => {
    if (!driverRef.current) {
      return;
    }
    await driverRef.current.resume();
    setStreamState("streaming");
    setStreamMessage("Job resumed.");
  };

  const handleAbort = async () => {
    if (!driverRef.current) {
      return;
    }
    await driverRef.current.abort();
    if (streamRef.current) {
      await streamRef.current.abort();
    }
    setStreamState("error");
    setStreamMessage("Job aborted.");
  };

  const bed = machineProfile.bedMm;
  const isConnected = machineConnection.status === "connected";
  const isStreaming = streamState === "streaming";
  const isPaused = streamState === "paused";
  const canStart = isConnected && armLaser && workerStatus.ready && !isStreaming && !isPaused;
  const canPause = isStreaming;
  const canResume = isPaused;
  const canAbort = isStreaming || isPaused;
  const canSendManual = isConnected && manualCommand.trim().length > 0 && manualState !== "sending";

  const handleSendManual = async () => {
    setManualResponse(null);
    const command = manualCommand.trim();
    if (!command) {
      setManualState("error");
      setManualResponse("Enter a command to send.");
      return;
    }
    if (!driverRef.current || !driverRef.current.isConnected()) {
      setManualState("error");
      setManualResponse("Not connected to a controller.");
      return;
    }
    try {
      setManualState("sending");
      const ack = await driverRef.current.sendLine(command);
      const lines: string[] = [...(ack.lines ?? [])];
      if (ack.ok) {
        lines.push("ok");
      } else {
        lines.push(ack.error ?? "error");
      }
      setManualResponse(lines.join("\n"));
      setManualState(ack.ok ? "ok" : "error");
    } catch (error) {
      setManualState("error");
      setManualResponse(error instanceof Error ? error.message : "Command failed");
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">Milestone 2</p>
          <h1>LaserFather Workspace</h1>
          <p className="app__subtitle">
            Design a vector job, export G-code, or stream it over Web Serial.
          </p>
        </div>
        <div className={`app__worker ${workerStatus.ready ? "is-ready" : ""}`}>
          {workerStatus.ready ? "Worker ready" : workerStatus.error || "Worker starting"}
        </div>
      </header>

      <nav className="app__tabs" aria-label="Workspace tabs">
        <button
          className={`tab ${activeTab === "design" ? "is-active" : ""}`}
          onClick={() => setActiveTab("design")}
        >
          Design
        </button>
        <button
          className={`tab ${activeTab === "machine" ? "is-active" : ""}`}
          onClick={() => setActiveTab("machine")}
        >
          Machine
        </button>
      </nav>

      {activeTab === "design" ? (
        <main className="app__main">
          <section className="panel">
            <div className="panel__header">
              <h2>Document</h2>
              <button className="button" onClick={handleAddRectangle}>
                Add rectangle
              </button>
            </div>

            <div className="panel__body">
              <div className="list">
                {document.objects.map((obj) => {
                  const isSelected = obj.id === selectedObjectId;
                  let label = obj.id;
                  if (obj.kind === "shape" && obj.shape.type === "rect") {
                    label = `Rect ${formatNumber(obj.shape.width)} x ${formatNumber(obj.shape.height)}`;
                  }
                  return (
                    <button
                      key={obj.id}
                      className={`list__item ${isSelected ? "is-active" : ""}`}
                      onClick={() => setSelectedObjectId(obj.id)}
                    >
                      <span>{label}</span>
                      <span className="list__meta">{obj.layerId}</span>
                    </button>
                  );
                })}
              </div>

              {rectangleObject ? (
                <div className="form">
                  <div className="form__row">
                    <label>
                      X (mm)
                      <input
                        type="number"
                        value={rectangleObject.transform.e}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber;
                          if (Number.isNaN(value)) {
                            return;
                          }
                          setDocument((prev) => ({
                            ...prev,
                            objects: prev.objects.map((obj) =>
                              obj.id === rectangleObject.id && obj.kind === "shape"
                                ? { ...obj, transform: { ...obj.transform, e: value } }
                                : obj
                            )
                          }));
                        }}
                      />
                    </label>
                    <label>
                      Y (mm)
                      <input
                        type="number"
                        value={rectangleObject.transform.f}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber;
                          if (Number.isNaN(value)) {
                            return;
                          }
                          setDocument((prev) => ({
                            ...prev,
                            objects: prev.objects.map((obj) =>
                              obj.id === rectangleObject.id && obj.kind === "shape"
                                ? { ...obj, transform: { ...obj.transform, f: value } }
                                : obj
                            )
                          }));
                        }}
                      />
                    </label>
                  </div>
                  <div className="form__row">
                    <label>
                      Width (mm)
                      <input
                        type="number"
                        value={rectangleObject.shape.width}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber;
                          if (Number.isNaN(value)) {
                            return;
                          }
                          setDocument((prev) => ({
                            ...prev,
                            objects: prev.objects.map((obj) =>
                              obj.id === rectangleObject.id && obj.kind === "shape"
                                ? { ...obj, shape: { ...obj.shape, width: value } }
                                : obj
                            )
                          }));
                        }}
                      />
                    </label>
                    <label>
                      Height (mm)
                      <input
                        type="number"
                        value={rectangleObject.shape.height}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber;
                          if (Number.isNaN(value)) {
                            return;
                          }
                          setDocument((prev) => ({
                            ...prev,
                            objects: prev.objects.map((obj) =>
                              obj.id === rectangleObject.id && obj.kind === "shape"
                                ? { ...obj, shape: { ...obj.shape, height: value } }
                                : obj
                            )
                          }));
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="panel__note">Select a rectangle to edit its dimensions.</div>
              )}
            </div>
          </section>

          <section className="panel panel--preview">
            <div className="panel__header">
              <h2>Preview</h2>
              <div className="panel__meta">
                Bed {formatNumber(bed.w)} x {formatNumber(bed.h)} mm
              </div>
            </div>
            <div className="preview">
              <svg viewBox={`0 0 ${bed.w} ${bed.h}`} role="img">
                <rect
                  x={0}
                  y={0}
                  width={bed.w}
                  height={bed.h}
                  className="preview__bed"
                  rx={8}
                />
                {document.objects.map((obj) => {
                  if (obj.kind !== "shape" || obj.shape.type !== "rect") {
                    return null;
                  }
                  return (
                    <rect
                      key={obj.id}
                      x={obj.transform.e}
                      y={obj.transform.f}
                      width={obj.shape.width}
                      height={obj.shape.height}
                      className={
                        obj.id === selectedObjectId ? "preview__shape is-active" : "preview__shape"
                      }
                      rx={4}
                    />
                  );
                })}
              </svg>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Operations</h2>
            </div>

            <div className="panel__body">
              <div className="form">
                <div className="form__group">
                  <div className="form__title">Layers</div>
                  {document.layers.map((layer) => (
                    <label key={layer.id}>
                      {layer.name}
                      <select
                        value={layer.operationId ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDocument((prev) => ({
                            ...prev,
                            layers: updateLayer(prev.layers, layer.id, (entry) => ({
                              ...entry,
                              operationId: value
                            }))
                          }));
                        }}
                      >
                        {camSettings.operations.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.type}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                <div className="form__group">
                  <div className="form__title">Operation settings</div>
                  {camSettings.operations.map((op) => (
                    <div key={op.id} className="form__stack">
                      <label>
                        Type
                        <select
                          value={op.type}
                          onChange={(event) => {
                            const value = event.target.value as Operation["type"];
                            setCamSettings((prev) => ({
                              ...prev,
                              operations: updateOperation(prev.operations, op.id, (entry) => ({
                                ...entry,
                                type: value
                              }))
                            }));
                          }}
                        >
                          <option value="vectorCut">Vector cut</option>
                          <option value="vectorEngrave">Vector engrave</option>
                        </select>
                      </label>
                      <label>
                        Speed (mm/min)
                        <input
                          type="number"
                          value={op.speedMmMin}
                          onChange={(event) => {
                            const value = event.target.valueAsNumber;
                            if (Number.isNaN(value)) {
                              return;
                            }
                            setCamSettings((prev) => ({
                              ...prev,
                              operations: updateOperation(prev.operations, op.id, (entry) => ({
                                ...entry,
                                speedMmMin: value
                              }))
                            }));
                          }}
                        />
                      </label>
                      <label>
                        Power (%)
                        <input
                          type="number"
                          value={op.powerPct}
                          onChange={(event) => {
                            const value = event.target.valueAsNumber;
                            if (Number.isNaN(value)) {
                              return;
                            }
                            setCamSettings((prev) => ({
                              ...prev,
                              operations: updateOperation(prev.operations, op.id, (entry) => ({
                                ...entry,
                                powerPct: value
                              }))
                            }));
                          }}
                        />
                      </label>
                      <label>
                        Passes
                        <input
                          type="number"
                          value={op.passes}
                          onChange={(event) => {
                            const value = event.target.valueAsNumber;
                            if (Number.isNaN(value)) {
                              return;
                            }
                            setCamSettings((prev) => ({
                              ...prev,
                              operations: updateOperation(prev.operations, op.id, (entry) => ({
                                ...entry,
                                passes: value
                              }))
                            }));
                          }}
                        />
                      </label>
                      <label>
                        Order
                        <select
                          value={op.order}
                          onChange={(event) => {
                            const value = event.target.value as Operation["order"];
                            setCamSettings((prev) => ({
                              ...prev,
                              operations: updateOperation(prev.operations, op.id, (entry) => ({
                                ...entry,
                                order: value
                              }))
                            }));
                          }}
                        >
                          <option value="insideOut">Inside-out</option>
                          <option value="shortestTravel">Shortest travel</option>
                        </select>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="form__group">
                  <div className="form__title">Machine profile</div>
                  <div className="form__row">
                    <label>
                      Bed W (mm)
                      <input
                        type="number"
                        value={machineProfile.bedMm.w}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber;
                          if (Number.isNaN(value)) {
                            return;
                          }
                          setMachineProfile((prev) => ({
                            ...prev,
                            bedMm: { ...prev.bedMm, w: value }
                          }));
                        }}
                      />
                    </label>
                    <label>
                      Bed H (mm)
                      <input
                        type="number"
                        value={machineProfile.bedMm.h}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber;
                          if (Number.isNaN(value)) {
                            return;
                          }
                          setMachineProfile((prev) => ({
                            ...prev,
                            bedMm: { ...prev.bedMm, h: value }
                          }));
                        }}
                      />
                    </label>
                  </div>
                  <div className="form__row">
                    <label>
                      S max
                      <input
                        type="number"
                        value={machineProfile.sRange.max}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber;
                          if (Number.isNaN(value)) {
                            return;
                          }
                          setMachineProfile((prev) => ({
                            ...prev,
                            sRange: { ...prev.sRange, max: value }
                          }));
                        }}
                      />
                    </label>
                    <label>
                      Laser mode
                      <select
                        value={machineProfile.laserMode}
                        onChange={(event) => {
                          const value = event.target.value as MachineProfile["laserMode"];
                          setMachineProfile((prev) => ({
                            ...prev,
                            laserMode: value
                          }));
                        }}
                      >
                        <option value="M3">M3</option>
                        <option value="M4">M4</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="form__group">
                  <div className="form__title">Export</div>
                  <button
                    className="button button--primary"
                    onClick={handleExport}
                    disabled={isExportDisabled}
                  >
                    Export G-code
                  </button>
                  {exportState.message ? (
                    <div
                      className={`status status--${
                        exportState.status === "error" ? "error" : "info"
                      }`}
                    >
                      {exportState.message}
                    </div>
                  ) : null}
                  {warnings.length > 0 ? (
                    <div className="status status--warning">
                      {warnings.map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {latestGcode ? (
                  <div className="form__group">
                    <div className="form__title">Latest G-code</div>
                    <pre className="code-block">{latestGcode}</pre>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="app__main app__main--single">
          <section className="panel panel--full">
            <div className="panel__header">
              <h2>Machine</h2>
              <div className="panel__meta">
                {serialSupported ? "Web Serial ready" : "Web Serial unavailable"}
              </div>
            </div>

            <div className="panel__body">
              <div className="machine-grid">
                <div className="machine-card">
                  <div className="form__title">Connection</div>
                  <div className="machine-row">
                    <button
                      className="button button--primary"
                      onClick={handleConnect}
                      disabled={!serialSupported || machineConnection.status === "connecting"}
                    >
                      {machineConnection.status === "connecting" ? "Connecting..." : "Connect"}
                    </button>
                    <button
                      className="button"
                      onClick={handleDisconnect}
                      disabled={!isConnected}
                    >
                      Disconnect
                    </button>
                  </div>
                  <div className="machine-meta">Status: {machineConnection.status}</div>
                  {machineConnection.message ? (
                    <div className="status status--error">{machineConnection.message}</div>
                  ) : null}
                  {machineMessage ? (
                    <div className="status status--warning">{machineMessage}</div>
                  ) : null}
                </div>

                <div className="machine-card">
                  <div className="form__title">Controller status</div>
                  <div className="machine-status">
                    <div>
                      <span>State</span>
                      <strong>{machineStatus.state}</strong>
                    </div>
                    <div>
                      <span>WPos</span>
                      <strong>{formatPosition(machineStatus.wpos)}</strong>
                    </div>
                    <div>
                      <span>MPos</span>
                      <strong>{formatPosition(machineStatus.mpos)}</strong>
                    </div>
                  </div>
                </div>

                <div className="machine-card">
                  <div className="form__title">Job controls</div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={armLaser}
                      onChange={(event) => setArmLaser(event.target.checked)}
                    />
                    <span>Arm Laser</span>
                  </label>
                  <div className="machine-row">
                    <button
                      className="button button--primary"
                      onClick={handleStartJob}
                      disabled={!canStart}
                    >
                      Start job
                    </button>
                    <button className="button" onClick={handlePause} disabled={!canPause}>
                      Pause
                    </button>
                    <button className="button" onClick={handleResume} disabled={!canResume}>
                      Resume
                    </button>
                    <button className="button" onClick={handleAbort} disabled={!canAbort}>
                      Abort
                    </button>
                  </div>
                  {streamMessage ? (
                    <div
                      className={`status status--${streamState === "error" ? "error" : "info"}`}
                    >
                      {streamMessage}
                    </div>
                  ) : null}
                  <div className="machine-meta">Mode: ack streaming</div>
                </div>

                <div className="machine-card">
                  <div className="form__title">Manual command</div>
                  <label>
                    Command
                    <input
                      type="text"
                      value={manualCommand}
                      onChange={(event) => setManualCommand(event.target.value)}
                      placeholder="$$ or $I"
                    />
                  </label>
                  <div className="machine-row">
                    <button className="button" onClick={handleSendManual} disabled={!canSendManual}>
                      {manualState === "sending" ? "Sending..." : "Send"}
                    </button>
                  </div>
                  <div className="machine-note">
                    Use commands that return <code>ok</code> (for example: <code>$$</code>,{" "}
                    <code>$I</code>).
                  </div>
                  {manualResponse ? (
                    <pre className="code-block code-block--compact">{manualResponse}</pre>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
